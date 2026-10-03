import { z } from 'zod';
import { createDatabase } from '@nerva/db';
import { loadServerConfig } from '@nerva/config';
import { apiError, apiJson, correlationId, readM03Json } from '../../../server/m03-api.ts';
import { hasM03TrustedIssuers } from '../../../server/m03-trust.ts';
import { evaluateCurrentM03Policy } from '../../../server/m03-workflow.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RequestSchema = z
  .object({
    schemaVersion: z.literal('0.1'),
    policy: z.unknown(),
    proof: z.unknown(),
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
      'EVALUATION_REQUEST_INVALID',
      'The policy evaluation request is invalid.',
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
      'The current risk and policy stores are unavailable.',
      correlation,
    );
  const { pool } = createDatabase(config);
  try {
    const result = await evaluateCurrentM03Policy({
      pool,
      policyValue: parsed.data.policy,
      proofValue: parsed.data.proof,
      now: new Date().toISOString(),
    });
    if (!result.ok)
      return apiError(
        result.status,
        result.code,
        'The policy evaluation was refused.',
        correlation,
      );
    return apiJson({
      schemaVersion: '0.1',
      status: result.evaluation.result,
      correlationId: result.evaluation.correlationId,
      evaluation: result.evaluation,
      policyVersionHash: result.policy.compiled.canonicalHash,
      sourceSnapshotHash: result.risk.snapshotHash,
      authority: 'DETERMINISTIC_RISK_ONLY',
      safety: { executionEnabled: false },
    });
  } catch {
    return apiError(
      503,
      'EVALUATION_PERSISTENCE_UNAVAILABLE',
      'The evaluation could not be durably recorded.',
      correlation,
    );
  } finally {
    await pool.end();
  }
}
