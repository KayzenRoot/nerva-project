/** M01's pure, deterministic safety vocabulary. This package has no runtime dependencies. */

declare const brand: unique symbol;
declare const immutablePolicyVersionBrand: unique symbol;
declare const verifiedExecutionPlanBrand: unique symbol;
const immutablePolicyVersions = new WeakSet<object>();
const verifiedExecutionPlans = new WeakSet<object>();
export type Brand<T, Name extends string> = T & { readonly [brand]: Name };
export type PolicyId = Brand<string, 'PolicyId'>;
export type PolicyVersionId = Brand<string, 'PolicyVersionId'>;
export type SnapshotId = Brand<string, 'SnapshotId'>;
export type PlanId = Brand<string, 'PlanId'>;
export type CorrelationId = Brand<string, 'CorrelationId'>;
export type IdempotencyKey = Brand<string, 'IdempotencyKey'>;
export type BasisPoints = Brand<number, 'BasisPoints'>;
export type Micros = Brand<bigint, 'Micros'>;

function id<Name extends string>(value: string, label: Name): Brand<string, Name> {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 200) {
    throw new Error(`${label} must be a non-empty identifier of at most 200 characters`);
  }
  return value.trim() as Brand<string, Name>;
}

export const asPolicyId = (value: string): PolicyId => id(value, 'PolicyId');
export const asPolicyVersionId = (value: string): PolicyVersionId => id(value, 'PolicyVersionId');
export const asSnapshotId = (value: string): SnapshotId => id(value, 'SnapshotId');
export const asPlanId = (value: string): PlanId => id(value, 'PlanId');
export const asCorrelationId = (value: string): CorrelationId => id(value, 'CorrelationId');
export const asIdempotencyKey = (value: string): IdempotencyKey => id(value, 'IdempotencyKey');
export function asBasisPoints(value: number): BasisPoints {
  if (!Number.isInteger(value) || value < 0 || value > 10_000)
    throw new RangeError('Basis points must be an integer in [0, 10000]');
  return value as BasisPoints;
}
export function asMicros(value: bigint): Micros {
  if (typeof value !== 'bigint' || value <= 0n)
    throw new RangeError('Micros must be a positive bigint');
  return value as Micros;
}

export type SafetyEnvironment = 'LOCAL' | 'TESTNET_DEMO' | 'MAINNET_READONLY' | 'MAINNET_EXECUTION';
export type SafetyNetwork = 'local' | 'monad-testnet' | 'monad-mainnet';
export type ProtocolCapability = 'generic-risk-preview-v0';
export type MarketSelector = string;
export type ActionIntentFamily = 'REDUCE_POSITION' | 'CLOSE_POSITION';
export type ObservationQuality = 'FRESH' | 'STALE' | 'UNKNOWN' | 'INCONSISTENT';
export type PolicyState =
  'DRAFT' | 'VALIDATED' | 'USER_CONFIRMED' | 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'EXPIRED';
export type ExecutionState =
  | 'OBSERVED'
  | 'ELIGIBLE'
  | 'PLANNED'
  | 'PREFLIGHTED'
  | 'AUTHORIZED'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'REFUSED'
  | 'FAILED'
  | 'UNKNOWN'
  | 'RECOVERY_REQUIRED';

export interface RiskMetric {
  readonly name: string;
  /** Percentages use integer basis points. Unknown values are represented with quality, never zero. */
  readonly valueBps?: BasisPoints;
  readonly quality: ObservationQuality;
  readonly observedAt: string;
}

export interface RiskSnapshot {
  readonly schemaVersion: '0.1';
  readonly snapshotId: SnapshotId;
  readonly observedAt: string;
  readonly quality: ObservationQuality;
  readonly metrics: readonly RiskMetric[];
}

export interface Policy {
  readonly schemaVersion: '0.1';
  readonly policyId: PolicyId;
  readonly environment: SafetyEnvironment;
  readonly state: PolicyState;
}

export interface PolicyVersion {
  readonly [immutablePolicyVersionBrand]: true;
  readonly schemaVersion: '0.1';
  readonly policyId: PolicyId;
  readonly policyVersionId: PolicyVersionId;
  readonly version: number;
  readonly canonicalHash: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly immutable: boolean;
}

export interface TriggerEvaluation {
  readonly schemaVersion: '0.1';
  readonly snapshotId: SnapshotId;
  readonly policyVersionId: PolicyVersionId;
  readonly result: 'MATCH' | 'NO_MATCH' | 'REFUSED';
  readonly reason: string;
}

export interface ExecutionPlan {
  readonly [verifiedExecutionPlanBrand]: true;
  readonly schemaVersion: '0.1';
  readonly planId: PlanId;
  readonly policyVersionId: PolicyVersionId;
  readonly snapshotId: SnapshotId;
  readonly digest: string;
  readonly expiresAt: string;
  readonly actionFamily: ActionIntentFamily;
  readonly actionFractionBps: number;
  readonly notionalMicros: string;
  readonly network: SafetyNetwork;
  readonly protocolCapability: ProtocolCapability;
  readonly marketSelector: MarketSelector;
  readonly slippageBps: number;
}

