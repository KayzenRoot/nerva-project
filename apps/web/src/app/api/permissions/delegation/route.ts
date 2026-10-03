import {
  latestM04DelegationObservation,
  loadCurrentM04Wallet,
  persistM04DelegationObservation,
} from '@nerva/db';
import { M04DelegationObserveRequestSchema } from '@nerva/contracts';
import { observeEip7702Delegation } from '@nerva/permissions';
import { apiError, apiJson, parseM03Request, withM03Database } from '../../../../server/m03-api.ts';
import { createMonadTestnetDelegationReadPort } from '../../../../server/monad-testnet-rpc.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = await parseM03Request(request, M04DelegationObserveRequestSchema, {
    code: 'DELEGATION_OBSERVATION_INVALID',
    message: 'A current wallet account is required.',
  });
  if (!parsed.ok) return parsed.response;
  const now = new Date().toISOString();
  return withM03Database(
    {
      correlationId: parsed.correlationId,
      unavailable: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Delegation state cannot be persisted.',
      },
      failure: {
        code: 'DELEGATION_OBSERVATION_FAILED',
        message: 'The read-only delegation observation is unknown.',
      },
    },
    async (pool) => {
      const wallet = await loadCurrentM04Wallet(pool, parsed.data.accountId);
      if (!wallet)
        return apiError(
          403,
          'WALLET_BINDING_REQUIRED',
          'A current owner-verified wallet binding is required.',
          parsed.correlationId,
        );
      const previous = await latestM04DelegationObservation(pool, wallet.address);
      const observation = await observeEip7702Delegation({
        port: createMonadTestnetDelegationReadPort(),
        account: wallet.address,
        expectedChainId: 10_143,
        now,
        previous: previous?.observation,
      });
      await persistM04DelegationObservation(pool, {
        accountId: wallet.accountId,
        walletAddress: wallet.address,
        chainId: 10_143,
        observation,
        observedAt: now,
      });
      const status =
        observation.status === 'UNKNOWN'
          ? 503
          : observation.status === 'CHANGED' || observation.status === 'REVOKED'
            ? 409
            : 200;
      return apiJson(
        {
          schemaVersion: '0.1',
          status: observation.status,
          observation: {
            chainId: 10_143,
            walletAddress: wallet.address,
            delegateAddress: observation.delegateAddress ?? null,
            delegateCodeHash: observation.delegateCodeHash ?? null,
            blockNumber: observation.blockNumber ?? null,
            blockHash: observation.blockHash ?? null,
            observedAt: observation.observedAt ?? now,
            reason: observation.reason ?? null,
          },
          executionEnabled: false,
          authority: observation.status === 'UNKNOWN' ? 'BLOCKED' : 'OBSERVATION_ONLY',
          correlationId: parsed.correlationId,
        },
        status,
      );
    },
  );
}
