import {
  M03ExecutionAuthorizationProofSchema,
  M03ProviderEnrollmentEvidenceSchemaV0_1,
} from '@nerva/contracts';
import { canonicalHash } from '@nerva/domain';
import {
  type NonceLedger,
  isConfirmedPolicyVersion,
  isTrustedM03Plan,
  type ConfirmedPolicyVersion,
  type DryRunSimulation,
  type M03ExecutionPlan,
  type M03Action,
} from '@nerva/policy';

export type M03ExecutionState =
  | 'NOT_STARTED'
  | 'PREFLIGHTED'
  | 'AUTHORIZED'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'REFUSED'
  | 'FAILED'
  | 'UNKNOWN'
  | 'RECOVERY_REQUIRED';

export interface ExecutionEvent {
  readonly schemaVersion: '0.1';
  readonly eventId: string;
  readonly idempotencyKey: string;
  readonly planDigest: string;
  readonly correlationId: string;
  readonly state: M03ExecutionState;
  readonly reason: string;
  readonly occurredAt: string;
  readonly providerReferenceHash?: string;
}

export interface ExecutionStore {
  /** Must be atomic and durable; the idempotency key is unique by provider/network/account. */
  claim(
    input: Readonly<{
      idempotencyKey: string;
      planDigest: string;
      provider: 'perpl';
      network: 'monad-testnet';
      accountId: string;
    }>,
  ): Promise<'CLAIMED' | 'DUPLICATE' | 'CONFLICT'>;
  append(event: ExecutionEvent): Promise<void>;
  find(idempotencyKey: string): Promise<readonly ExecutionEvent[]>;
}

export interface KillSwitch {
  /** Must read the canonical persisted control and fail closed if unavailable. */
  isEnabled(): Promise<boolean>;
  /** Atomically serialize the kill-state check with the last step before dispatch. */
  runIfDisabled<T>(operation: () => Promise<T>): Promise<KillSwitchPermitResult<T>>;
}

export type KillSwitchPermitResult<T> =
  Readonly<{ permitted: true; value: T }> | Readonly<{ permitted: false }>;

export interface M03ExecutionAuthorizationVerifier {
  verify(
    proof: Readonly<Record<string, unknown>>,
    expected: Readonly<{
      actorId: string;
      policyHash: string;
      planDigest: string;
      accountId: string;
      positionId: string;
      action: Exclude<M03Action, 'NO_ACTION'>;
      now: string;
    }>,
  ): Promise<Readonly<{ issuerId: string; actorId: string; proofRef: string }> | undefined>;
}

export interface PerplEnrollmentVerifier {
  verify(
    evidence: Readonly<Record<string, unknown>>,
    expected: Readonly<{
      accountId: string;
      network: 'monad-testnet';
      chainId: 10_143;
      action: Exclude<M03Action, 'NO_ACTION'>;
      now: string;
    }>,
  ): Promise<Readonly<{ issuerId: string; scopeRef: string }> | undefined>;
}

function isDocumentedProtectiveOnlyScope(scope: string): boolean {
  // Current documented scopes are read and broad trade; unknown future scopes also fail closed.
  switch (scope) {
    case 'read':
    case 'trade':
    case 'read trade':
    default:
      return false;
  }
}

export interface ProviderPreflightVerifier {
  verify(
    input: Readonly<{
      plan: M03ExecutionPlan;
      simulation: unknown;
      now: string;
    }>,
  ): Promise<ProviderPreflight | undefined>;
}

export interface ProviderPreflight {
  readonly schemaVersion: '0.1';
  readonly provider: 'perpl';
  readonly status: 'PASS' | 'FAIL' | 'UNKNOWN';
  readonly planDigest: string;
  readonly policyVersionHash: string;
  readonly sourceSnapshotHash: string;
  readonly environment: 'TESTNET';
  readonly network: 'monad-testnet';
  readonly chainId: 10_143;
  readonly simulatorVersion: string;
  readonly checkedAt: string;
  readonly expiresAt: string;
  readonly evidenceRef: string;
}