export interface ExecutionPlanInput {
  readonly planId: PlanId;
  readonly policyVersionId: PolicyVersionId;
  readonly snapshotId: SnapshotId;
  readonly expiresAt: string;
  readonly actionFamily: ActionIntentFamily;
  readonly actionFractionBps: number;
  readonly notionalMicros: string;
  readonly network: SafetyNetwork;
  readonly protocolCapability: ProtocolCapability;
  readonly marketSelector: MarketSelector;
  readonly slippageBps: number;
}

export interface AuthorizationContext {
  readonly schemaVersion: '0.1';
  readonly planDigest: string;
  readonly policyVersionId: PolicyVersionId;
  readonly expiresAt: string;
  readonly decision: 'APPROVED' | 'REFUSED';
}

export interface PolicyConfirmation {
  readonly schemaVersion: '0.1';
  readonly policyVersionId: PolicyVersionId;
  readonly canonicalHash: string;
  readonly confirmedAt: string;
  readonly actor: string;
}

export interface ExecutionAttempt {
  readonly schemaVersion: '0.1';
  readonly idempotencyKey: IdempotencyKey;
  readonly state: ExecutionState;
  readonly effectStatus: 'NONE' | 'APPLIED' | 'UNKNOWN';
}

export interface ExecutionReceipt {
  readonly schemaVersion: '0.1';
  readonly idempotencyKey: IdempotencyKey;
  readonly outcome: 'CONFIRMED' | 'REFUSED' | 'FAILED' | 'UNKNOWN' | 'RECOVERY_REQUIRED';
  readonly reason: string;
  readonly createdAt: string;
}

export interface IntegrationHealth {
  readonly schemaVersion: '0.1';
  readonly integration: string;
  readonly status: 'HEALTHY' | 'DEGRADED' | 'STALE' | 'UNKNOWN';
  readonly observedAt: string;
  readonly correlationId: CorrelationId;
}

const policyTransitions: Readonly<Record<PolicyState, readonly PolicyState[]>> = {
  DRAFT: ['VALIDATED'],
  VALIDATED: ['USER_CONFIRMED'],
  USER_CONFIRMED: ['ACTIVE'],
  ACTIVE: ['PAUSED', 'REVOKED', 'EXPIRED'],
  PAUSED: ['ACTIVE', 'REVOKED', 'EXPIRED'],
  REVOKED: [],
  EXPIRED: [],
};

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const object = value as Record<string, unknown>;
  const prototype = Object.getPrototypeOf(object);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  if (Object.getOwnPropertySymbols(object).length > 0) return undefined;
  const ownKeys = Object.keys(object);
  if (ownKeys.length !== keys.length || keys.some((key) => !Object.hasOwn(object, key)))
    return undefined;
  if (ownKeys.some((key) => !keys.includes(key))) return undefined;
  if (ownKeys.some((key) => !('value' in Object.getOwnPropertyDescriptor(object, key)!)))
    return undefined;
  return object;
}

function boundedMarket(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    value.length >= 1 &&
    value.length <= 80 &&
    /^[a-z0-9][a-z0-9._/-]*$/i.test(value)
  );
}

