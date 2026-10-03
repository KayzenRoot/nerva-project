import {
  M03ActorConfirmationProofSchema,
  M03PolicySchemaV0_1,
  type M03PolicyV0_1,
} from '@nerva/contracts';
import {
  canonicalHash,
  canonicalSerialize,
  type PositionSnapshot,
  type RiskMetric,
  type RiskSnapshot,
} from '@nerva/domain';

const compiledPolicyVersions = new WeakSet<object>();
const confirmedPolicyVersions = new WeakSet<object>();
const executionPlans = new WeakSet<object>();
const verifiedPositionBindings = new WeakSet<object>();

export type PolicyLifecycleState = 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'EXPIRED';
export type M03Action = 'REDUCE_POSITION' | 'CLOSE_POSITION' | 'NO_ACTION';

export interface CompiledPolicyVersion {
  readonly schemaVersion: '0.1';
  readonly policyId: string;
  readonly version: number;
  readonly versionId: string;
  readonly canonicalHash: string;
  readonly canonicalBytes: string;
  readonly policy: Readonly<M03PolicyV0_1>;
}

export interface ConfirmedPolicyVersion {
  readonly compiled: CompiledPolicyVersion;
  readonly state: PolicyLifecycleState;
  readonly confirmedAt: string;
  readonly actorId: string;
  readonly issuerId: string;
  readonly proofRefHash: string;
}

export interface NonceLedger {
  /** Implementations must enforce uniqueness atomically across processes/restarts. */
  consume(issuer: string, nonce: string, purpose: string): Promise<boolean>;
}

export interface ActorProvenanceVerifier {
  /** Verify cryptographic evidence against an out-of-band trusted issuer/key registry. */
  verifyConfirmation(
    proof: Readonly<{
      schemaVersion: '0.1';
      issuer: string;
      subject: string;
      audience: 'nerva-policy-confirmation-v1';
      policyHash: string;
      nonce: string;
      keyId: string;
      issuedAt: string;
      expiresAt: string;
      signature: string;
    }>,
    expected: Readonly<{
      actorId: string;
      policyHash: string;
      now: string;
    }>,
  ): Promise<Readonly<{ issuerId: string; actorId: string; proofRef: string }> | undefined>;
}

export interface PolicyCompileResult {
  readonly ok: boolean;
  readonly policy?: CompiledPolicyVersion;
  readonly diagnostics: readonly string[];
}