export interface ProtectiveEffectCommand {
  readonly provider: 'perpl';
  readonly environment: 'TESTNET';
  readonly network: 'monad-testnet';
  readonly chainId: 10_143;
  readonly accountId: string;
  readonly positionId: string;
  readonly action: 'REDUCE_POSITION' | 'CLOSE_POSITION';
  readonly quantityScaled: string;
  readonly maxSlippageBps: number;
  readonly idempotencyKey: string;
  readonly planDigest: string;
  readonly policyVersionHash: string;
  readonly expiresAt: string;
}

export interface PerplTestnetPort {
  submitProtective(command: ProtectiveEffectCommand): Promise<
    Readonly<{
      outcome: 'CONFIRMED' | 'FAILED' | 'UNKNOWN';
      providerReference?: string;
      reason: string;
    }>
  >;
  reconcile(
    input: Readonly<{
      accountId: string;
      idempotencyKey: string;
      planDigest: string;
    }>,
  ): Promise<
    Readonly<{
      outcome: 'CONFIRMED' | 'NOT_SUBMITTED' | 'UNKNOWN' | 'CONFLICT';
      providerReference?: string;
      reason: string;
    }>
  >;
}

export interface ExecuteM03Input {
  readonly policy: ConfirmedPolicyVersion;
  readonly plan: M03ExecutionPlan;
  readonly dryRun: DryRunSimulation;
  readonly authorizationProof?: unknown;
  readonly enrollmentEvidence?: unknown;
  readonly nonceLedger?: NonceLedger;
  readonly now: string;
  readonly store: ExecutionStore;
  readonly killSwitch: KillSwitch;
  readonly authorizationVerifier?: M03ExecutionAuthorizationVerifier;
  readonly enrollmentVerifier?: PerplEnrollmentVerifier;
  readonly preflightVerifier?: ProviderPreflightVerifier;
  readonly provider?: PerplTestnetPort;
}

export interface ExecuteM03Result {
  readonly state: M03ExecutionState;
  readonly idempotencyKey: string;
  readonly planDigest: string;
  readonly reason: string;
  readonly events: readonly ExecutionEvent[];
}