/** Strict runtime validation used by the transition itself, not a caller-supplied boolean. */
function isValidPolicyForTransition(value: unknown): boolean {
  const policy = exactRecord(value, [
    'schemaVersion',
    'policyId',
    'version',
    'environment',
    'scope',
    'triggers',
    'actionIntent',
    'constraints',
    'safetyBehavior',
    'metadata',
  ]);
  if (!policy || policy.schemaVersion !== '0.1') return false;
  if (
    typeof policy.policyId !== 'string' ||
    policy.policyId !== policy.policyId.trim() ||
    policy.policyId.length < 1 ||
    policy.policyId.length > 200 ||
    !Number.isInteger(policy.version) ||
    (policy.version as number) < 1 ||
    (policy.version as number) > 2_147_483_647
  )
    return false;
  if (!['LOCAL', 'TESTNET_DEMO', 'MAINNET_READONLY'].includes(String(policy.environment)))
    return false;
  const scope = exactRecord(policy.scope, ['network', 'protocolCapability', 'marketSelector']);
  if (
    !scope ||
    scope.protocolCapability !== 'generic-risk-preview-v0' ||
    !boundedMarket(scope.marketSelector)
  )
    return false;
  const expectedNetwork = {
    LOCAL: 'local',
    TESTNET_DEMO: 'monad-testnet',
    MAINNET_READONLY: 'monad-mainnet',
  }[policy.environment as 'LOCAL' | 'TESTNET_DEMO' | 'MAINNET_READONLY'];
  if (scope.network !== expectedNetwork) return false;
  const triggers = policy.triggers;
  if (!Array.isArray(triggers) || triggers.length < 1 || triggers.length > 16) return false;
  const triggerFamilies = new Set<string>();
  for (const value of triggers) {
    const trigger = exactRecord(value, ['family', 'thresholdBps']);
    if (
      !trigger ||
      !['LIQUIDATION_MARGIN_THRESHOLD', 'DRAWDOWN_THRESHOLD', 'FUNDING_THRESHOLD'].includes(
        String(trigger.family),
      ) ||
      !Number.isInteger(trigger.thresholdBps) ||
      (trigger.thresholdBps as number) < 1 ||
      (trigger.thresholdBps as number) > 10_000 ||
      triggerFamilies.has(String(trigger.family))
    )
      return false;
    triggerFamilies.add(String(trigger.family));
  }
  const action = exactRecord(policy.actionIntent, ['family', 'maxActionFractionBps']);
  const constraints = exactRecord(policy.constraints, [
    'maxActionFractionBps',
    'maxNotionalMicros',
    'maxSlippageBps',
    'cooldownSeconds',
    'expiresAt',
    'allowedProtocols',
    'allowedMarkets',
  ]);
  if (
    !action ||
    !['REDUCE_POSITION', 'CLOSE_POSITION'].includes(String(action.family)) ||
    !Number.isInteger(action.maxActionFractionBps) ||
    (action.maxActionFractionBps as number) < 1 ||
    (action.maxActionFractionBps as number) > 10_000 ||
    !constraints ||
    !Number.isInteger(constraints.maxActionFractionBps) ||
    (constraints.maxActionFractionBps as number) < 1 ||
    (constraints.maxActionFractionBps as number) > 10_000 ||
    (action.maxActionFractionBps as number) > (constraints.maxActionFractionBps as number) ||
    typeof constraints.maxNotionalMicros !== 'string' ||
    !/^[1-9][0-9]{0,37}$/.test(constraints.maxNotionalMicros) ||
    !Number.isInteger(constraints.maxSlippageBps) ||
    (constraints.maxSlippageBps as number) < 0 ||
    (constraints.maxSlippageBps as number) > 10_000 ||
    !Number.isInteger(constraints.cooldownSeconds) ||
    (constraints.cooldownSeconds as number) < 0 ||
    (constraints.cooldownSeconds as number) > 31_536_000 ||
    typeof constraints.expiresAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      constraints.expiresAt,
    ) ||
    !Number.isFinite(Date.parse(constraints.expiresAt))
  )
    return false;
  const protocols = constraints.allowedProtocols;
  const markets = constraints.allowedMarkets;
  if (
    !Array.isArray(protocols) ||
    protocols.length < 1 ||
    protocols.length > 16 ||
    protocols.some((entry) => entry !== 'generic-risk-preview-v0') ||
    new Set(protocols).size !== protocols.length ||
    !protocols.includes(scope.protocolCapability as string) ||
    !Array.isArray(markets) ||
    markets.length < 1 ||
    markets.length > 64 ||
    markets.some((entry) => !boundedMarket(entry)) ||
    new Set(markets).size !== markets.length ||
    !markets.includes(scope.marketSelector)
  )
    return false;
  const metadata = exactRecord(policy.metadata, ['label', 'description']);
  if (
    policy.safetyBehavior !== 'REFUSE' ||
    !metadata ||
    typeof metadata.label !== 'string' ||
    metadata.label !== metadata.label.trim() ||
    metadata.label.length < 1 ||
    metadata.label.length > 80 ||
    typeof metadata.description !== 'string' ||
    metadata.description !== metadata.description.trim() ||
    metadata.description.length > 500
  )
    return false;
  return true;
}

function isTrustedImmutablePolicyVersion(value: unknown): value is PolicyVersion {
  if (value === null || typeof value !== 'object') return false;
  const version = value as PolicyVersion;
  return (
    immutablePolicyVersions.has(value) &&
    version.immutable === true &&
    Object.isFrozen(value) &&
    Object.isFrozen(version.payload) &&
    /^[0-9a-f]{64}$/.test(version.canonicalHash) &&
    isValidPolicyForTransition(version.payload) &&
    version.payload.policyId === version.policyId &&
    version.payload.version === version.version &&
    version.policyVersionId === asPolicyVersionId(`${version.policyId}:v${version.version}`)
  );
}

function isBoundPolicyConfirmation(
  version: unknown,
  confirmation: PolicyConfirmation | undefined,
): boolean {
  return (
    isTrustedImmutablePolicyVersion(version) &&
    confirmation?.schemaVersion === '0.1' &&
    confirmation.policyVersionId === version.policyVersionId &&
    confirmation.canonicalHash === version.canonicalHash &&
    typeof confirmation.actor === 'string' &&
    confirmation.actor === confirmation.actor.trim() &&
    confirmation.actor.length > 0 &&
    confirmation.actor.length <= 200 &&
    Number.isFinite(Date.parse(confirmation.confirmedAt))
  );
}