export async function compileM03Policy(input: unknown): Promise<PolicyCompileResult> {
  const parsed = M03PolicySchemaV0_1.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      diagnostics: parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || '$'}: ${issue.message}`,
      ),
    };
  }
  const normalized: M03PolicyV0_1 = {
    ...parsed.data,
    triggers: [...parsed.data.triggers].sort((left, right) =>
      left.metric < right.metric ? -1 : left.metric > right.metric ? 1 : 0,
    ),
    constraints: {
      ...parsed.data.constraints,
      allowedProtocols: [...parsed.data.constraints.allowedProtocols].sort(compareCanonicalText),
      allowedMarkets: [...parsed.data.constraints.allowedMarkets].sort(compareCanonicalText),
    },
  };
  const frozen = deepFreeze(structuredClone(normalized));
  const canonicalBytes = canonicalSerialize(frozen);
  const version = Object.freeze({
    schemaVersion: '0.1' as const,
    policyId: frozen.policyId,
    version: frozen.version,
    versionId: `${frozen.policyId}:v${frozen.version}`,
    canonicalHash: await canonicalHash(frozen),
    canonicalBytes,
    policy: frozen,
  });
  compiledPolicyVersions.add(version);
  return { ok: true, policy: version, diagnostics: [] };
}

function compareCanonicalText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function isCompiledPolicyVersion(value: unknown): value is CompiledPolicyVersion {
  return (
    value !== null &&
    typeof value === 'object' &&
    compiledPolicyVersions.has(value) &&
    Object.isFrozen(value) &&
    /^[0-9a-f]{64}$/.test((value as CompiledPolicyVersion).canonicalHash)
  );
}

export function isConfirmedPolicyVersion(value: unknown): value is ConfirmedPolicyVersion {
  return (
    value !== null &&
    typeof value === 'object' &&
    confirmedPolicyVersions.has(value) &&
    Object.isFrozen(value) &&
    isCompiledPolicyVersion((value as ConfirmedPolicyVersion).compiled)
  );
}

/** Rehydrates only a persisted confirmation written after cryptographic verification. */
export function restoreConfirmedM03Policy(input: {
  readonly compiled: CompiledPolicyVersion;
  readonly persisted: Readonly<{
    state: string;
    canonicalHash: string;
    actorId: string;
    issuerId: string;
    proofRefHash: string;
    confirmedAt: string;
  }>;
  readonly now: string;
}): ConfirmedPolicyVersion | undefined {
  const now = Date.parse(input.now);
  const confirmedAt = Date.parse(input.persisted.confirmedAt);
  if (
    !isCompiledPolicyVersion(input.compiled) ||
    input.persisted.state !== 'ACTIVE' ||
    input.persisted.canonicalHash !== input.compiled.canonicalHash ||
    input.persisted.actorId !== input.compiled.policy.createdByActorRef ||
    !input.persisted.issuerId ||
    !validHash(input.persisted.proofRefHash) ||
    !Number.isFinite(now) ||
    !Number.isFinite(confirmedAt) ||
    confirmedAt > now ||
    now >= Date.parse(input.compiled.policy.constraints.expiresAt)
  )
    return undefined;
  const confirmed = Object.freeze({
    compiled: input.compiled,
    state: 'ACTIVE' as const,
    confirmedAt: input.persisted.confirmedAt,
    actorId: input.persisted.actorId,
    issuerId: input.persisted.issuerId,
    proofRefHash: input.persisted.proofRefHash,
  });
  confirmedPolicyVersions.add(confirmed);
  return confirmed;
}

export async function confirmM03Policy(input: {
  readonly compiled: CompiledPolicyVersion;
  readonly proof: unknown;
  readonly verifier?: ActorProvenanceVerifier;
  readonly nonceLedger: NonceLedger;
  readonly now: string;
}): Promise<ConfirmedPolicyVersion> {
  if (!isCompiledPolicyVersion(input.compiled))
    throw new TypeError('POLICY_VERSION_NOT_COMPILER_ATTESTED');
  const parsed = M03ActorConfirmationProofSchema.safeParse(input.proof);
  if (!parsed.success) throw new TypeError('ACTOR_PROVENANCE_MALFORMED');
  const proof = parsed.data;
  const now = Date.parse(input.now);
  const issued = Date.parse(proof.issuedAt);
  const expires = Date.parse(proof.expiresAt);
  if (
    proof.subject !== input.compiled.policy.createdByActorRef ||
    proof.policyHash !== input.compiled.canonicalHash
  ) {
    throw new TypeError('ACTOR_OR_POLICY_BINDING_MISMATCH');
  }
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(issued) ||
    !Number.isFinite(expires) ||
    issued > now ||
    now - issued > 300_000 ||
    expires <= now ||
    expires <= issued ||
    expires > Date.parse(input.compiled.policy.constraints.expiresAt)
  ) {
    throw new TypeError('ACTOR_PROVENANCE_TIME_INVALID');
  }
  if (!input.verifier) throw new TypeError('ACTOR_PROVENANCE_VERIFIER_UNAVAILABLE');
  const verified = await input.verifier.verifyConfirmation(proof, {
    actorId: input.compiled.policy.createdByActorRef,
    policyHash: input.compiled.canonicalHash,
    now: input.now,
  });
  if (
    !verified ||
    verified.actorId !== proof.subject ||
    verified.issuerId !== proof.issuer ||
    typeof verified.proofRef !== 'string' ||
    verified.proofRef.length < 1
  ) {
    throw new TypeError('ACTOR_PROVENANCE_UNVERIFIABLE');
  }
  if (!(await input.nonceLedger.consume(proof.issuer, proof.nonce, 'policy-confirmation')))
    throw new TypeError('ACTOR_PROVENANCE_REPLAY');
  const confirmed = Object.freeze({
    compiled: input.compiled,
    state: 'ACTIVE' as const,
    confirmedAt: input.now,
    actorId: verified.actorId,
    issuerId: verified.issuerId,
    proofRefHash: await canonicalHash({ issuer: verified.issuerId, proofRef: verified.proofRef }),
  });
  confirmedPolicyVersions.add(confirmed);
  return confirmed;
}

export interface TriggerEvaluation {
  readonly schemaVersion: '0.1';
  readonly evaluationId: string;
  readonly result: 'MATCH' | 'NO_MATCH' | 'REFUSED';
  readonly reason: string;
  readonly correlationId: string;
  readonly policyVersionHash: string;
  readonly sourceSnapshotHash: string;
  readonly evaluatedAt: string;
  readonly triggerResults: readonly Readonly<{
    metric: string;
    result: 'MATCH' | 'NO_MATCH' | 'UNKNOWN';
    valueBps?: number;
  }>[];
}

const forbiddenMetrics = new Set([
  'LIQUIDATION_DISTANCE',
  'LIQUIDATION_DISTANCE_BPS',
  'MAINTENANCE_MARGIN',
  'MARGIN_SAFETY',
  'FUNDING_DIRECTION',
]);

function validHash(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function metricValue(
  metrics: readonly RiskMetric[],
  metric: 'POSITION_ADVERSE_MOVE_BPS' | 'PORTFOLIO_DRAWDOWN_BPS',
  positionId: string,
): RiskMetric | undefined {
  return metrics.find(
    (candidate) =>
      candidate.name === metric &&
      (metric !== 'POSITION_ADVERSE_MOVE_BPS' || candidate.metadata?.positionId === positionId),
  );
}

export async function evaluateM03Triggers(input: {
  readonly policy: ConfirmedPolicyVersion;
  readonly risk: RiskSnapshot;
  readonly now: string;
  readonly maxSnapshotAgeMs?: number;
  readonly lastEffectAt?: string;
}): Promise<TriggerEvaluation> {
  const fail = async (reason: string): Promise<TriggerEvaluation> => {
    const body = {
      schemaVersion: '0.1' as const,
      result: 'REFUSED' as const,
      reason,
      correlationId: input.risk.correlationId ?? 'm03-uncorrelated',
      policyVersionHash: isConfirmedPolicyVersion(input.policy)
        ? input.policy.compiled.canonicalHash
        : '0'.repeat(64),
      sourceSnapshotHash: validHash(input.risk.snapshotHash)
        ? input.risk.snapshotHash
        : '0'.repeat(64),
      evaluatedAt: input.now,
      triggerResults: [],
    };
    return { ...body, evaluationId: await canonicalHash(body) };
  };
  if (!isConfirmedPolicyVersion(input.policy)) return fail('POLICY_CONFIRMATION_UNVERIFIED');
  if (input.policy.state !== 'ACTIVE') return fail('POLICY_NOT_ACTIVE');
  if (input.policy.compiled.policy.environment === 'MAINNET_EXECUTION')
    return fail('MAINNET_EXECUTION_HARD_BLOCKED');
  if (!validHash(input.risk.snapshotHash)) return fail('RISK_SNAPSHOT_HASH_MISSING');
  if (input.risk.schemaVersion !== '0.1' || input.risk.quality !== 'FRESH')
    return fail('RISK_SNAPSHOT_NOT_FRESH');
  const now = Date.parse(input.now);
  const generatedAt = Date.parse(input.risk.generatedAt ?? input.risk.observedAt);
  const maxAge = input.maxSnapshotAgeMs ?? 15_000;
  if (
    !Number.isInteger(maxAge) ||
    maxAge < 100 ||
    maxAge > 300_000 ||
    !Number.isFinite(now) ||
    !Number.isFinite(generatedAt) ||
    generatedAt > now ||
    now - generatedAt > maxAge
  )
    return fail('RISK_SNAPSHOT_STALE_OR_CLOCK_INVALID');
  if (input.lastEffectAt !== undefined) {
    const lastEffect = Date.parse(input.lastEffectAt);
    if (!Number.isFinite(lastEffect) || lastEffect > now) return fail('COOLDOWN_STATE_UNKNOWN');
    if (now - lastEffect < input.policy.compiled.policy.constraints.cooldownSeconds * 1_000)
      return fail('POLICY_COOLDOWN_ACTIVE');
  }
  if (input.policy.compiled.policy.triggers.some((trigger) => forbiddenMetrics.has(trigger.metric)))
    return fail('UNPROVEN_METRIC_CANNOT_AUTHORIZE');
  const results = input.policy.compiled.policy.triggers.map((trigger) => {
    const metric = metricValue(
      input.risk.metrics,
      trigger.metric,
      input.policy.compiled.policy.scope.positionId,
    );
    if (
      !metric ||
      metric.quality !== 'FRESH' ||
      metric.valueBps === undefined ||
      !Number.isInteger(metric.valueBps) ||
      metric.valueBps < 0 ||
      metric.valueBps > 10_000
    ) {
      return { metric: trigger.metric, result: 'UNKNOWN' as const };
    }
    return {
      metric: trigger.metric,
      result: metric.valueBps >= trigger.thresholdBps ? ('MATCH' as const) : ('NO_MATCH' as const),
      valueBps: metric.valueBps,
    };
  });
  const result: TriggerEvaluation['result'] = results.some((entry) => entry.result === 'UNKNOWN')
    ? 'REFUSED'
    : results.some((entry) => entry.result === 'MATCH')
      ? 'MATCH'
      : 'NO_MATCH';
  const reason =
    result === 'REFUSED'
      ? 'REQUIRED_TRIGGER_METRIC_UNKNOWN'
      : result === 'MATCH'
        ? 'PROTECTIVE_TRIGGER_MATCHED'
        : 'NO_TRIGGER_MATCHED';
  const body = {
    schemaVersion: '0.1' as const,
    result,
    reason,
    correlationId: input.risk.correlationId ?? 'm03-uncorrelated',
    policyVersionHash: input.policy.compiled.canonicalHash,
    sourceSnapshotHash: input.risk.snapshotHash,
    evaluatedAt: input.now,
    triggerResults: results,
  };
  return { ...body, evaluationId: await canonicalHash(body) };
}

export interface M03PositionContext {
  readonly accountId: string;
  readonly positionId: string;
  readonly marketSelector: string;
  readonly network: 'local' | 'monad-testnet' | 'monad-mainnet';
  readonly chainId: 143 | 10_143 | 0;
  readonly position: PositionSnapshot;
  readonly positionNotionalMicros: string;
  readonly currentRiskSnapshotHash: string;
}

export interface PositionAccountBindingVerifier {
  /** Reconcile account and position ownership against an authenticated provider read. */
  verify(
    input: Readonly<{
      context: M03PositionContext;
      riskSnapshotHash: string;
      now: string;
    }>,
  ): Promise<
    | Readonly<{
        provider: 'perpl';
        accountId: string;
        positionId: string;
        network: 'monad-testnet' | 'monad-mainnet';
        sourceSnapshotHash: string;
        proofRef: string;
      }>
    | undefined
  >;
}

export interface VerifiedPositionAccountBinding {
  readonly provider: 'perpl';
  readonly accountId: string;
  readonly positionId: string;
  readonly network: 'monad-testnet' | 'monad-mainnet';
  readonly sourceSnapshotHash: string;
  readonly proofRefHash: string;
}

export async function verifyPositionAccountBinding(input: {
  readonly context: M03PositionContext;
  readonly riskSnapshotHash: string;
  readonly now: string;
  readonly verifier?: PositionAccountBindingVerifier;
}): Promise<VerifiedPositionAccountBinding> {
  if (!input.verifier) throw new TypeError('POSITION_ACCOUNT_BINDING_VERIFIER_UNAVAILABLE');
  if (
    !validHash(input.riskSnapshotHash) ||
    input.context.currentRiskSnapshotHash !== input.riskSnapshotHash ||
    input.context.position.positionId !== input.context.positionId ||
    input.context.position.source.quality !== 'FRESH'
  )
    throw new TypeError('POSITION_ACCOUNT_BINDING_INPUT_INVALID');
  const verified = await input.verifier.verify({
    context: input.context,
    riskSnapshotHash: input.riskSnapshotHash,
    now: input.now,
  });
  if (
    !verified ||
    verified.provider !== 'perpl' ||
    verified.accountId !== input.context.accountId ||
    verified.positionId !== input.context.positionId ||
    verified.network !== input.context.network ||
    verified.sourceSnapshotHash !== input.context.position.source.contentHash ||
    !verified.proofRef
  )
    throw new TypeError('POSITION_ACCOUNT_BINDING_UNVERIFIABLE');
  const binding = Object.freeze({
    provider: verified.provider,
    accountId: verified.accountId,
    positionId: verified.positionId,
    network: verified.network,
    sourceSnapshotHash: verified.sourceSnapshotHash,
    proofRefHash: await canonicalHash(verified.proofRef),
  });
  verifiedPositionBindings.add(binding);
  return binding;
}

export interface M03ExecutionPlan {
  readonly schemaVersion: '0.1';
  readonly planId: string;
  readonly digest: string;
  readonly idempotencyKey: string;
  readonly policyId: string;
  readonly policyVersion: number;
  readonly policyVersionHash: string;
  readonly snapshotId: string;
  readonly snapshotHash: string;
  readonly accountId: string;
  readonly positionId: string;
  readonly marketSelector: string;
  readonly action: M03Action;
  readonly quantityScaled: string;
  readonly notionalMicros: string;
  readonly slippageBps: number;
  readonly environment: M03PolicyV0_1['environment'];
  readonly network: M03PolicyV0_1['scope']['network'];
  readonly chainId: 143 | 10_143 | 0;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly correlationId: string;
  readonly externalEffect: boolean;
}

export type PlanResult =
  | { readonly status: 'PLANNED'; readonly plan: M03ExecutionPlan }
  | { readonly status: 'REFUSED'; readonly reason: string };

export function isTrustedM03Plan(value: unknown): value is M03ExecutionPlan {
  return (
    value !== null &&
    typeof value === 'object' &&
    executionPlans.has(value) &&
    Object.isFrozen(value) &&
    validHash((value as M03ExecutionPlan).digest)
  );
}

export async function planM03Action(input: {
  readonly policy: ConfirmedPolicyVersion;
  readonly evaluation: TriggerEvaluation;
  readonly risk: RiskSnapshot;
  readonly positionContext?: M03PositionContext;
  readonly positionBinding?: VerifiedPositionAccountBinding;
  readonly now: string;
}): Promise<PlanResult> {
  if (!isConfirmedPolicyVersion(input.policy))
    return { status: 'REFUSED', reason: 'POLICY_CONFIRMATION_UNVERIFIED' };
  if (input.policy.state !== 'ACTIVE') return { status: 'REFUSED', reason: 'POLICY_NOT_ACTIVE' };
  if (input.evaluation.result !== 'MATCH')
    return {
      status: 'REFUSED',
      reason:
        input.evaluation.result === 'REFUSED' ? input.evaluation.reason : 'TRIGGER_NOT_MATCHED',
    };
  const compiled = input.policy.compiled;
  const policy = compiled.policy;
  const current = Date.parse(input.now);
  const expires = Date.parse(policy.constraints.expiresAt);
  if (!Number.isFinite(current) || !Number.isFinite(expires) || expires <= current)
    return { status: 'REFUSED', reason: 'POLICY_EXPIRED' };
  if (
    input.evaluation.policyVersionHash !== compiled.canonicalHash ||
    !validHash(input.risk.snapshotHash) ||
    input.evaluation.sourceSnapshotHash !== input.risk.snapshotHash
  )
    return { status: 'REFUSED', reason: 'EVALUATION_BINDING_MISMATCH' };
  if (policy.environment === 'MAINNET_EXECUTION')
    return { status: 'REFUSED', reason: 'MAINNET_EXECUTION_HARD_BLOCKED' };
  const action = policy.actionIntent.family;
  let accountId = policy.scope.accountId;
  let quantityScaled = '0';
  let notionalMicros = '0';
  let marketSelector = policy.scope.marketSelector;
  let network = policy.scope.network;
  let chainId: 143 | 10_143 | 0 =
    network === 'monad-mainnet' ? 143 : network === 'monad-testnet' ? 10_143 : 0;
  if (action !== 'NO_ACTION') {
    const position = input.positionContext;
    const binding = input.positionBinding;
    if (!position || !binding || !verifiedPositionBindings.has(binding))
      return { status: 'REFUSED', reason: 'POSITION_ACCOUNT_BINDING_UNAVAILABLE' };
    if (
      position.positionId !== policy.scope.positionId ||
      position.accountId !== policy.scope.accountId ||
      position.marketSelector !== policy.scope.marketSelector ||
      position.network !== policy.scope.network ||
      position.currentRiskSnapshotHash !== input.risk.snapshotHash ||
      position.position.positionId !== policy.scope.positionId ||
      position.position.source.quality !== 'FRESH' ||
      position.position.source.network !== policy.scope.network ||
      binding.accountId !== position.accountId ||
      binding.positionId !== position.positionId ||
      binding.network !== position.network ||
      binding.sourceSnapshotHash !== position.position.source.contentHash ||
      position.chainId !== chainId
    )
      return { status: 'REFUSED', reason: 'POSITION_SCOPE_OR_FRESHNESS_MISMATCH' };
    if (!/^[1-9][0-9]{0,37}$/.test(position.position.sizeScaled))
      return { status: 'REFUSED', reason: 'POSITION_SIZE_INVALID' };
    if (!/^[1-9][0-9]{0,37}$/.test(position.positionNotionalMicros))
      return { status: 'REFUSED', reason: 'POSITION_NOTIONAL_UNKNOWN' };
    const currentQuantity = BigInt(position.position.sizeScaled);
    const currentNotional = BigInt(position.positionNotionalMicros);
    const requestedBps = Math.min(
      policy.actionIntent.maxActionFractionBps,
      policy.constraints.maxActionFractionBps,
    );
    if (action === 'CLOSE_POSITION') {
      if (
        requestedBps !== 10_000 ||
        currentQuantity > BigInt(policy.constraints.maxReducibleQuantityScaled) ||
        currentNotional > BigInt(policy.constraints.maxNotionalMicros)
      )
        return { status: 'REFUSED', reason: 'FULL_CLOSE_EXCEEDS_POLICY_BOUND' };
      quantityScaled = currentQuantity.toString();
      notionalMicros = currentNotional.toString();
    } else {
      const quantityBound =
        (BigInt(policy.constraints.maxReducibleQuantityScaled) * 10_000n) / currentQuantity;
      const notionalBound =
        (BigInt(policy.constraints.maxNotionalMicros) * 10_000n) / currentNotional;
      const fraction = Math.min(requestedBps, Number(quantityBound), Number(notionalBound), 9_999);
      if (!Number.isSafeInteger(fraction) || fraction < 1)
        return { status: 'REFUSED', reason: 'REDUCE_BOUND_TOO_SMALL' };
      const quantity = (currentQuantity * BigInt(fraction)) / 10_000n;
      const notional = (currentNotional * BigInt(fraction) + 9_999n) / 10_000n;
      if (
        quantity <= 0n ||
        quantity >= currentQuantity ||
        quantity > BigInt(policy.constraints.maxReducibleQuantityScaled) ||
        notional > BigInt(policy.constraints.maxNotionalMicros)
      )
        return { status: 'REFUSED', reason: 'REDUCE_ACTION_NOT_STRICTLY_BOUNDED' };
      quantityScaled = quantity.toString();
      notionalMicros = notional.toString();
    }
    accountId = position.accountId;
    marketSelector = position.marketSelector;
    network = position.network;
    chainId = position.chainId;
  }
  const expiresAt = new Date(
    Math.min(expires, current + policy.constraints.maxPlanAgeSeconds * 1_000),
  ).toISOString();
  const body = {
    schemaVersion: '0.1' as const,
    policyId: policy.policyId,
    policyVersion: policy.version,
    policyVersionHash: compiled.canonicalHash,
    snapshotId: input.risk.snapshotId,
    snapshotHash: input.risk.snapshotHash!,
    accountId,
    positionId: policy.scope.positionId,
    marketSelector,
    action,
    quantityScaled,
    notionalMicros,
    slippageBps: policy.constraints.maxSlippageBps,
    environment: policy.environment,
    network,
    chainId,
    createdAt: input.now,
    expiresAt,
    correlationId: input.risk.correlationId ?? input.evaluation.correlationId,
    externalEffect: action !== 'NO_ACTION' && policy.environment === 'TESTNET',
  };
  const digest = await canonicalHash(body);
  const plan = Object.freeze({
    ...body,
    planId: `plan-${digest.slice(0, 40)}`,
    digest,
    idempotencyKey: await canonicalHash({
      domain: 'nerva:m03:effect:v1',
      environment: body.environment,
      network: body.network,
      accountId: body.accountId,
      positionId: body.positionId,
      policyVersionHash: body.policyVersionHash,
      snapshotHash: body.snapshotHash,
      action: body.action,
      quantityScaled: body.quantityScaled,
    }),
  });
  executionPlans.add(plan);
  return { status: 'PLANNED', plan };
}

export interface DryRunSimulation {
  readonly schemaVersion: '0.1';
  readonly simulationId: string;
  readonly kind: 'DETERMINISTIC_DRY_RUN';
  readonly authority: 'DRY_RUN_ONLY';
  readonly status: 'PASS' | 'FAIL' | 'UNKNOWN';
  readonly reason: string;
  readonly planDigest: string;
  readonly policyVersionHash: string;
  readonly sourceSnapshotHash: string;
  readonly environment: M03PolicyV0_1['environment'];
  readonly simulatorVersion: string;
  readonly assumptions: readonly string[];
  readonly createdAt: string;
  readonly expiresAt: string;
}

export async function simulateM03Plan(input: {
  readonly plan: M03ExecutionPlan;
  readonly policy: ConfirmedPolicyVersion;
  readonly risk: RiskSnapshot;
  readonly now: string;
  readonly simulatorVersion?: string;
}): Promise<DryRunSimulation> {
  const now = Date.parse(input.now);
  const planExpiry = Date.parse(input.plan.expiresAt);
  const valid =
    isTrustedM03Plan(input.plan) &&
    isConfirmedPolicyVersion(input.policy) &&
    input.policy.state === 'ACTIVE' &&
    input.plan.policyVersionHash === input.policy.compiled.canonicalHash &&
    input.plan.snapshotHash === input.risk.snapshotHash &&
    input.risk.quality === 'FRESH' &&
    Number.isFinite(now) &&
    Number.isFinite(planExpiry) &&
    now < planExpiry &&
    input.plan.action === input.policy.compiled.policy.actionIntent.family;
  const body = {
    schemaVersion: '0.1' as const,
    kind: 'DETERMINISTIC_DRY_RUN' as const,
    authority: 'DRY_RUN_ONLY' as const,
    status: valid ? ('PASS' as const) : ('UNKNOWN' as const),
    reason: valid ? 'SYNTHETIC_PLAN_INVARIANTS_PASS' : 'PLAN_OR_INPUT_UNKNOWN',
    planDigest: input.plan.digest,
    policyVersionHash: input.plan.policyVersionHash,
    sourceSnapshotHash: input.plan.snapshotHash,
    environment: input.plan.environment,
    simulatorVersion: input.simulatorVersion ?? 'nerva-dry-run-v1',
    assumptions: [
      'No provider call or financial effect occurred.',
      'Synthetic deterministic constraints do not prove market fill, provider capability or authorization.',
    ],
    createdAt: input.now,
    expiresAt: input.plan.expiresAt,
  };
  return { ...body, simulationId: await canonicalHash(body) };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
