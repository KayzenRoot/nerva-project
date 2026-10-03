import { z } from 'zod';
import {
  appendM03DryRun,
  appendM03ExecutionPlan,
  appendM03PlanningRefusal,
  createDatabase,
} from '@nerva/db';
import { loadServerConfig } from '@nerva/config';
import { planM03Action, simulateM03Plan } from '@nerva/policy';
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
      'SIMULATION_REQUEST_INVALID',
      'The simulation request is invalid.',
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
    const now = new Date().toISOString();
    const evaluated = await evaluateCurrentM03Policy({
      pool,
      policyValue: parsed.data.policy,
      proofValue: parsed.data.proof,
      now,
    });
    if (!evaluated.ok)
      return apiError(
        evaluated.status,
        evaluated.code,
        'The plan cannot be simulated.',
        correlation,
      );
    if (evaluated.evaluation.result !== 'MATCH')
      return apiJson(
        {
          schemaVersion: '0.1',
          status: 'REFUSED',
          reason: evaluated.evaluation.reason,
          correlationId: correlation,
          simulation: null,
        },
        409,
      );
    const planned = await planM03Action({
      policy: evaluated.policy,
      evaluation: evaluated.evaluation,
      risk: evaluated.risk,
      now,
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
          simulation: null,
        },
        409,
      );
    }
    const simulation = await simulateM03Plan({
      plan: planned.plan,
      policy: evaluated.policy,
      risk: evaluated.risk,
      now,
    });
    await appendM03ExecutionPlan(pool, planned.plan);
    await appendM03DryRun(pool, simulation);
    return apiJson(
      {
        schemaVersion: '0.1',
        status: simulation.status,
        correlationId: planned.plan.correlationId,
        planDigest: planned.plan.digest,
        simulation,
        authority: simulation.authority,
        safety: { executionEnabled: false, providerPreflight: 'UNAVAILABLE_UNPROVEN' },
      },
      simulation.status === 'PASS' ? 201 : 409,
    );
  } catch {
    return apiError(
      503,
      'SIMULATION_PERSISTENCE_UNAVAILABLE',
      'The simulation could not be durably recorded.',
      correlation,
    );
  } finally {
    await pool.end();
  }
}