function policyActionAuthority(version: PolicyVersion): {
  actionFamily: ActionIntentFamily;
  actionFractionBps: number;
  notionalMicros: string;
  network: SafetyNetwork;
  protocolCapability: ProtocolCapability;
  marketSelector: MarketSelector;
  allowedProtocols: readonly string[];
  allowedMarkets: readonly string[];
  maxSlippageBps: number;
  expiresAt: string;
  environment: SafetyEnvironment;
} {
  const action = version.payload.actionIntent as {
    family: ActionIntentFamily;
    maxActionFractionBps: number;
  };
  const constraints = version.payload.constraints as {
    maxActionFractionBps: number;
    maxNotionalMicros: string;
    maxSlippageBps: number;
    allowedProtocols: readonly string[];
    allowedMarkets: readonly string[];
    expiresAt: string;
  };
  const scope = version.payload.scope as {
    network: SafetyNetwork;
    protocolCapability: ProtocolCapability;
    marketSelector: MarketSelector;
  };
  const environment = version.payload.environment as SafetyEnvironment;
  return {
    actionFamily: action.family,
    actionFractionBps: Math.min(action.maxActionFractionBps, constraints.maxActionFractionBps),
    notionalMicros: constraints.maxNotionalMicros,
    network: scope.network,
    protocolCapability: scope.protocolCapability,
    marketSelector: scope.marketSelector,
    allowedProtocols: constraints.allowedProtocols,
    allowedMarkets: constraints.allowedMarkets,
    maxSlippageBps: constraints.maxSlippageBps,
    expiresAt: constraints.expiresAt,
    environment,
  };
}

function isTrustedExecutionPlan(value: unknown): value is ExecutionPlan {
  if (value === null || typeof value !== 'object') return false;
  const plan = value as ExecutionPlan;
  return (
    verifiedExecutionPlans.has(value) &&
    plan.schemaVersion === '0.1' &&
    Object.isFrozen(value) &&
    typeof plan.digest === 'string' &&
    /^[0-9a-f]{64}$/.test(plan.digest) &&
    ['REDUCE_POSITION', 'CLOSE_POSITION'].includes(plan.actionFamily) &&
    Number.isInteger(plan.actionFractionBps) &&
    plan.actionFractionBps >= 1 &&
    plan.actionFractionBps <= 10_000 &&
    /^[1-9][0-9]{0,37}$/.test(plan.notionalMicros) &&
    ['local', 'monad-testnet', 'monad-mainnet'].includes(plan.network) &&
    plan.protocolCapability === 'generic-risk-preview-v0' &&
    typeof plan.marketSelector === 'string' &&
    plan.marketSelector === plan.marketSelector.trim() &&
    plan.marketSelector.length >= 1 &&
    plan.marketSelector.length <= 80 &&
    /^[a-z0-9][a-z0-9._/-]*$/i.test(plan.marketSelector) &&
    Number.isInteger(plan.slippageBps) &&
    plan.slippageBps >= 0 &&
    plan.slippageBps <= 10_000 &&
    Number.isFinite(Date.parse(plan.expiresAt))
  );
}

export function transitionPolicy(
  current: PolicyState,
  next: PolicyState,
  guards: {
    policyToValidate?: unknown;
    policyVersion?: PolicyVersion;
    confirmation?: PolicyConfirmation;
    now?: string;
  } = {},
): PolicyState {
  if (!policyTransitions[current].includes(next))
    throw new Error(`Illegal policy transition: ${current} -> ${next}`);
  if (next === 'VALIDATED') {
    if (!isValidPolicyForTransition(guards.policyToValidate))
      throw new Error('Validation requires a successful strict policy-schema result');
    const policy = guards.policyToValidate as { constraints: { expiresAt: string } };
    if (!hasValidExpiry(policy.constraints.expiresAt, guards.now))
      throw new Error('An expired policy cannot advance to VALIDATED');
  }
  if (next === 'USER_CONFIRMED') {
    if (
      !isBoundPolicyConfirmation(guards.policyVersion, guards.confirmation) ||
      !isTrustedImmutablePolicyVersion(guards.policyVersion) ||
      !hasValidExpiry(policyActionAuthority(guards.policyVersion).expiresAt, guards.now)
    )
      throw new Error('Confirmation must bind an actor and immutable policy-version hash');
  }
  if (
    next === 'ACTIVE' &&
    (!isBoundPolicyConfirmation(guards.policyVersion, guards.confirmation) ||
      !isTrustedImmutablePolicyVersion(guards.policyVersion) ||
      !hasValidExpiry(policyActionAuthority(guards.policyVersion).expiresAt, guards.now))
  )
    throw new Error(
      'Activation requires a current confirmation bound to the immutable policy version',
    );
  return next;
}

const executionTransitions: Readonly<Record<ExecutionState, readonly ExecutionState[]>> = {
  OBSERVED: ['ELIGIBLE', 'REFUSED'],
  ELIGIBLE: ['PLANNED', 'REFUSED'],
  PLANNED: ['PREFLIGHTED', 'REFUSED', 'FAILED'],
  PREFLIGHTED: ['AUTHORIZED', 'REFUSED', 'FAILED'],
  AUTHORIZED: ['SUBMITTED', 'REFUSED', 'FAILED'],
  SUBMITTED: ['CONFIRMED', 'FAILED', 'UNKNOWN', 'RECOVERY_REQUIRED'],
  CONFIRMED: [],
  REFUSED: [],
  FAILED: ['RECOVERY_REQUIRED'],
  UNKNOWN: ['RECOVERY_REQUIRED'],
  RECOVERY_REQUIRED: [],
};

