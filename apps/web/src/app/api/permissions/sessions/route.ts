import { loadM04CompiledGrant, latestM04DelegationObservation, persistM04Session } from '@nerva/db';
import { M04SessionRequestSchema } from '@nerva/contracts';
import { deriveSessionAuthority } from '@nerva/permissions';
import { apiError, apiJson, parseM03Request, withM03Database } from '../../../../server/m03-api.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = await parseM03Request(request, M04SessionRequestSchema, {
    code: 'M04_SESSION_INVALID',
    message: 'A strict grant-subset session is required.',
  });
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  const now = new Date().toISOString();
  return withM03Database(
    {
      correlationId: parsed.correlationId,
      unavailable: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Session authority cannot be persisted.',
      },
      failure: {
        code: 'M04_SESSION_FAILED',
        message: 'The session is not a valid subset of a current grant.',
      },
      onError: () =>
        apiError(
          409,
          'M04_SESSION_CONFLICT',
          'The parent grant changed or this session was already issued.',
          parsed.correlationId,
        ),
    },
    async (pool) => {
      const loaded = await loadM04CompiledGrant(pool, input.grantId);
      if (!loaded || loaded.revoked || loaded.grant.revocationGeneration !== loaded.generation)
        return apiError(
          403,
          'ACTIVE_GRANT_REQUIRED',
          'A current non-revoked parent grant is required.',
          parsed.correlationId,
        );
      const delegation = await latestM04DelegationObservation(pool, loaded.grant.walletAddress);
      if (
        !delegation ||
        !['ABSENT', 'ACTIVE'].includes(delegation.observation.status) ||
        Date.parse(now) - Date.parse(delegation.observedAt) < 0 ||
        Date.parse(now) - Date.parse(delegation.observedAt) > 30_000 ||
        delegation.observation.status !== loaded.grant.delegation.status ||
        (delegation.observation.status === 'ACTIVE' &&
          (delegation.observation.delegateAddress?.toLowerCase() !==
            loaded.grant.delegation.delegateAddress?.toLowerCase() ||
            delegation.observation.delegateCodeHash !== loaded.grant.delegation.delegateCodeHash))
      )
        return apiError(
          409,
          'DELEGATION_AUTHORITY_INVALID',
          'The parent delegation authority is unknown or changed.',
          parsed.correlationId,
        );
      let session;
      try {
        session = await deriveSessionAuthority({
          sessionId: input.sessionId,
          grant: loaded.grant,
          actions: input.actions,
          maxActionFractionBps: input.maxActionFractionBps,
          maxNotionalMicros: input.maxNotionalMicros,
          maxSlippageBps: input.maxSlippageBps,
          expiresAt: input.expiresAt,
          nonceDomain: input.nonceDomain,
          now,
        });
      } catch {
        return apiError(
          422,
          'M04_SESSION_OUTSIDE_GRANT',
          'The session exceeds or outlives its parent grant.',
          parsed.correlationId,
        );
      }
      await persistM04Session(pool, session);
      return apiJson(
        {
          schemaVersion: '0.1',
          status: 'ISSUED',
          session: {
            sessionId: session.sessionId,
            grantId: session.grantId,
            sessionHash: session.digest,
            chainId: session.chainId,
            accountId: session.accountId,
            walletAddress: session.walletAddress,
            agentId: session.agentId,
            policyHash: session.policyHash,
            actions: session.actions,
            maxActionFractionBps: session.maxActionFractionBps,
            maxNotionalMicros: session.maxNotionalMicros,
            maxSlippageBps: session.maxSlippageBps,
            issuedAt: session.issuedAt,
            expiresAt: session.expiresAt,
            revocationGeneration: session.revocationGeneration,
          },
          executionEnabled: false,
          correlationId: parsed.correlationId,
        },
        201,
      );
    },
  );
}
