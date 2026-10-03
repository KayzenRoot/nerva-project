import { loadM04SessionForRevocation, revokeM04Session } from '@nerva/db';
import { M04SessionRevocationRequestSchema } from '@nerva/contracts';
import { buildSessionRevocationTypedData, verifySessionRevocation } from '@nerva/permissions';
import {
  apiError,
  apiJson,
  parseM03Request,
  withM03Database,
} from '../../../../../server/m03-api.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = await parseM03Request(request, M04SessionRevocationRequestSchema, {
    code: 'M04_SESSION_REVOCATION_INVALID',
    message: 'A fresh wallet-owner proof for the exact session is required.',
  });
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  const now = new Date().toISOString();
  return withM03Database(
    {
      correlationId: parsed.correlationId,
      unavailable: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Session authority cannot be revoked safely.',
      },
      failure: {
        code: 'M04_SESSION_REVOCATION_FAILED',
        message: 'The session revocation could not be verified or persisted.',
      },
      onError: () =>
        apiError(
          409,
          'M04_SESSION_REVOCATION_CONFLICT',
          'The session or parent grant changed, or this nonce was already consumed.',
          parsed.correlationId,
        ),
    },
    async (pool) => {
      const current = await loadM04SessionForRevocation(pool, input.sessionId);
      if (!current)
        return apiError(
          404,
          'SESSION_NOT_FOUND',
          'No current session with verifiable parent authority was found.',
          parsed.correlationId,
        );
      if (current.revoked || current.grantRevoked)
        return apiJson({
          schemaVersion: '0.1',
          status: 'REVOKED',
          sessionId: current.sessionId,
          revocationGeneration: current.generation,
          reason: current.revoked ? 'SESSION_ALREADY_REVOKED' : 'PARENT_GRANT_REVOKED',
          executionEnabled: false,
          correlationId: parsed.correlationId,
        });
      let typedData;
      try {
        typedData = buildSessionRevocationTypedData({
          sessionId: current.sessionId,
          sessionHash: current.sessionHash,
          grant: current.grant,
          revocationGeneration: current.generation,
          issuedAt: input.issuedAt,
          validUntil: input.validUntil,
          nonce: input.nonce,
        });
      } catch {
        return apiError(
          422,
          'M04_SESSION_REVOCATION_INVALID',
          'The session revocation message is outside the bounded domain.',
          parsed.correlationId,
        );
      }
      if (!input.signature)
        return apiJson({
          schemaVersion: '0.1',
          status: 'AWAITING_OWNER_SIGNATURE',
          sessionId: current.sessionId,
          sessionHash: current.sessionHash,
          typedData,
          executionEnabled: false,
          correlationId: parsed.correlationId,
        });
      const verified = await verifySessionRevocation({
        sessionId: current.sessionId,
        sessionHash: current.sessionHash,
        grant: current.grant,
        generation: current.generation,
        typedData,
        signature: input.signature,
        now,
      });
      if (!verified)
        return apiError(
          403,
          'M04_SESSION_REVOCATION_SIGNATURE_INVALID',
          'The wallet owner did not authorize this exact session revocation.',
          parsed.correlationId,
        );
      const generation = await revokeM04Session(pool, {
        sessionId: current.sessionId,
        sessionHash: current.sessionHash,
        expectedGeneration: current.generation,
        grantGeneration: current.grantGeneration,
        nonceHash: verified.nonceHash,
        domainHash: verified.digest,
        proofRefHash: verified.proofRefHash,
        occurredAt: now,
      });
      if (generation === undefined)
        return apiError(
          409,
          'M04_SESSION_AUTHORITY_CHANGED',
          'The session, wallet binding or parent grant changed before revocation committed.',
          parsed.correlationId,
        );
      return apiJson({
        schemaVersion: '0.1',
        status: 'REVOKED',
        sessionId: current.sessionId,
        revocationGeneration: generation,
        proofRefHash: verified.proofRefHash,
        executionEnabled: false,
        correlationId: parsed.correlationId,
      });
    },
  );
}