export interface ExecutionTransitionGuards {
  readonly idempotencyKey?: IdempotencyKey;
  readonly alreadyAppliedKeys?: ReadonlySet<string>;
  readonly effectStatus?: 'NONE' | 'APPLIED' | 'UNKNOWN';
  readonly globalExecutionDisabled?: boolean;
  readonly environment?: SafetyEnvironment;
  readonly demoOnly?: boolean;
  readonly policyState?: PolicyState;
  readonly policyVersion?: PolicyVersion;
  readonly plan?: ExecutionPlan;
  readonly observationQuality?: ObservationQuality;
  readonly now?: string;
  readonly authorizationContext?: AuthorizationContext;
}

function hasValidExpiry(expiryValue: string | undefined, nowValue: string | undefined): boolean {
  const expiry = Date.parse(expiryValue ?? '');
  const now = Date.parse(nowValue ?? '');
  return Number.isFinite(expiry) && Number.isFinite(now) && expiry > now;
}

export function isPlanWithinPolicyAuthority(input: {
  readonly planActionFractionBps: number;
  readonly policyMaxActionFractionBps: number;
  readonly planNotionalMicros: string;
  readonly policyMaxNotionalMicros: string;
  readonly planActionFamily: ActionIntentFamily;
  readonly policyActionFamily: ActionIntentFamily;
  readonly planNetwork: SafetyNetwork;
  readonly policyNetwork: SafetyNetwork;
  readonly planProtocolCapability: ProtocolCapability;
  readonly policyProtocolCapability: ProtocolCapability;
  readonly allowedProtocols: readonly string[];
  readonly planMarketSelector: MarketSelector;
  readonly policyMarketSelector: MarketSelector;
  readonly allowedMarkets: readonly string[];
  readonly planSlippageBps: number;
  readonly policyMaxSlippageBps: number;
}): boolean {
  if (
    input === null ||
    typeof input !== 'object' ||
    !Number.isInteger(input.planActionFractionBps) ||
    input.planActionFractionBps < 1 ||
    input.planActionFractionBps > 10_000 ||
    !Number.isInteger(input.policyMaxActionFractionBps) ||
    input.policyMaxActionFractionBps < 1 ||
    input.policyMaxActionFractionBps > 10_000 ||
    input.planActionFractionBps > input.policyMaxActionFractionBps ||
    !/^[1-9][0-9]{0,37}$/.test(input.planNotionalMicros) ||
    !/^[1-9][0-9]{0,37}$/.test(input.policyMaxNotionalMicros) ||
    !['REDUCE_POSITION', 'CLOSE_POSITION'].includes(input.planActionFamily) ||
    !['REDUCE_POSITION', 'CLOSE_POSITION'].includes(input.policyActionFamily) ||
    input.planActionFamily !== input.policyActionFamily ||
    !['local', 'monad-testnet', 'monad-mainnet'].includes(input.planNetwork) ||
    !['local', 'monad-testnet', 'monad-mainnet'].includes(input.policyNetwork) ||
    input.planNetwork !== input.policyNetwork ||
    input.planProtocolCapability !== 'generic-risk-preview-v0' ||
    input.policyProtocolCapability !== 'generic-risk-preview-v0' ||
    input.planProtocolCapability !== input.policyProtocolCapability ||
    !Array.isArray(input.allowedProtocols) ||
    !input.allowedProtocols.includes(input.planProtocolCapability) ||
    typeof input.planMarketSelector !== 'string' ||
    input.planMarketSelector !== input.planMarketSelector.trim() ||
    input.planMarketSelector.length < 1 ||
    input.planMarketSelector.length > 80 ||
    !/^[a-z0-9][a-z0-9._/-]*$/i.test(input.planMarketSelector) ||
    typeof input.policyMarketSelector !== 'string' ||
    input.policyMarketSelector !== input.policyMarketSelector.trim() ||
    input.policyMarketSelector.length < 1 ||
    input.policyMarketSelector.length > 80 ||
    !/^[a-z0-9][a-z0-9._/-]*$/i.test(input.policyMarketSelector) ||
    input.planMarketSelector !== input.policyMarketSelector ||
    !Array.isArray(input.allowedMarkets) ||
    !input.allowedMarkets.includes(input.planMarketSelector) ||
    !Number.isInteger(input.planSlippageBps) ||
    input.planSlippageBps < 0 ||
    input.planSlippageBps > input.policyMaxSlippageBps ||
    !Number.isInteger(input.policyMaxSlippageBps) ||
    input.policyMaxSlippageBps < 0 ||
    input.policyMaxSlippageBps > 10_000
  )
    return false;
  return BigInt(input.planNotionalMicros) <= BigInt(input.policyMaxNotionalMicros);
}