export async function executeM03Testnet(input: ExecuteM03Input): Promise<ExecuteM03Result> {
  const events: ExecutionEvent[] = [];
  const append = async (state: M03ExecutionState, reason: string, providerReference?: string) => {
    const body = {
      schemaVersion: '0.1' as const,
      idempotencyKey: input.plan.idempotencyKey,
      planDigest: input.plan.digest,
      correlationId: input.plan.correlationId,
      state,
      reason,
      occurredAt: input.now,
      ...(providerReference
        ? { providerReferenceHash: await canonicalHash(providerReference) }
        : {}),
    };
    const event = Object.freeze({ ...body, eventId: await canonicalHash(body) });
    await input.store.append(event);
    events.push(event);
    return event;
  };
  const refuse = async (reason: string): Promise<ExecuteM03Result> => {
    await append('REFUSED', reason);
    return {
      state: 'REFUSED',
      idempotencyKey: input.plan.idempotencyKey,
      planDigest: input.plan.digest,
      reason,
      events,
    };
  };
  if (!isConfirmedPolicyVersion(input.policy)) return refuse('POLICY_CONFIRMATION_UNVERIFIED');
  if (!isTrustedM03Plan(input.plan)) return refuse('PLAN_NOT_COMPILER_ATTESTED');
  if (
    input.plan.environment !== 'TESTNET' ||
    input.plan.network !== 'monad-testnet' ||
    input.plan.chainId !== 10_143
  )
    return refuse('MAINNET_OR_NON_TESTNET_EFFECT_HARD_BLOCKED');
  if (
    input.policy.state !== 'ACTIVE' ||
    input.policy.compiled.policy.environment !== 'TESTNET' ||
    input.policy.compiled.canonicalHash !== input.plan.policyVersionHash ||
    input.policy.compiled.policy.scope.accountId !== input.plan.accountId ||
    input.policy.compiled.policy.scope.positionId !== input.plan.positionId
  )
    return refuse('POLICY_OR_POSITION_BINDING_MISMATCH');
  let initialKillEnabled: boolean;
  try {
    initialKillEnabled = await input.killSwitch.isEnabled();
  } catch {
    initialKillEnabled = true;
  }
  if (initialKillEnabled) return refuse('KILL_SWITCH_ENABLED_BEFORE_AUTHORIZATION');
  if (input.plan.action === 'NO_ACTION' || !input.plan.externalEffect)
    return refuse('PLAN_HAS_NO_TESTNET_EFFECT');
  const now = Date.parse(input.now);
  const planExpiry = Date.parse(input.plan.expiresAt);
  const simExpiry = Date.parse(input.dryRun.expiresAt);
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(planExpiry) ||
    !Number.isFinite(simExpiry) ||
    now >= planExpiry ||
    now >= simExpiry
  )
    return refuse('PLAN_OR_SIMULATION_EXPIRED');
  if (
    input.dryRun.status !== 'PASS' ||
    input.dryRun.planDigest !== input.plan.digest ||
    input.dryRun.policyVersionHash !== input.plan.policyVersionHash ||
    input.dryRun.sourceSnapshotHash !== input.plan.snapshotHash
  )
    return refuse(input.dryRun.status === 'UNKNOWN' ? 'SIMULATION_UNKNOWN' : 'SIMULATION_MISMATCH');
  // A deterministic dry run is intentionally insufficient to authorize a provider effect.
  if (!input.preflightVerifier) return refuse('PROVIDER_PREFLIGHT_UNAVAILABLE');
  const preflight = await input.preflightVerifier.verify({
    plan: input.plan,
    simulation: input.dryRun,
    now: input.now,
  });
  if (
    !preflight ||
    preflight.status !== 'PASS' ||
    preflight.planDigest !== input.plan.digest ||
    preflight.policyVersionHash !== input.plan.policyVersionHash ||
    preflight.sourceSnapshotHash !== input.plan.snapshotHash ||
    preflight.environment !== 'TESTNET' ||
    preflight.network !== 'monad-testnet' ||
    preflight.chainId !== 10_143 ||
    !Number.isFinite(Date.parse(preflight.expiresAt)) ||
    Date.parse(preflight.expiresAt) <= now
  )
    return refuse(
      preflight?.status === 'UNKNOWN' ? 'PROVIDER_PREFLIGHT_UNKNOWN' : 'PROVIDER_PREFLIGHT_INVALID',
    );
  await append('PREFLIGHTED', 'EXACT_PLAN_PROVIDER_PREFLIGHT_PASS');

  const action = input.plan.action as Exclude<M03Action, 'NO_ACTION'>;
  const authParsed = M03ExecutionAuthorizationProofSchema.safeParse(input.authorizationProof);
  if (!authParsed.success) return refuse('AUTHORIZATION_PROVENANCE_UNAVAILABLE_OR_MALFORMED');
  if (!input.authorizationVerifier) return refuse('AUTHORIZATION_ISSUER_UNAVAILABLE');
  const auth = authParsed.data;
  if (
    auth.policyHash !== input.plan.policyVersionHash ||
    auth.planDigest !== input.plan.digest ||
    auth.accountId !== input.plan.accountId ||
    auth.positionId !== input.plan.positionId ||
    auth.action !== action ||
    auth.scope.length !== 1 ||
    auth.scope[0] !== action ||
    Date.parse(auth.expiresAt) <= now ||
    Date.parse(auth.issuedAt) > now ||
    Date.parse(auth.expiresAt) <= Date.parse(auth.issuedAt) ||
    Date.parse(auth.expiresAt) - Date.parse(auth.issuedAt) > 300_000 ||
    new Set(auth.scope).size !== auth.scope.length
  )
    return refuse('AUTHORIZATION_BINDING_INVALID');
  const verifiedAuth = await input.authorizationVerifier.verify(auth, {
    actorId: input.policy.actorId,
    policyHash: input.plan.policyVersionHash,
    planDigest: input.plan.digest,
    accountId: input.plan.accountId,
    positionId: input.plan.positionId,
    action,
    now: input.now,
  });
  if (
    !verifiedAuth ||
    verifiedAuth.actorId !== input.policy.actorId ||
    verifiedAuth.issuerId !== auth.issuer ||
    !verifiedAuth.proofRef
  )
    return refuse('AUTHORIZATION_PROVENANCE_UNVERIFIABLE');
  if (!input.nonceLedger) return refuse('REPLAY_LEDGER_UNAVAILABLE');
  if (!(await input.nonceLedger.consume(auth.issuer, auth.nonce, 'execution-authorization')))
    return refuse('EXECUTION_AUTHORIZATION_REPLAY');

  const enrollmentParsed = M03ProviderEnrollmentEvidenceSchemaV0_1.safeParse(
    input.enrollmentEvidence,
  );
  if (!enrollmentParsed.success) return refuse('PERPL_ENROLLMENT_SCOPE_UNAVAILABLE_OR_MALFORMED');
  if (!input.enrollmentVerifier) return refuse('PERPL_SCOPE_VERIFIER_UNAVAILABLE');
  const enrollment = enrollmentParsed.data;
  if (
    enrollment.accountId !== input.plan.accountId ||
    enrollment.network !== 'monad-testnet' ||
    enrollment.chainId !== 10_143 ||
    enrollment.allowedActions.length !== 1 ||
    enrollment.allowedActions[0] !== action ||
    Date.parse(enrollment.expiresAt) <= now
  )
    return refuse('PERPL_ENROLLMENT_SCOPE_BINDING_INVALID');
  if (enrollment.scopes.length !== 1 || !enrollment.scopes.every(isDocumentedProtectiveOnlyScope))
    return refuse('NO_DOCUMENTED_PROTECTIVE_ONLY_PERPL_SCOPE');
  const verifiedScope = await input.enrollmentVerifier.verify(enrollment, {
    accountId: input.plan.accountId,
    network: 'monad-testnet',
    chainId: 10_143,
    action,
    now: input.now,
  });
  if (!verifiedScope || verifiedScope.issuerId !== enrollment.issuer || !verifiedScope.scopeRef)
    return refuse('PERPL_ENROLLMENT_PROVENANCE_UNVERIFIABLE');
  if (
    !(await input.nonceLedger.consume(enrollment.issuer, enrollment.nonce, 'provider-enrollment'))
  )
    return refuse('PROVIDER_ENROLLMENT_PROOF_REPLAY');
  let killEnabled: boolean;
  try {
    killEnabled = await input.killSwitch.isEnabled();
  } catch {
    killEnabled = true;
  }
  if (killEnabled) return refuse('KILL_SWITCH_ENABLED_BEFORE_AUTHORIZATION');
  if (!input.provider) return refuse('PERPL_TESTNET_ADAPTER_UNAVAILABLE');
  const claimed = await input.store.claim({
    idempotencyKey: input.plan.idempotencyKey,
    planDigest: input.plan.digest,
    provider: 'perpl',
    network: 'monad-testnet',
    accountId: input.plan.accountId,
  });
  if (claimed === 'DUPLICATE') return refuse('IDEMPOTENCY_DUPLICATE_SUPPRESSED');
  if (claimed === 'CONFLICT') return refuse('IDEMPOTENCY_IDENTITY_CONFLICT');
  try {
    killEnabled = await input.killSwitch.isEnabled();
  } catch {
    killEnabled = true;
  }
  if (killEnabled) return refuse('KILL_SWITCH_WON_BEFORE_AUTHORIZATION_OR_SUBMISSION');
  await append('AUTHORIZED', 'ACTOR_AND_EXACT_PROVIDER_SCOPE_VERIFIED');
  const command: ProtectiveEffectCommand = Object.freeze({
    provider: 'perpl',
    environment: 'TESTNET',
    network: 'monad-testnet',
    chainId: 10_143,
    accountId: input.plan.accountId,
    positionId: input.plan.positionId,
    action,
    quantityScaled: input.plan.quantityScaled,
    maxSlippageBps: input.plan.slippageBps,
    idempotencyKey: input.plan.idempotencyKey,
    planDigest: input.plan.digest,
    policyVersionHash: input.plan.policyVersionHash,
    expiresAt: input.plan.expiresAt,
  });
  type ProviderResult = Awaited<ReturnType<PerplTestnetPort['submitProtective']>>;
  type SubmissionResult =
    | ProviderResult
    | Readonly<{
        outcome: 'UNKNOWN';
        reason: 'SUBMISSION_RESULT_AMBIGUOUS_NO_RETRY';
        providerReference?: string;
      }>;
  let permit: KillSwitchPermitResult<SubmissionResult> | undefined;
  try {
    permit = await input.killSwitch.runIfDisabled(async () => {
      await append('SUBMITTED', 'SINGLE_PROVIDER_REQUEST_DISPATCHED');
      try {
        return await input.provider!.submitProtective(command);
      } catch {
        return { outcome: 'UNKNOWN', reason: 'SUBMISSION_RESULT_AMBIGUOUS_NO_RETRY' } as const;
      }
    });
  } catch {
    await append('UNKNOWN', 'ATOMIC_GATE_OR_SUBMISSION_RESULT_AMBIGUOUS_NO_RETRY');
    await append('RECOVERY_REQUIRED', 'READ_ONLY_RECONCILIATION_REQUIRED');
    return {
      state: 'RECOVERY_REQUIRED',
      idempotencyKey: input.plan.idempotencyKey,
      planDigest: input.plan.digest,
      reason: 'ATOMIC_GATE_OR_SUBMISSION_RESULT_AMBIGUOUS_NO_RETRY',
      events,
    };
  }
  if (!permit?.permitted) return refuse('KILL_SWITCH_WON_BEFORE_SUBMISSION');
  try {
    const result = permit.value;
    if (result.outcome === 'CONFIRMED') {
      await append('CONFIRMED', 'PROVIDER_CONFIRMED_PROTECTIVE_EFFECT', result.providerReference);
      return {
        state: 'CONFIRMED',
        idempotencyKey: input.plan.idempotencyKey,
        planDigest: input.plan.digest,
        reason: result.reason,
        events,
      };
    }
    if (result.outcome === 'FAILED') {
      await append('FAILED', result.reason, result.providerReference);
      return {
        state: 'FAILED',
        idempotencyKey: input.plan.idempotencyKey,
        planDigest: input.plan.digest,
        reason: result.reason,
        events,
      };
    }
    await append('UNKNOWN', 'AMBIGUOUS_PROVIDER_OUTCOME_NO_RETRY', result.providerReference);
    await append('RECOVERY_REQUIRED', result.reason, result.providerReference);
    return {
      state: 'RECOVERY_REQUIRED',
      idempotencyKey: input.plan.idempotencyKey,
      planDigest: input.plan.digest,
      reason: result.reason,
      events,
    };
  } catch {
    await append('UNKNOWN', 'SUBMISSION_RESULT_AMBIGUOUS_NO_RETRY');
    await append('RECOVERY_REQUIRED', 'READ_ONLY_RECONCILIATION_REQUIRED');
    return {
      state: 'RECOVERY_REQUIRED',
      idempotencyKey: input.plan.idempotencyKey,
      planDigest: input.plan.digest,
      reason: 'SUBMISSION_RESULT_AMBIGUOUS_NO_RETRY',
      events,
    };
  }
}

