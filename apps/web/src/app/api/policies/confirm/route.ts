import { z } from 'zod';
import { M03ActorConfirmationProofSchema, M03PolicySchemaV0_1 } from '@nerva/contracts';
import { appendM03PolicyConfirmation } from '@nerva/db';
import { canonicalHash } from '@nerva/domain';
import { compileM03Policy, confirmM03Policy } from '@nerva/policy';
import { apiError, apiJson, parseM03Request, withM03Database } from '../../../../server/m03-api.ts';
import {
  createM03ActorVerifier,
  createM03NonceLedger,
  hasM03TrustedIssuers,
} from '../../../../server/m03-trust.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RequestSchema = z
  .object({
    schemaVersion: z.literal('0.1'),
    policy: M03PolicySchemaV0_1,
    proof: M03ActorConfirmationProofSchema,
    correlationId: z.string().min(1).max(200),
  })
  .strict();

export async function POST(request: Request) {
  const parsed = await parseM03Request(request, RequestSchema, {
    code: 'CONFIRMATION_REQUEST_INVALID',
    message: 'The policy or actor proof is invalid.',
  });
  if (!parsed.ok) return parsed.response;
  const correlation = parsed.correlationId;
  if (!hasM03TrustedIssuers())
    return apiError(
      503,
      'ACTOR_ISSUER_REGISTRY_UNAVAILABLE',
      'No trusted actor issuer keys are configured.',
      correlation,
    );
  return withM03Database(
    {
      correlationId: correlation,
      unavailable: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Policy confirmation persistence is unavailable.',
      },
      failure: {
        code: 'POLICY_CONFIRMATION_FAILED',
        message: 'Actor confirmation was not accepted.',
      },
      onError(error) {
        const reason = error instanceof Error ? error.message : 'POLICY_CONFIRMATION_FAILED';
        const status = reason.includes('UNAVAILABLE') ? 503 : reason.includes('REPLAY') ? 409 : 403;
        return apiError(status, reason, 'Actor confirmation was not accepted.', correlation);
      },
    },
    async (pool) => {
      const compiled = await compileM03Policy(parsed.data.policy);
      if (!compiled.ok || !compiled.policy)
        return apiJson(
          {
            schemaVersion: '0.1',
            status: 'INVALID',
            correlationId: correlation,
            diagnostics: compiled.diagnostics,
          },
          422,
        );
      const confirmed = await confirmM03Policy({
        compiled: compiled.policy,
        proof: parsed.data.proof,
        verifier: createM03ActorVerifier(),
        nonceLedger: createM03NonceLedger(pool),
        now: new Date().toISOString(),
      });
      const policyVersionHash = await canonicalHash(confirmed.compiled.policy);
      await appendM03PolicyConfirmation(pool, {
        policyId: confirmed.compiled.policyId,
        version: confirmed.compiled.version,
        environment: confirmed.compiled.policy.environment as
          'LOCAL' | 'TESTNET_DEMO' | 'TESTNET' | 'MAINNET_READONLY',
        payload: confirmed.compiled.policy,
        canonicalHash: policyVersionHash,
        actorRef: confirmed.actorId,
        issuerRef: confirmed.issuerId,
        proofRefHash: confirmed.proofRefHash,
        confirmedAt: confirmed.confirmedAt,
        correlationId: correlation,
      });
      return apiJson(
        {
          schemaVersion: '0.1',
          status: 'ACTIVE',
          correlationId: correlation,
          policyId: confirmed.compiled.policyId,
          version: confirmed.compiled.version,
          policyVersionHash,
          actorRef: confirmed.actorId,
          issuerRef: confirmed.issuerId,
          proofRefHash: confirmed.proofRefHash,
          executionEnabled: false,
        },
        201,
      );
    },
  );
}
