import {
  M03ActorConfirmationProofSchema,
  M03PolicySchemaV0_1,
  RiskSnapshotM02Schema,
} from '@nerva/contracts';
import { appendM03TriggerEvaluation, latestM03EffectAt, latestRiskSnapshot } from '@nerva/db';
import type { Pool } from 'pg';
import { canonicalHash, type RiskSnapshot } from '@nerva/domain';
import { compileM03Policy, confirmM03Policy, evaluateM03Triggers } from '@nerva/policy';
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