export async function recoverM03Execution(input: {
  readonly plan: M03ExecutionPlan;
  readonly store: ExecutionStore;
  readonly provider?: PerplTestnetPort;
  readonly now: string;
}): Promise<
  Readonly<{ state: M03ExecutionState; reason: string; events: readonly ExecutionEvent[] }>
> {
  if (!isTrustedM03Plan(input.plan))
    return { state: 'REFUSED', reason: 'PLAN_NOT_COMPILER_ATTESTED', events: [] };
  const prior = await input.store.find(input.plan.idempotencyKey);
  if (!prior.some((event) => ['SUBMITTED', 'UNKNOWN', 'RECOVERY_REQUIRED'].includes(event.state)))
    return { state: 'REFUSED', reason: 'NO_AMBIGUOUS_ATTEMPT_TO_RECOVER', events: prior };
  if (!input.provider)
    return {
      state: 'RECOVERY_REQUIRED',
      reason: 'READ_ONLY_RECONCILIATION_UNAVAILABLE',
      events: prior,
    };
  const result = await input.provider.reconcile({
    accountId: input.plan.accountId,
    idempotencyKey: input.plan.idempotencyKey,
    planDigest: input.plan.digest,
  });
  const state: M03ExecutionState =
    result.outcome === 'CONFIRMED' ? 'CONFIRMED' : 'RECOVERY_REQUIRED';
  const reason =
    result.outcome === 'CONFIRMED'
      ? 'READ_ONLY_RECONCILIATION_CONFIRMED'
      : result.outcome === 'NOT_SUBMITTED'
        ? 'FRESH_EVALUATION_AND_NEW_PLAN_REQUIRED'
        : result.outcome === 'CONFLICT'
          ? 'PROVIDER_RECONCILIATION_CONFLICT'
          : 'PROVIDER_RECONCILIATION_UNKNOWN';
  const body = {
    schemaVersion: '0.1' as const,
    idempotencyKey: input.plan.idempotencyKey,
    planDigest: input.plan.digest,
    correlationId: input.plan.correlationId,
    state,
    reason,
    occurredAt: input.now,
    ...(result.providerReference
      ? { providerReferenceHash: await canonicalHash(result.providerReference) }
      : {}),
  };
  const event = Object.freeze({ ...body, eventId: await canonicalHash(body) });
  await input.store.append(event);
  return { state, reason, events: [...prior, event] };
}

