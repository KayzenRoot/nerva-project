import { z } from 'zod';
import { M03ActorConfirmationProofSchema, M03PolicySchemaV0_1 } from '@nerva/contracts';
import { appendM03PolicyConfirmation, createDatabase } from '@nerva/db';
import { loadServerConfig } from '@nerva/config';
import { canonicalHash } from '@nerva/domain';
import { compileM03Policy, confirmM03Policy } from '@nerva/policy';
import { apiError, apiJson, correlationId, readM03Json } from '../../../../server/m03-api.ts';
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
  const body = await readM03Json(request);
  const correlation = correlationId(request, body.ok ? body.value : undefined);
  if (!body.ok)
    return apiError(400, 'INVALID_JSON', 'A bounded JSON body is required.', correlation);
  const parsed = RequestSchema.safeParse(body.value);
  if (!parsed.success)
    return apiError(
      422,
      'CONFIRMATION_REQUEST_INVALID',
      'The policy or actor proof is invalid.',
      correlation,
    );
  if (parsed.data.correlationId !== correlation)
    return apiError(
      400,
      'CORRELATION_MISMATCH',
      'The body and request correlation identifiers must match.',
      correlation,
    );
  if (!hasM03TrustedIssuers())
    return apiError(
      503,
      'ACTOR_ISSUER_REGISTRY_UNAVAILABLE',
      'No trusted actor issuer keys are configured.',
      correlation,
    );
  const config = loadServerConfig();
  if (!config.databaseUrl)
    return apiError(
      503,
      'DATABASE_UNAVAILABLE',
      'Policy confirmation persistence is unavailable.',
      correlation,
    );
  const { pool } = createDatabase(config);
  try {
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
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'POLICY_CONFIRMATION_FAILED';
    const status = reason.includes('UNAVAILABLE') ? 503 : reason.includes('REPLAY') ? 409 : 403;
    return apiError(status, reason, 'Actor confirmation was not accepted.', correlation);
  } finally {
    await pool.end();
  }
}
