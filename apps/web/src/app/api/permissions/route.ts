import { randomBytes, randomUUID } from 'node:crypto';
import {
  consumeM04ReadAccess,
  listM04PermissionReadModel,
  verifyM04PermissionEvidence,
} from '@nerva/db';
import { M04ReadModelRequestSchema } from '@nerva/contracts';
import {
  buildWalletReadAuthorizationTypedData,
  verifyWalletReadAuthorization,
} from '@nerva/permissions';
import { apiError, apiJson, parseM03Request, withM03Database } from '../../../server/m03-api.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const accountId = params.get('accountId') ?? '';
  const address = params.get('address') ?? '';
  const correlationId = `m04-read-${randomUUID()}`;
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(accountId) ||
    !/^0x[0-9a-fA-F]{40}$/.test(address)
  )
    return apiError(
      400,
      'WALLET_READ_CHALLENGE_INVALID',
      'A bounded account ID and wallet address are required.',
      correlationId,
    );
  const issuedAt = new Date().toISOString();
  const validUntil = new Date(Date.now() + 120_000).toISOString();
  const nonce = `0x${randomBytes(32).toString('hex')}`;
  try {
    const typedData = buildWalletReadAuthorizationTypedData({
      accountId,
      address,
      issuedAt,
      validUntil,
      nonce,
    });
    return apiJson({
      schemaVersion: '0.1',
      status: 'AWAITING_WALLET_READ_SIGNATURE',
      accountId,
      address,
      chainId: 10_143,
      issuedAt,
      validUntil,
      nonce,
      typedData,
      executionEnabled: false,
      correlationId,
    });
  } catch {
    return apiError(
      422,
      'WALLET_READ_CHALLENGE_INVALID',
      'The bounded read authorization could not be created.',
      correlationId,
    );
  }
}

export async function POST(request: Request) {
  const parsed = await parseM03Request(request, M04ReadModelRequestSchema, {
    code: 'WALLET_READ_AUTHORIZATION_INVALID',
    message: 'A fresh wallet-signed read authorization for this exact account is required.',
  });
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  const now = new Date().toISOString();
  let typedData;
  try {
    typedData = buildWalletReadAuthorizationTypedData({
      accountId: input.accountId,
      address: input.address,
      issuedAt: input.issuedAt,
      validUntil: input.validUntil,
      nonce: input.nonce,
    });
  } catch {
    return apiError(
      422,
      'WALLET_READ_AUTHORIZATION_INVALID',
      'The signed read challenge is malformed or outside its short expiry.',
      parsed.correlationId,
    );
  }
  const proof = await verifyWalletReadAuthorization({
    accountId: input.accountId,
    address: input.address,
    typedData,
    signature: input.signature,
    now,
  });
  if (!proof)
    return apiError(
      403,
      'WALLET_READ_SIGNATURE_INVALID',
      'The wallet did not authorize this exact read request.',
      parsed.correlationId,
    );
  return withM03Database(
    {
      correlationId: parsed.correlationId,
      unavailable: { code: 'DATABASE_UNAVAILABLE', message: 'Permission status is unavailable.' },
      failure: {
        code: 'M04_READ_AUTHORIZATION_FAILED',
        message: 'Wallet read authority could not be verified.',
      },
      onError: () =>
        apiError(
          409,
          'WALLET_READ_REPLAY_OR_BINDING_CHANGED',
          'The read nonce was consumed or the wallet binding changed.',
          parsed.correlationId,
        ),
    },
    async (pool) => {
      const consumed = await consumeM04ReadAccess(pool, {
        accountId: input.accountId,
        walletAddress: proof.address,
        nonceHash: proof.nonceHash,
        domainHash: proof.domainHash,
        occurredAt: now,
      });
      if (!consumed)
        return apiError(
          409,
          'WALLET_READ_REPLAY_OR_BINDING_CHANGED',
          'The signed wallet is not currently bound to this account or the nonce was already used.',
          parsed.correlationId,
        );
      const [status, evidence] = await Promise.all([
        listM04PermissionReadModel(pool, input.accountId),
        verifyM04PermissionEvidence(pool),
      ]);
      if (!evidence.verified)
        return apiError(
          503,
          'M04_EVIDENCE_CHAIN_UNVERIFIED',
          'Permission evidence integrity is not verified.',
          parsed.correlationId,
        );
      return apiJson({
        ...status,
        evidenceIntegrity: 'VERIFIED',
        evidenceCount: evidence.count,
        evidenceHeadHash: evidence.lastHash,
        executionEnabled: false,
        correlationId: parsed.correlationId,
      });
    },
  );
}
