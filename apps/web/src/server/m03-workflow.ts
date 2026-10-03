import {
  M03ActorConfirmationProofSchema,
  M03PolicySchemaV0_1,
  RiskSnapshotM02Schema,
} from '@nerva/contracts';
import {
  appendM03DryRun,
  appendM03ExecutionPlan,
  appendM03PlanningRefusal,
  appendM03TriggerEvaluation,
  latestM03EffectAt,
  latestRiskSnapshot,
} from '@nerva/db';
import type { Pool } from 'pg';
import { canonicalHash, type RiskSnapshot } from '@nerva/domain';
import {
  compileM03Policy,
  confirmM03Policy,
  evaluateM03Triggers,
  planM03Action,
  simulateM03Plan,
} from '@nerva/policy';
import { createM03ActorVerifier, createM03NonceLedger } from './m03-trust.ts';

export type M03WorkflowResult =
  | Readonly<{ ok: false; status: number; code: string }>
  | Readonly<{
      ok: true;
      policy: Awaited<ReturnType<typeof confirmM03Policy>>;
      risk: RiskSnapshot;
      evaluation: Awaited<ReturnType<typeof evaluateM03Triggers>>;
    }>;

export async function evaluateCurrentM03Policy(input: {
  readonly pool: Pool;
  readonly policyValue: unknown;
  readonly proofValue: unknown;
  readonly now: string;
}): Promise<M03WorkflowResult> {
  const parsedPolicy = M03PolicySchemaV0_1.safeParse(input.policyValue);
  const parsedProof = M03ActorConfirmationProofSchema.safeParse(input.proofValue);
  if (!parsedPolicy.success || !parsedProof.success)
    return { ok: false, status: 422, code: 'POLICY_OR_CONFIRMATION_INVALID' };
  const compiled = await compileM03Policy(parsedPolicy.data);
  if (!compiled.ok || !compiled.policy)
    return { ok: false, status: 422, code: 'POLICY_COMPILATION_FAILED' };
  const policyHash = await canonicalHash(compiled.policy.policy);
  const persisted = await input.pool.query<{ state: string; content_hash: string }>(
    `SELECT p.state,v.content_hash FROM policies p JOIN policy_versions v ON v.policy_id=p.policy_id
     WHERE p.policy_id=$1 AND v.version=$2`,
    [compiled.policy.policyId, compiled.policy.version],
  );
  const current = persisted.rows[0];
  if (!current || current.content_hash !== policyHash)
    return { ok: false, status: 409, code: 'POLICY_VERSION_NOT_PERSISTED' };
  if (current.state !== 'ACTIVE') return { ok: false, status: 409, code: 'POLICY_NOT_ACTIVE' };
  const riskRaw = await latestRiskSnapshot(input.pool);
  const parsedRisk = RiskSnapshotM02Schema.safeParse(riskRaw);
  if (!parsedRisk.success)
    return { ok: false, status: 503, code: 'CURRENT_RISK_SNAPSHOT_UNAVAILABLE' };
  let confirmed: Awaited<ReturnType<typeof confirmM03Policy>>;
  try {
    confirmed = await confirmM03Policy({
      compiled: compiled.policy,
      proof: parsedProof.data,
      verifier: createM03ActorVerifier(),
      nonceLedger: createM03NonceLedger(input.pool),
      now: input.now,
    });
  } catch {
    return { ok: false, status: 403, code: 'FRESH_ACTOR_PROVENANCE_REQUIRED' };
  }
  const risk = parsedRisk.data as unknown as RiskSnapshot;
  const lastEffectAt = await latestM03EffectAt(input.pool, compiled.policy.versionId);
  const evaluation = await evaluateM03Triggers({
    policy: confirmed,
    risk,
    now: input.now,
    ...(lastEffectAt ? { lastEffectAt } : {}),
  });
  await appendM03TriggerEvaluation(input.pool, {
    evaluation,
    evaluationId: evaluation.evaluationId,
    policyVersionId: compiled.policy.versionId,
    policyVersionHash: evaluation.policyVersionHash,
    snapshotId: risk.snapshotId,
    snapshotHash: evaluation.sourceSnapshotHash,
    result: evaluation.result,
    reason: evaluation.reason,
    correlationId: evaluation.correlationId,
    evaluatedAt: evaluation.evaluatedAt,
  });
  return { ok: true, policy: confirmed, risk, evaluation };
}

export type M03PlanWorkflowResult =
  | Readonly<{ kind: 'INVALID'; status: number; code: string }>
  | Readonly<{
      kind: 'TRIGGER_REFUSED';
      evaluation: Awaited<ReturnType<typeof evaluateM03Triggers>>;
    }>
  | Readonly<{
      kind: 'PLAN_REFUSED';
      reason: string;
      evaluation: Awaited<ReturnType<typeof evaluateM03Triggers>>;
    }>
  | Readonly<{
      kind: 'PLANNED';
      evaluation: Awaited<ReturnType<typeof evaluateM03Triggers>>;
      plan: Extract<Awaited<ReturnType<typeof planM03Action>>, { status: 'PLANNED' }>['plan'];
      simulation?: Awaited<ReturnType<typeof simulateM03Plan>>;
    }>;

export async function prepareCurrentM03Plan(input: {
  readonly pool: Pool;
  readonly policyValue: unknown;
  readonly proofValue: unknown;
  readonly correlationId: string;
  readonly now: string;
  readonly simulate: boolean;
}): Promise<M03PlanWorkflowResult> {
  const evaluated = await evaluateCurrentM03Policy(input);
  if (!evaluated.ok) return { kind: 'INVALID', status: evaluated.status, code: evaluated.code };
  if (evaluated.evaluation.result !== 'MATCH')
    return { kind: 'TRIGGER_REFUSED', evaluation: evaluated.evaluation };
  const planned = await planM03Action({
    policy: evaluated.policy,
    evaluation: evaluated.evaluation,
    risk: evaluated.risk,
    now: input.now,
  });
  if (planned.status !== 'PLANNED') {
    await appendM03PlanningRefusal(input.pool, {
      evaluationId: evaluated.evaluation.evaluationId,
      policyId: evaluated.policy.compiled.policyId,
      policyVersionHash: evaluated.policy.compiled.canonicalHash,
      snapshotHash: evaluated.evaluation.sourceSnapshotHash,
      reason: planned.reason,
      actorRef: evaluated.policy.actorId,
      correlationId: input.correlationId,
      occurredAt: input.now,
    });
    return { kind: 'PLAN_REFUSED', reason: planned.reason, evaluation: evaluated.evaluation };
  }
  await appendM03ExecutionPlan(input.pool, planned.plan);
  if (!input.simulate)
    return { kind: 'PLANNED', evaluation: evaluated.evaluation, plan: planned.plan };
  const simulation = await simulateM03Plan({
    plan: planned.plan,
    policy: evaluated.policy,
    risk: evaluated.risk,
    now: input.now,
  });
  await appendM03DryRun(input.pool, simulation);
  return { kind: 'PLANNED', evaluation: evaluated.evaluation, plan: planned.plan, simulation };
}
