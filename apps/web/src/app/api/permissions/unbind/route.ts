import { loadCurrentM04Wallet, unbindM04Wallet } from '@nerva/db';
import { M04WalletUnbindingRequestSchema } from '@nerva/contracts';
import { buildWalletUnbindingTypedData, verifyWalletUnbinding } from '@nerva/permissions';
import { apiError, apiJson, parseM03Request, withM03Database } from '../../../../server/m03-api.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = await parseM03Request(request, M04WalletUnbindingRequestSchema, {
    code: 'M04_UNBINDING_INVALID',
    message: 'A wallet-owner proof for the current binding is required.',
  });
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  const now = new Date().toISOString();
  return withM03Database(
    {
      correlationId: parsed.correlationId,
      unavailable: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Wallet authority cannot be unbound safely.',
      },
      failure: {
        code: 'M04_UNBINDING_FAILED',
        message: 'Wallet unbinding could not be persisted.',
      },
      onError: () =>
        apiError(
          409,
          'M04_UNBINDING_CONFLICT',
          'The unbinding proof is replayed or the wallet state changed.',
          parsed.correlationId,
        ),
    },
    async (pool) => {
      const wallet = await loadCurrentM04Wallet(pool, input.accountId);
      if (!wallet || wallet.address.toLowerCase() !== input.address.toLowerCase())
        return apiError(
          404,
          'CURRENT_WALLET_BINDING_NOT_FOUND',
          'The current wallet binding does not match this request.',
          parsed.correlationId,
        );
      const current = await pool.query<{ generation: number }>(
        `SELECT generation FROM m04_wallet_bindings WHERE account_id=$1 AND chain_id=10143
       AND lower(wallet_address)=lower($2) ORDER BY generation DESC LIMIT 1`,
        [input.accountId, input.address],
      );
      const generation = current.rows[0]?.generation;
      if (!generation || generation !== input.bindingGeneration)
        return apiError(
          409,
          'WALLET_BINDING_GENERATION_CHANGED',
          'The signed wallet binding generation is stale.',
          parsed.correlationId,
        );
      let typedData;
      try {
        typedData = buildWalletUnbindingTypedData({
          accountId: input.accountId,
          address: input.address,
          bindingGeneration: generation,
          issuedAt: input.issuedAt,
          validUntil: input.validUntil,
          nonce: input.nonce,
        });
      } catch {
        return apiError(
          422,
          'M04_UNBINDING_INVALID',
          'The unbinding message is outside the bounded domain.',
          parsed.correlationId,
        );
      }
      if (!input.signature)
        return apiJson({
          schemaVersion: '0.1',
          status: 'AWAITING_OWNER_SIGNATURE',
          accountId: input.accountId,
          address: input.address,
          bindingGeneration: generation,
          typedData,
          executionEnabled: false,
          correlationId: parsed.correlationId,
        });
      const verified = await verifyWalletUnbinding({
        accountId: input.accountId,
        address: input.address,
        bindingGeneration: generation,
        typedData,
        signature: input.signature,
        now,
      });
      if (!verified)
        return apiError(
          403,
          'M04_UNBINDING_SIGNATURE_INVALID',
          'The wallet owner did not authorize this exact unbinding.',
          parsed.correlationId,
        );
      const removed = await unbindM04Wallet(pool, {
        accountId: input.accountId,
        walletAddress: input.address,
        nonceHash: verified.nonceHash,
        domainHash: verified.digest,
        proofRefHash: verified.proofRefHash,
        correlationId: parsed.correlationId,
        occurredAt: now,
        expectedGeneration: generation,
      });
      if (!removed)
        return apiError(
          409,
          'M04_WALLET_STATE_CHANGED',
          'Revocation or unbinding changed before the operation committed.',
          parsed.correlationId,
        );
      return apiJson({
        schemaVersion: '0.1',
        status: 'UNBOUND',
        accountId: input.accountId,
        walletAddress: input.address,
        invalidatedGrantCount: 'all-current-grants',
        executionEnabled: false,
        correlationId: parsed.correlationId,
      });
    },
  );
}
