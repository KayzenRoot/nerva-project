import { loadCurrentM04Wallet, unbindM04Wallet } from '@nerva/db';
import { M04WalletUnbindingRequestSchema } from '@nerva/contracts';
import { buildWalletUnbindingTypedData, verifyWalletUnbinding } from '@nerva/permissions';
import { apiError, apiJson, withM04DatabaseRequest } from '../../../../server/m03-api.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return withM04DatabaseRequest(
    request,
    M04WalletUnbindingRequestSchema,
    {
      invalid: {
        code: 'M04_UNBINDING_INVALID',
        message: 'A wallet-owner proof for the current binding is required.',
      },
      unavailable: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Wallet authority cannot be unbound safely.',
      },
      failure: {
        code: 'M04_UNBINDING_FAILED',
        message: 'Wallet unbinding could not be persisted.',
      },
      conflict: {
        code: 'M04_UNBINDING_CONFLICT',
        message: 'The unbinding proof is replayed or the wallet state changed.',
      },
    },
    async (pool, input, correlationId) => {
      const now = new Date().toISOString();
      const wallet = await loadCurrentM04Wallet(pool, input.accountId);
      if (!wallet || wallet.address.toLowerCase() !== input.address.toLowerCase())
        return apiError(
          404,
          'CURRENT_WALLET_BINDING_NOT_FOUND',
          'The current wallet binding does not match this request.',
          correlationId,
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
          correlationId,
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
          correlationId,
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
          correlationId: correlationId,
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
          correlationId,
        );
      const removed = await unbindM04Wallet(pool, {
        accountId: input.accountId,
        walletAddress: input.address,
        nonceHash: verified.nonceHash,
        domainHash: verified.digest,
        proofRefHash: verified.proofRefHash,
        correlationId: correlationId,
        occurredAt: now,
        expectedGeneration: generation,
      });
      if (!removed)
        return apiError(
          409,
          'M04_WALLET_STATE_CHANGED',
          'Revocation or unbinding changed before the operation committed.',
          correlationId,
        );
      return apiJson({
        schemaVersion: '0.1',
        status: 'UNBOUND',
        accountId: input.accountId,
        walletAddress: input.address,
        invalidatedGrantCount: 'all-current-grants',
        executionEnabled: false,
        correlationId: correlationId,
      });
    },
  );
}
