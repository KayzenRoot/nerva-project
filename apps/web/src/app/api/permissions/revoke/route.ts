import { loadM04CompiledGrant, revokeM04Grant } from '@nerva/db';
import { M04GrantRevocationRequestSchema } from '@nerva/contracts';
import { buildGrantRevocationTypedData, verifyGrantRevocation } from '@nerva/permissions';
import { apiError, apiJson, parseM03Request, withM03Database } from '../../../../server/m03-api.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = await parseM03Request(request, M04GrantRevocationRequestSchema, {
    code: 'M04_REVOCATION_INVALID',
    message: 'A fresh wallet-owner revocation proof is required.',
  });
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  const now = new Date().toISOString();
  return withM03Database(
    {
      correlationId: parsed.correlationId,
      unavailable: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Grant authority cannot be revoked safely.',
      },
      failure: {
        code: 'M04_REVOCATION_FAILED',
        message: 'The grant revocation could not be persisted.',
      },
      onError: () =>
        apiError(
          409,
          'M04_REVOCATION_CONFLICT',
          'The revocation proof is replayed or the grant changed.',
          parsed.correlationId,
        ),
    },
    async (pool) => {
      const loaded = await loadM04CompiledGrant(pool, input.grantId);
      if (!loaded)
        return apiError(
          404,
          'GRANT_NOT_FOUND',
          'No current owner-bound grant was found.',
          parsed.correlationId,
        );
      let typedData;
      try {
        typedData = buildGrantRevocationTypedData({
          grant: loaded.grant,
          reasonCode: input.reasonCode,
          revocationGeneration: loaded.generation,
          issuedAt: input.issuedAt,
          validUntil: input.validUntil,
          nonce: input.nonce,
        });
      } catch {
        return apiError(
          422,
          'M04_REVOCATION_INVALID',
          'The revocation message is outside the bounded domain.',
          parsed.correlationId,
        );
      }
      if (!input.signature)
        return apiJson({
          schemaVersion: '0.1',
          status: 'AWAITING_OWNER_SIGNATURE',
          grantId: input.grantId,
          revocationGeneration: loaded.generation,
          typedData,
          executionEnabled: false,
          correlationId: parsed.correlationId,
        });
      const verified = await verifyGrantRevocation({
        grant: loaded.grant,
        reasonCode: input.reasonCode,
        generation: loaded.generation,
        typedData,
        signature: input.signature,
        now,
      });
      if (!verified)
        return apiError(
          403,
          'M04_REVOCATION_SIGNATURE_INVALID',
          'The wallet owner did not authorize this exact revocation.',
          parsed.correlationId,
        );
      const generation = await revokeM04Grant(pool, {
        grantId: input.grantId,
        actorRef: loaded.grant.accountId,
        reasonCode: input.reasonCode,
        nonceHash: verified.nonceHash,
        domainHash: verified.digest,
        proofRefHash: verified.proofRefHash,
        occurredAt: now,
      });
      if (generation === undefined)
        return apiError(
          404,
          'GRANT_NOT_FOUND',
          'The grant no longer exists.',
          parsed.correlationId,
        );
      return apiJson({
        schemaVersion: '0.1',
        status: 'REVOKED',
        grantId: input.grantId,
        revocationGeneration: generation,
        proofRefHash: verified.proofRefHash,
        executionEnabled: false,
        correlationId: parsed.correlationId,
      });
    },
  );
}
