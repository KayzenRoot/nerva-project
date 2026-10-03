import { loadM04CompiledGrant, revokeM04Grant } from '@nerva/db';
import { M04GrantRevocationRequestSchema } from '@nerva/contracts';
import { buildGrantRevocationTypedData, verifyGrantRevocation } from '@nerva/permissions';
import { apiError, apiJson, withM04DatabaseRequest } from '../../../../server/m03-api.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return withM04DatabaseRequest(
    request,
    M04GrantRevocationRequestSchema,
    {
      invalid: {
        code: 'M04_REVOCATION_INVALID',
        message: 'A fresh wallet-owner revocation proof is required.',
      },
      unavailable: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Grant authority cannot be revoked safely.',
      },
      failure: {
        code: 'M04_REVOCATION_FAILED',
        message: 'The grant revocation could not be persisted.',
      },
      conflict: {
        code: 'M04_REVOCATION_CONFLICT',
        message: 'The revocation proof is replayed or the grant changed.',
      },
    },
    async (pool, input, correlationId) => {
      const now = new Date().toISOString();
      const loaded = await loadM04CompiledGrant(pool, input.grantId);
      if (!loaded)
        return apiError(
          404,
          'GRANT_NOT_FOUND',
          'No current owner-bound grant was found.',
          correlationId,
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
          correlationId,
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
          correlationId: correlationId,
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
          correlationId,
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
        return apiError(404, 'GRANT_NOT_FOUND', 'The grant no longer exists.', correlationId);
      return apiJson({
        schemaVersion: '0.1',
        status: 'REVOKED',
        grantId: input.grantId,
        revocationGeneration: generation,
        proofRefHash: verified.proofRefHash,
        executionEnabled: false,
        correlationId: correlationId,
      });
    },
  );
}
