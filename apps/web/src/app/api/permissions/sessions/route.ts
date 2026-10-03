import { loadM04CompiledGrant, latestM04DelegationObservation, persistM04Session } from '@nerva/db';
import { M04SessionRequestSchema } from '@nerva/contracts';
import {
  buildSessionIssuanceTypedData,
  deriveSessionAuthority,
  isCurrentM04DelegationObservation,
  verifySessionIssuance,
} from '@nerva/permissions';
import { apiError, apiJson, withM04DatabaseRequest } from '../../../../server/m03-api.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return withM04DatabaseRequest(
    request,
    M04SessionRequestSchema,
    {
      invalid: {
        code: 'M04_SESSION_INVALID',
        message: 'A strict, owner-authorized grant-subset session is required.',
      },
      unavailable: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Session authority cannot be verified or persisted.',
      },
      failure: {
        code: 'M04_SESSION_FAILED',
        message: 'The session is not a valid subset of a current grant.',
      },
      conflict: {
        code: 'M04_SESSION_CONFLICT',
        message: 'The parent grant changed or this session authorization was already consumed.',
      },
    },
    async (pool, input, correlationId) => {
      const now = new Date().toISOString();
      const loaded = await loadM04CompiledGrant(pool, input.grantId);
      if (
        !loaded ||
        loaded.revoked ||
        loaded.grant.revocationGeneration !== loaded.generation ||
        Date.parse(loaded.grant.expiresAt) <= Date.parse(now)
      )
        return apiError(
          403,
          'ACTIVE_GRANT_REQUIRED',
          'A current non-revoked parent grant is required.',
          correlationId,
        );
      const delegation = await latestM04DelegationObservation(pool, loaded.grant.walletAddress);
      if (
        !isCurrentM04DelegationObservation({
          expected: loaded.grant.delegation,
          observation: delegation?.observation,
          observedAt: delegation?.observedAt,
          now,
        })
      )
        return apiError(
          409,
          'DELEGATION_AUTHORITY_INVALID',
          'The parent delegation authority is unknown, stale or changed.',
          correlationId,
        );

      let session;
      let typedData;
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
          now: input.issuedAt,
        });
        typedData = buildSessionIssuanceTypedData({
          session,
          nonce: input.nonce,
          validUntil: input.validUntil,
        });
      } catch {
        return apiError(
          422,
          'M04_SESSION_OUTSIDE_GRANT',
          'The session exceeds or outlives its parent grant, or has an invalid issuance challenge.',
          correlationId,
        );
      }

      if (!input.signature)
        return apiJson(
          {
            schemaVersion: '0.1',
            status: 'AWAITING_OWNER_SIGNATURE',
            sessionId: session.sessionId,
            sessionHash: session.digest,
            typedData,
            executionEnabled: false,
            correlationId,
          },
          200,
        );

      const verified = await verifySessionIssuance({
        session,
        typedData,
        signature: input.signature,
        now,
      });
      if (!verified)
        return apiError(
          403,
          'M04_SESSION_OWNER_SIGNATURE_INVALID',
          'The currently bound wallet owner did not authorize this exact session issuance.',
          correlationId,
        );

      const persisted = await persistM04Session(pool, session, {
        proofRefHash: verified.proofRefHash,
        typedDataDigest: verified.digest,
        nonceHash: verified.nonceHash,
      });
      if (!persisted)
        return apiError(
          409,
          'M04_SESSION_AUTHORITY_CHANGED',
          'The session nonce was replayed or its parent authority changed before commit.',
          correlationId,
        );

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
            issuanceProofRefHash: verified.proofRefHash,
          },
          executionEnabled: false,
          correlationId,
        },
        201,
      );
    },
  );
}