function transitionPlanWithinAuthority(guards: ExecutionTransitionGuards): boolean {
  if (
    !isTrustedExecutionPlan(guards.plan) ||
    !isTrustedImmutablePolicyVersion(guards.policyVersion)
  )
    return false;
  const authority = policyActionAuthority(guards.policyVersion);
  if (
    guards.plan.policyVersionId !== guards.policyVersion.policyVersionId ||
    authority.environment !== guards.environment
  )
    return false;
  return isPlanWithinPolicyAuthority({
    planActionFamily: guards.plan.actionFamily,
    policyActionFamily: authority.actionFamily,
    planActionFractionBps: guards.plan.actionFractionBps,
    policyMaxActionFractionBps: authority.actionFractionBps,
    planNotionalMicros: guards.plan.notionalMicros,
    policyMaxNotionalMicros: authority.notionalMicros,
    planNetwork: guards.plan.network,
    policyNetwork: authority.network,
    planProtocolCapability: guards.plan.protocolCapability,
    policyProtocolCapability: authority.protocolCapability,
    allowedProtocols: authority.allowedProtocols,
    planMarketSelector: guards.plan.marketSelector,
    policyMarketSelector: authority.marketSelector,
    allowedMarkets: authority.allowedMarkets,
    planSlippageBps: guards.plan.slippageBps,
    policyMaxSlippageBps: authority.maxSlippageBps,
  });
}

export function transitionExecution(
  current: ExecutionState,
  next: ExecutionState,
  guards: ExecutionTransitionGuards = {},
): ExecutionState {
  if (!executionTransitions[current].includes(next))
    throw new Error(`Illegal execution transition: ${current} -> ${next}`);
  const safetyGated = next === 'ELIGIBLE' || next === 'AUTHORIZED' || next === 'SUBMITTED';
  if (safetyGated && guards.globalExecutionDisabled !== false)
    throw new Error('Global kill switch blocks progression');
  if (safetyGated && guards.environment !== 'LOCAL')
    throw new Error('Safety-gated progression requires explicit LOCAL environment');
  if (safetyGated && guards.demoOnly !== false)
    throw new Error('DEMO_ONLY context cannot authorize or submit');
  if (safetyGated && guards.policyState !== 'ACTIVE')
    throw new Error('Progression requires an ACTIVE policy');
  if (safetyGated && !isTrustedImmutablePolicyVersion(guards.policyVersion))
    throw new Error('Progression requires an immutable policy version');
  if (safetyGated && !transitionPlanWithinAuthority(guards))
    throw new Error('Plan exceeds or has not proven policy authority');
  if (safetyGated && guards.observationQuality !== 'FRESH')
    throw new Error('Progression requires fresh observations');
  const expiryGated = safetyGated || next === 'PLANNED' || next === 'PREFLIGHTED';
  if (expiryGated) {
    if (
      !isTrustedImmutablePolicyVersion(guards.policyVersion) ||
      !hasValidExpiry(policyActionAuthority(guards.policyVersion).expiresAt, guards.now)
    )
      throw new Error('Policy is expired or has no valid expiry');
    if (!isTrustedExecutionPlan(guards.plan) || !hasValidExpiry(guards.plan.expiresAt, guards.now))
      throw new Error('Plan is expired or has no valid expiry');
  }
  if (next === 'AUTHORIZED' || next === 'SUBMITTED') {
    if (
      !guards.authorizationContext ||
      !isTrustedExecutionPlan(guards.plan) ||
      !isTrustedImmutablePolicyVersion(guards.policyVersion) ||
      !guards.now
    ) {
      throw new Error('Authorization binding is missing, refused, expired, or mismatched');
    }
    const binding = verifyAuthorizationBinding({
      authorization: guards.authorizationContext,
      planDigest: guards.plan.digest,
      policyVersionId: guards.policyVersion.policyVersionId,
      now: guards.now,
    });
    if (binding.status !== 'BOUND')
      throw new Error(
        `Authorization binding is missing, refused, expired, or mismatched: ${binding.reason}`,
      );
  }
  if (guards.effectStatus === 'UNKNOWN' && next !== 'RECOVERY_REQUIRED') {
    throw new Error(
      'UNKNOWN effect cannot be retried or advanced automatically; recovery is required',
    );
  }
  if (next === 'SUBMITTED') {
    if (!guards.idempotencyKey || !guards.alreadyAppliedKeys)
      throw new Error('Submission requires a checked idempotency identity');
    if (guards.alreadyAppliedKeys.has(guards.idempotencyKey))
      throw new Error('Duplicate idempotency key cannot create a second effect');
  }
  return next;
}

export interface EligibilityInput {
  readonly policyState: PolicyState;
  readonly policyVersion: PolicyVersion;
  readonly plan: ExecutionPlan;
  readonly now: string;
  readonly observationQuality: ObservationQuality;
  readonly executionEnabled: boolean;
  /** true means the global control is actively denying progression. */
  readonly globalExecutionDisabled: boolean;
  readonly environment: SafetyEnvironment;
  readonly demoOnly: boolean;
}

export type EligibilityDecision =
  | { readonly status: 'ELIGIBLE'; readonly executionEnabled: false }
  | { readonly status: 'REFUSED'; readonly executionEnabled: false; readonly reason: string };

