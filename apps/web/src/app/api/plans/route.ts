import { z } from 'zod';
import { appendM03ExecutionPlan, appendM03PlanningRefusal, createDatabase } from '@nerva/db';
import { loadServerConfig } from '@nerva/config';
import { planM03Action } from '@nerva/policy';
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
      'PLAN_REQUEST_INVALID',
      'The policy planning request is invalid.',
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
    const evaluated = await evaluateCurrentM03Policy({
      pool,
      policyValue: parsed.data.policy,
      proofValue: parsed.data.proof,
      now: new Date().toISOString(),
    });
    if (!evaluated.ok)
      return apiError(
        evaluated.status,
        evaluated.code,
        'The policy cannot be planned.',
        correlation,
      );
    if (evaluated.evaluation.result !== 'MATCH')
      return apiJson(
        {
          schemaVersion: '0.1',
          status: 'REFUSED',
          reason: evaluated.evaluation.reason,
          correlationId: correlation,
          evaluation: evaluated.evaluation,
        },
        409,
      );
    const planned = await planM03Action({
      policy: evaluated.policy,
      evaluation: evaluated.evaluation,
      risk: evaluated.risk,
      now: new Date().toISOString(),
    });
    if (planned.status !== 'PLANNED') {
      await appendM03PlanningRefusal(pool, {
        evaluationId: evaluated.evaluation.evaluationId,
        policyId: evaluated.policy.compiled.policyId,
        policyVersionHash: evaluated.policy.compiled.canonicalHash,
        snapshotHash: evaluated.evaluation.sourceSnapshotHash,
        reason: planned.reason,
        actorRef: evaluated.policy.actorId,
        correlationId: correlation,
        occurredAt: new Date().toISOString(),
      });
      return apiJson(
        {
          schemaVersion: '0.1',
          status: 'REFUSED',
          reason: planned.reason,
          correlationId: correlation,
          evaluation: evaluated.evaluation,
        },
        409,
      );
    }
    await appendM03ExecutionPlan(pool, planned.plan);
    return apiJson(
      {
        schemaVersion: '0.1',
        status: 'PLANNED',
        correlationId: planned.plan.correlationId,
        plan: planned.plan,
        authority:
          planned.plan.action === 'NO_ACTION'
            ? 'NO_FINANCIAL_EFFECT'
            : 'BOUNDED_TESTNET_PLAN_PENDING_SIMULATION_AND_PROOFS',
        safety: { executionEnabled: false },
      },
      201,
    );
  } catch {
    return apiError(
      503,
      'PLAN_PERSISTENCE_UNAVAILABLE',
      'The plan could not be durably recorded.',
      correlation,
    );
  } finally {
    await pool.end();
  }
}
