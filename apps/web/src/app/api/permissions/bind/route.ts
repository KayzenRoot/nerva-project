import { canonicalHash } from '@nerva/domain';
import { M04WalletBindingRequestSchema } from '@nerva/contracts';
import { recordM04WalletBinding } from '@nerva/db';
import { apiError, apiJson, parseM03Request, withM03Database } from '../../../../server/m03-api.ts';
import {
  buildWalletBindingTypedData,
  hashWalletBindingTypedData,
  verifyWalletIdentityBinding,
} from '@nerva/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = await parseM03Request(request, M04WalletBindingRequestSchema, {
    code: 'WALLET_BINDING_INVALID',
    message: 'A bounded Monad testnet wallet-binding proof is required.',
  });
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  const now = new Date().toISOString();
  let typedData;
  try {
    typedData = buildWalletBindingTypedData({
      accountId: input.accountId,
      address: input.address,
      issuedAt: input.issuedAt,
      validUntil: input.validUntil,
      nonce: input.nonce,
    });
  } catch {
    return apiError(
      422,
      'WALLET_BINDING_INVALID',
      'Wallet proof fields are invalid.',
      parsed.correlationId,
    );
  }
  if (!input.signature)
    return apiJson({
      schemaVersion: '0.1',
      status: 'AWAITING_OWNER_SIGNATURE',
      typedData,
      executionEnabled: false,
      correlationId: parsed.correlationId,
    });
  const identity = await verifyWalletIdentityBinding({
    typedData,
    signature: input.signature,
    expected: { accountId: input.accountId, address: input.address, now },
  });
  if (!identity)
    return apiError(
      403,
      'WALLET_BINDING_PROOF_INVALID',
      'The wallet signature or chain binding is invalid.',
      parsed.correlationId,
    );
  const nonceHash = await canonicalHash(input.nonce);
  const domainHash = hashWalletBindingTypedData(typedData);
  return withM03Database(
    {
      correlationId: parsed.correlationId,
      unavailable: { code: 'DATABASE_UNAVAILABLE', message: 'Wallet binding cannot be persisted.' },
      failure: {
        code: 'WALLET_BINDING_PERSISTENCE_FAILED',
        message: 'Wallet binding could not be durably recorded.',
      },
      onError: () =>
        apiError(
          409,
          'WALLET_BINDING_REPLAY_OR_CONFLICT',
          'The binding nonce was already used or the identity conflicts.',
          parsed.correlationId,
        ),
    },
    async (pool) => {
      await recordM04WalletBinding(pool, {
        identity,
        nonceHash,
        domainHash,
        correlationId: parsed.correlationId,
        occurredAt: now,
      });
      return apiJson(
        {
          schemaVersion: '0.1',
          status: 'BOUND',
          wallet: identity,
          executionEnabled: false,
          correlationId: parsed.correlationId,
        },
        201,
      );
    },
  );
}