export function decideEligibility(input: EligibilityInput): EligibilityDecision {
  const refuse = (reason: string): EligibilityDecision => ({
    status: 'REFUSED',
    executionEnabled: false,
    reason,
  });
  if (
    input === null ||
    typeof input !== 'object' ||
    typeof input.globalExecutionDisabled !== 'boolean' ||
    typeof input.executionEnabled !== 'boolean' ||
    typeof input.demoOnly !== 'boolean' ||
    !['LOCAL', 'TESTNET_DEMO', 'MAINNET_READONLY', 'MAINNET_EXECUTION'].includes(input.environment)
  )
    return refuse('SAFETY_CONTEXT_INVALID');
  if (input.environment === 'MAINNET_EXECUTION') return refuse('MAINNET_EXECUTION_DISABLED');
  if (input.environment === 'MAINNET_READONLY') return refuse('MAINNET_READONLY');
  if (input.demoOnly || input.environment === 'TESTNET_DEMO') return refuse('DEMO_ONLY');
  if (input.globalExecutionDisabled !== false) return refuse('KILL_SWITCH_ENABLED');
  if (input.executionEnabled !== false) return refuse('EXECUTION_DISABLED_IN_M01');
  if (input.policyState !== 'ACTIVE') return refuse('POLICY_NOT_ACTIVE');
  if (!isTrustedImmutablePolicyVersion(input.policyVersion))
    return refuse('POLICY_VERSION_MUTABLE');
  if (!isTrustedExecutionPlan(input.plan)) return refuse('PLAN_INVALID');
  if (input.plan.policyVersionId !== input.policyVersion.policyVersionId)
    return refuse('POLICY_VERSION_MISMATCH');
  const authority = policyActionAuthority(input.policyVersion);
  if (
    !isPlanWithinPolicyAuthority({
      planActionFamily: input.plan.actionFamily,
      policyActionFamily: authority.actionFamily,
      planActionFractionBps: input.plan.actionFractionBps,
      policyMaxActionFractionBps: authority.actionFractionBps,
      planNotionalMicros: input.plan.notionalMicros,
      policyMaxNotionalMicros: authority.notionalMicros,
      planNetwork: input.plan.network,
      policyNetwork: authority.network,
      planProtocolCapability: input.plan.protocolCapability,
      policyProtocolCapability: authority.protocolCapability,
      allowedProtocols: authority.allowedProtocols,
      planMarketSelector: input.plan.marketSelector,
      policyMarketSelector: authority.marketSelector,
      allowedMarkets: authority.allowedMarkets,
      planSlippageBps: input.plan.slippageBps,
      policyMaxSlippageBps: authority.maxSlippageBps,
    })
  )
    return refuse('PLAN_EXCEEDS_POLICY');
  if (authority.environment !== input.environment) return refuse('POLICY_ENVIRONMENT_MISMATCH');
  if (input.observationQuality !== 'FRESH') return refuse('OBSERVATION_NOT_FRESH');
  if (!hasValidExpiry(authority.expiresAt, input.now)) return refuse('POLICY_EXPIRED');
  if (!hasValidExpiry(input.plan.expiresAt, input.now)) return refuse('PLAN_EXPIRED');
  // M01 can make a deterministic eligible plan, but never enables a financial effect.
  return { status: 'ELIGIBLE', executionEnabled: false };
}

export type AuthorizationBindingDecision =
  | { readonly status: 'BOUND'; readonly executionEnabled: false }
  | { readonly status: 'REFUSED'; readonly executionEnabled: false; readonly reason: string };

export function verifyAuthorizationBinding(input: {
  readonly authorization: AuthorizationContext;
  readonly planDigest: string;
  readonly policyVersionId: PolicyVersionId;
  readonly now: string;
}): AuthorizationBindingDecision {
  const refuse = (reason: string): AuthorizationBindingDecision => ({
    status: 'REFUSED',
    executionEnabled: false,
    reason,
  });
  if (input.authorization.decision !== 'APPROVED') return refuse('AUTHORIZATION_REFUSED');
  if (input.authorization.planDigest !== input.planDigest) return refuse('PLAN_DIGEST_MISMATCH');
  if (input.authorization.policyVersionId !== input.policyVersionId)
    return refuse('POLICY_VERSION_MISMATCH');
  const expiry = Date.parse(input.authorization.expiresAt);
  const now = Date.parse(input.now);
  if (!Number.isFinite(expiry) || !Number.isFinite(now) || expiry <= now)
    return refuse('AUTHORIZATION_EXPIRED');
  return { status: 'BOUND', executionEnabled: false };
}

type CanonicalValue = null | boolean | number | string | CanonicalValue[];