export class MemoryExecutionStore implements ExecutionStore {
  private readonly events: ExecutionEvent[] = [];
  private readonly claims = new Map<string, string>();

  async claim(
    input: Parameters<ExecutionStore['claim']>[0],
  ): Promise<'CLAIMED' | 'DUPLICATE' | 'CONFLICT'> {
    const existing = this.claims.get(input.idempotencyKey);
    if (existing) return existing === input.planDigest ? 'DUPLICATE' : 'CONFLICT';
    this.claims.set(input.idempotencyKey, input.planDigest);
    return 'CLAIMED';
  }

  async append(event: ExecutionEvent): Promise<void> {
    this.events.push(event);
  }

  async find(idempotencyKey: string): Promise<readonly ExecutionEvent[]> {
    return this.events.filter((event) => event.idempotencyKey === idempotencyKey);
  }
}

export function validateProviderPreflight(input: {
  readonly preflight: ProviderPreflight;
  readonly plan: M03ExecutionPlan;
  readonly now: string;
}): boolean {
  const expires = Date.parse(input.preflight.expiresAt);
  const now = Date.parse(input.now);
  return (
    input.preflight.status === 'PASS' &&
    input.preflight.provider === 'perpl' &&
    input.preflight.planDigest === input.plan.digest &&
    input.preflight.policyVersionHash === input.plan.policyVersionHash &&
    input.preflight.sourceSnapshotHash === input.plan.snapshotHash &&
    input.preflight.environment === 'TESTNET' &&
    input.preflight.network === 'monad-testnet' &&
    input.preflight.chainId === 10_143 &&
    Number.isFinite(expires) &&
    Number.isFinite(now) &&
    expires > now
  );
}