function canonicalValue(value: unknown, seen: WeakSet<object>): CanonicalValue {
  if (value === null) return ['null'];
  if (typeof value === 'string') return ['string', value];
  if (typeof value === 'boolean') return ['boolean', value];
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new TypeError('Canonical JSON cannot contain non-finite numbers');
    return ['number', Object.is(value, -0) ? 0 : value];
  }
  if (typeof value === 'bigint') return ['bigint', value.toString(10)];
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime()))
      throw new TypeError('Canonical JSON cannot contain invalid dates');
    return ['date', value.toISOString()];
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError('Canonical JSON cannot contain cycles');
    seen.add(value);
    const items: CanonicalValue[] = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index))
        throw new TypeError('Canonical JSON cannot contain sparse arrays');
      items.push(canonicalValue(value[index], seen));
    }
    seen.delete(value);
    return ['array', items];
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if (seen.has(object)) throw new TypeError('Canonical JSON cannot contain cycles');
    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== null)
      throw new TypeError('Canonical JSON objects must be plain objects');
    if (Object.getOwnPropertySymbols(object).length > 0)
      throw new TypeError('Canonical JSON cannot contain symbol keys');
    seen.add(object);
    const result: CanonicalValue[] = [];
    for (const key of Object.keys(object).sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      if (!descriptor || !('value' in descriptor))
        throw new TypeError(`Canonical JSON cannot evaluate accessor at ${key}`);
      const member = descriptor.value as unknown;
      if (member === undefined || typeof member === 'function' || typeof member === 'symbol') {
        throw new TypeError(`Canonical JSON cannot contain unsupported value at ${key}`);
      }
      result.push(['entry', key, canonicalValue(member, seen)]);
    }
    seen.delete(object);
    return ['object', result];
  }
  throw new TypeError('Canonical JSON contains an unsupported value');
}

export function canonicalSerialize(value: unknown): string {
  return JSON.stringify(canonicalValue(value, new WeakSet()));
}

export async function canonicalHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalSerialize(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashPolicyVersion<T>(policy: T): Promise<string> {
  return canonicalHash(policy);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export async function createPolicyVersion<
  T extends { readonly schemaVersion: '0.1'; readonly policyId: string; readonly version: number },
>(policy: T): Promise<PolicyVersion> {
  if (!isValidPolicyForTransition(policy)) {
    throw new TypeError('Policy version requires a strict, bounded V0.1 policy payload');
  }
  if (
    !Number.isSafeInteger(policy.version) ||
    policy.version < 1 ||
    policy.version > 2_147_483_647
  ) {
    throw new RangeError('Policy version must be a positive safe integer');
  }
  const policyId = asPolicyId(policy.policyId);
  const payload = deepFreeze(structuredClone(policy)) as Readonly<Record<string, unknown>>;
  const version = Object.freeze({
    schemaVersion: '0.1',
    policyId,
    policyVersionId: asPolicyVersionId(`${policyId}:v${policy.version}`),
    version: policy.version,
    canonicalHash: await hashPolicyVersion(policy),
    payload,
    immutable: true,
  }) as PolicyVersion;
  immutablePolicyVersions.add(version);
  return version;
}

export async function hashExecutionPlan<T>(plan: T): Promise<string> {
  return canonicalHash(plan);
}

export async function createExecutionPlan(input: ExecutionPlanInput): Promise<ExecutionPlan> {
  const planId = asPlanId(input.planId);
  const policyVersionId = asPolicyVersionId(input.policyVersionId);
  const snapshotId = asSnapshotId(input.snapshotId);
  if (
    !Number.isInteger(input.actionFractionBps) ||
    input.actionFractionBps < 1 ||
    input.actionFractionBps > 10_000
  )
    throw new RangeError('Execution plan action fraction must be an integer in [1, 10000]');
  if (!/^[1-9][0-9]{0,37}$/.test(input.notionalMicros))
    throw new RangeError('Execution plan notional must be a positive canonical decimal amount');
  if (!['REDUCE_POSITION', 'CLOSE_POSITION'].includes(input.actionFamily))
    throw new TypeError('Execution plan action family is unsupported');
  if (!['local', 'monad-testnet', 'monad-mainnet'].includes(input.network))
    throw new TypeError('Execution plan network is unsupported');
  if (input.protocolCapability !== 'generic-risk-preview-v0')
    throw new TypeError('Execution plan protocol capability is unsupported in M01');
  if (
    typeof input.marketSelector !== 'string' ||
    input.marketSelector !== input.marketSelector.trim() ||
    input.marketSelector.length < 1 ||
    input.marketSelector.length > 80 ||
    !/^[a-z0-9][a-z0-9._/-]*$/i.test(input.marketSelector)
  )
    throw new TypeError('Execution plan market selector is invalid');
  if (!Number.isInteger(input.slippageBps) || input.slippageBps < 0 || input.slippageBps > 10_000)
    throw new RangeError('Execution plan slippage must be an integer in [0, 10000]');
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(input.expiresAt) ||
    !Number.isFinite(Date.parse(input.expiresAt))
  )
    throw new TypeError('Execution plan expiry must be a valid ISO timestamp with an offset');
  const body = {
    schemaVersion: '0.1' as const,
    planId,
    policyVersionId,
    snapshotId,
    expiresAt: input.expiresAt,
    actionFamily: input.actionFamily,
    actionFractionBps: input.actionFractionBps,
    notionalMicros: input.notionalMicros,
    network: input.network,
    protocolCapability: input.protocolCapability,
    marketSelector: input.marketSelector,
    slippageBps: input.slippageBps,
  };
  const digest = await canonicalHash(body);
  const plan = Object.freeze({
    ...body,
    digest,
  }) as ExecutionPlan;
  verifiedExecutionPlans.add(plan);
  return plan;
}
