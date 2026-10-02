import { beforeAll, describe, expect, it } from 'vitest';
import {
  asPlanId,
  asIdempotencyKey,
  asBasisPoints,
  asPolicyId,
  asPolicyVersionId,
  asSnapshotId,
  canonicalHash,
  canonicalSerialize,
  createExecutionPlan,
  createPolicyVersion,
  decideEligibility,
  isPlanWithinPolicyAuthority,
  transitionExecution,
  transitionPolicy,
  verifyAuthorizationBinding,
  type ExecutionState,
  type ExecutionPlan,
  type PolicyVersion,
  type PolicyVersionId,
} from './index.js';

const activePolicyPayload = {
  schemaVersion: '0.1' as const,
  policyId: 'policy-1',
  version: 1,
  environment: 'LOCAL' as const,
  scope: {
    network: 'local' as const,
    protocolCapability: 'generic-risk-preview-v0' as const,
    marketSelector: 'ETH-PERP',
  },
  triggers: [{ family: 'DRAWDOWN_THRESHOLD' as const, thresholdBps: 1_000 }],
  actionIntent: { family: 'REDUCE_POSITION' as const, maxActionFractionBps: 1_000 },
  constraints: {
    maxActionFractionBps: 1_000,
    maxNotionalMicros: '1000000',
    maxSlippageBps: 100,
    cooldownSeconds: 60,
    expiresAt: '2031-01-01T00:00:00.000Z',
    allowedProtocols: ['generic-risk-preview-v0' as const],
    allowedMarkets: ['ETH-PERP'],
  },
  safetyBehavior: 'REFUSE' as const,
  metadata: { label: 'Policy', description: 'Bounded policy' },
};

const planScopeDefaults = {
  actionFamily: 'REDUCE_POSITION' as const,
  network: 'local' as const,
  protocolCapability: 'generic-risk-preview-v0' as const,
  marketSelector: 'ETH-PERP',
  slippageBps: 50,
};
const matchingPolicyScope = {
  planActionFamily: 'REDUCE_POSITION' as const,
  policyActionFamily: 'REDUCE_POSITION' as const,
  planNetwork: 'local' as const,
  policyNetwork: 'local' as const,
  planProtocolCapability: 'generic-risk-preview-v0' as const,
  policyProtocolCapability: 'generic-risk-preview-v0' as const,
  allowedProtocols: ['generic-risk-preview-v0'],
  planMarketSelector: 'ETH-PERP',
  policyMarketSelector: 'ETH-PERP',
  allowedMarkets: ['ETH-PERP'],
  planSlippageBps: 50,
  policyMaxSlippageBps: 100,
};

let activePolicyVersion: PolicyVersion;
let activePlan: ExecutionPlan;
let eligibilityBase: Parameters<typeof decideEligibility>[0];
beforeAll(async () => {
  activePolicyVersion = await createPolicyVersion(activePolicyPayload);
  activePlan = await createExecutionPlan({
    ...planScopeDefaults,
    planId: asPlanId('plan-1'),
    policyVersionId: activePolicyVersion.policyVersionId,
    snapshotId: asSnapshotId('snapshot-1'),
    expiresAt: '2030-01-01T00:00:00.000Z',
    actionFractionBps: 500,
    notionalMicros: '500000',
  });
  eligibilityBase = {
    policyState: 'ACTIVE',
    policyVersion: activePolicyVersion,
    plan: activePlan,
    now: '2029-01-01T00:00:00.000Z',
    observationQuality: 'FRESH',
    executionEnabled: false,
    globalExecutionDisabled: false,
    environment: 'LOCAL',
    demoOnly: false,
  };
});

describe('M01-DOM-001 branded identifiers', () => {
  it('rejects blank identifiers and keeps policy and version IDs distinct', () => {
    expect(() => asPolicyId('  ')).toThrow();
    expect(asPolicyId('pol-1')).not.toBe(asPolicyVersionId('pol-1:v1'));
    expect(asIdempotencyKey('effect-1')).toBe('effect-1');
    const policyId = asPolicyId('pol-1');
    // @ts-expect-error branded policy IDs cannot be passed as policy-version IDs
    const wrongDomainId: PolicyVersionId = policyId;
    expect(wrongDomainId).toBe('pol-1');
  });
});

describe('M01-STATE-001 policy lifecycle', () => {
  it('allows only declared policy transitions and blocks invalid or expired policy versions', async () => {
    const policyToValidate = {
      schemaVersion: '0.1',
      policyId: 'policy-1',
      version: 1,
      environment: 'LOCAL',
      scope: {
        network: 'local',
        protocolCapability: 'generic-risk-preview-v0',
        marketSelector: 'ETH-PERP',
      },
      triggers: [{ family: 'DRAWDOWN_THRESHOLD', thresholdBps: 1_000 }],
      actionIntent: { family: 'REDUCE_POSITION', maxActionFractionBps: 2_500 },
      constraints: {
        maxActionFractionBps: 2_500,
        maxNotionalMicros: '100000000',
        maxSlippageBps: 100,
        cooldownSeconds: 60,
        expiresAt: '2030-01-01T00:00:00.000Z',
        allowedProtocols: ['generic-risk-preview-v0'],
        allowedMarkets: ['ETH-PERP'],
      },
      safetyBehavior: 'REFUSE',
      metadata: { label: 'Policy', description: 'Bounded policy' },
    };
    expect(() => transitionPolicy('DRAFT', 'VALIDATED')).toThrow(/validation/i);
    expect(
      transitionPolicy('DRAFT', 'VALIDATED', {
        policyToValidate,
        now: '2029-01-01T00:00:00.000Z',
      }),
    ).toBe('VALIDATED');
    expect(() =>
      transitionPolicy('DRAFT', 'VALIDATED', {
        policyToValidate: { ...policyToValidate, arbitraryExecutionData: true },
        now: '2029-01-01T00:00:00.000Z',
      }),
    ).toThrow(/validation/i);
    expect(() =>
      transitionPolicy('DRAFT', 'VALIDATED', {
        policyToValidate: {
          ...policyToValidate,
          constraints: { ...policyToValidate.constraints, expiresAt: '2028-01-01T00:00:00.000Z' },
        },
        now: '2029-01-01T00:00:00.000Z',
      }),
    ).toThrow(/expired/i);
    expect(() => transitionPolicy('DRAFT', 'ACTIVE')).toThrow();
    expect(() => transitionPolicy('REVOKED', 'ACTIVE')).toThrow();
    const confirmation = {
      schemaVersion: '0.1' as const,
      policyVersionId: activePolicyVersion.policyVersionId,
      canonicalHash: activePolicyVersion.canonicalHash,
      confirmedAt: '2029-01-01T00:00:00.000Z',
      actor: 'user-1',
    };
    const expiredPolicyVersion = await createPolicyVersion({
      ...activePolicyPayload,
      constraints: { ...activePolicyPayload.constraints, expiresAt: '2028-01-01T00:00:00.000Z' },
    });
    expect(() =>
      transitionPolicy('VALIDATED', 'USER_CONFIRMED', {
        policyVersion: expiredPolicyVersion,
        confirmation: {
          ...confirmation,
          policyVersionId: expiredPolicyVersion.policyVersionId,
          canonicalHash: expiredPolicyVersion.canonicalHash,
        },
        now: '2029-01-01T00:00:00.000Z',
      }),
    ).toThrow(/confirmation/i);
    expect(() => transitionPolicy('VALIDATED', 'USER_CONFIRMED')).toThrow(/confirmation/i);
    expect(
      transitionPolicy('VALIDATED', 'USER_CONFIRMED', {
        policyVersion: activePolicyVersion,
        confirmation,
        now: '2029-01-01T00:00:00.000Z',
      }),
    ).toBe('USER_CONFIRMED');
    expect(() => transitionPolicy('USER_CONFIRMED', 'ACTIVE')).toThrow(/confirmation/i);
    expect(
      transitionPolicy('USER_CONFIRMED', 'ACTIVE', {
        policyVersion: activePolicyVersion,
        confirmation,
        now: '2029-01-01T00:00:00.000Z',
      }),
    ).toBe('ACTIVE');
  });
});

describe('M01-STATE-002 execution lifecycle', () => {
  it('refuses illegal transitions and terminal-state retry', async () => {
    const eligible = {
      policyState: 'ACTIVE' as const,
      policyVersion: activePolicyVersion,
      plan: activePlan,
      observationQuality: 'FRESH' as const,
      now: '2029-01-01T00:00:00.000Z',
      globalExecutionDisabled: false,
      environment: 'LOCAL' as const,
      demoOnly: false,
    };
    expect(() => transitionExecution('OBSERVED', 'ELIGIBLE')).toThrow(/kill switch/i);
    expect(() =>
      transitionExecution('OBSERVED', 'ELIGIBLE', { globalExecutionDisabled: false }),
    ).toThrow(/environment/i);
    expect(transitionExecution('OBSERVED', 'ELIGIBLE', eligible)).toBe('ELIGIBLE');
    expect(() => transitionExecution('OBSERVED', 'AUTHORIZED')).toThrow();
    expect(() => transitionExecution('UNKNOWN', 'SUBMITTED')).toThrow();
    expect(() =>
      transitionExecution('PREFLIGHTED', 'AUTHORIZED', {
        ...eligible,
        globalExecutionDisabled: true,
        authorizationContext: {
          schemaVersion: '0.1',
          planDigest: activePlan.digest,
          policyVersionId: activePolicyVersion.policyVersionId,
          expiresAt: '2031-01-01T00:00:00.000Z',
          decision: 'APPROVED',
        },
      }),
    ).toThrow(/kill switch/i);
    expect(() =>
      transitionExecution('PREFLIGHTED', 'AUTHORIZED', {
        ...eligible,
        demoOnly: true,
        authorizationContext: {
          schemaVersion: '0.1',
          planDigest: activePlan.digest,
          policyVersionId: activePolicyVersion.policyVersionId,
          expiresAt: '2031-01-01T00:00:00.000Z',
          decision: 'APPROVED',
        },
      }),
    ).toThrow(/demo/i);
    expect(() =>
      transitionExecution('PREFLIGHTED', 'AUTHORIZED', {
        ...eligible,
        environment: 'TESTNET_DEMO',
        authorizationContext: {
          schemaVersion: '0.1',
          planDigest: activePlan.digest,
          policyVersionId: activePolicyVersion.policyVersionId,
          expiresAt: '2031-01-01T00:00:00.000Z',
          decision: 'APPROVED',
        },
      }),
    ).toThrow(/environment/i);
    expect(() =>
      transitionExecution('PREFLIGHTED', 'AUTHORIZED', {
        ...eligible,
        authorizationContext: {
          schemaVersion: '0.1',
          planDigest: 'other-plan',
          policyVersionId: activePolicyVersion.policyVersionId,
          expiresAt: '2031-01-01T00:00:00.000Z',
          decision: 'APPROVED',
        },
      }),
    ).toThrow(/binding/i);
    expect(
      transitionExecution('PREFLIGHTED', 'AUTHORIZED', {
        ...eligible,
        authorizationContext: {
          schemaVersion: '0.1',
          planDigest: activePlan.digest,
          policyVersionId: activePolicyVersion.policyVersionId,
          expiresAt: '2031-01-01T00:00:00.000Z',
          decision: 'APPROVED',
        },
      }),
    ).toBe('AUTHORIZED');
    expect(() =>
      transitionExecution('OBSERVED', 'ELIGIBLE', {
        ...eligible,
        environment: undefined,
      }),
    ).toThrow(/environment/i);
    expect(() =>
      transitionExecution('OBSERVED', 'ELIGIBLE', {
        ...eligible,
        demoOnly: undefined,
      }),
    ).toThrow(/demo/i);
    const forgedBinding = Object.assign({}, eligible, {
      authorizationBinding: { status: 'BOUND', executionEnabled: false },
    });
    expect(() => transitionExecution('PREFLIGHTED', 'AUTHORIZED', forgedBinding)).toThrow(
      /binding/i,
    );
    const expiredPolicyVersion = await createPolicyVersion({
      ...activePolicyPayload,
      constraints: { ...activePolicyPayload.constraints, expiresAt: '2028-01-01T00:00:00.000Z' },
    });
    expect(() =>
      transitionExecution('OBSERVED', 'ELIGIBLE', {
        ...eligible,
        policyVersion: expiredPolicyVersion,
      }),
    ).toThrow(/policy.*expired/i);
    const expiredPlan = await createExecutionPlan({
      ...planScopeDefaults,
      planId: asPlanId('plan-expired'),
      policyVersionId: activePolicyVersion.policyVersionId,
      snapshotId: asSnapshotId('snapshot-1'),
      expiresAt: '2028-01-01T00:00:00.000Z',
      actionFractionBps: 500,
      notionalMicros: '500000',
    });
    expect(() =>
      transitionExecution('ELIGIBLE', 'PLANNED', {
        ...eligible,
        plan: expiredPlan,
      }),
    ).toThrow(/plan.*expired/i);
  });
});

describe('M01-DET-001 canonical serialization', () => {
  it('produces the same canonical bytes and digest regardless of key order', async () => {
    const left = { z: 1, nested: { b: true, a: 'x' }, a: [2, 1] };
    const right = { a: [2, 1], nested: { a: 'x', b: true }, z: 1 };
    expect(canonicalSerialize(left)).toBe(canonicalSerialize(right));
    expect(await canonicalHash(left)).toBe(await canonicalHash(right));
  });

  it('uses bounded integer basis points and exact bigint serialization for money', () => {
    expect(asBasisPoints(10_000)).toBe(10_000);
    expect(() => asBasisPoints(0.25)).toThrow();
    expect(() => asBasisPoints(10_001)).toThrow();
    expect(canonicalSerialize({ notionalMicros: 9_007_199_254_740_993n })).toContain(
      '9007199254740993',
    );
    expect(canonicalSerialize({ notional: 1n })).not.toBe(
      canonicalSerialize({ notional: { $bigint: '1' } }),
    );
    const sparse: unknown[] = [];
    sparse.length = 1;
    expect(() => canonicalSerialize(sparse)).toThrow(/sparse/i);
  });
});

describe('M01-AUTH-001/002, DATA-001, KILL-001, ENV-001, DEMO-001', () => {
  it('permits eligibility only for an active immutable policy and bounded plan', async () => {
    expect(decideEligibility(eligibilityBase).status).toBe('ELIGIBLE');
    const excessiveActionPlan = await createExecutionPlan({
      ...planScopeDefaults,
      planId: asPlanId('plan-excessive-action'),
      policyVersionId: activePolicyVersion.policyVersionId,
      snapshotId: asSnapshotId('snapshot-1'),
      expiresAt: activePlan.expiresAt,
      actionFractionBps: 1_001,
      notionalMicros: activePlan.notionalMicros,
    });
    expect(
      decideEligibility({
        ...eligibilityBase,
        plan: excessiveActionPlan,
      }),
    ).toMatchObject({
      status: 'REFUSED',
      reason: 'PLAN_EXCEEDS_POLICY',
    });
    const excessiveNotionalPlan = await createExecutionPlan({
      ...planScopeDefaults,
      planId: asPlanId('plan-excessive-notional'),
      policyVersionId: activePolicyVersion.policyVersionId,
      snapshotId: asSnapshotId('snapshot-1'),
      expiresAt: activePlan.expiresAt,
      actionFractionBps: activePlan.actionFractionBps,
      notionalMicros: '1000001',
    });
    expect(decideEligibility({ ...eligibilityBase, plan: excessiveNotionalPlan })).toMatchObject({
      status: 'REFUSED',
      reason: 'PLAN_EXCEEDS_POLICY',
    });
    expect(decideEligibility({ ...eligibilityBase, policyState: 'DRAFT' })).toMatchObject({
      status: 'REFUSED',
      reason: 'POLICY_NOT_ACTIVE',
    });
    expect(
      decideEligibility({
        ...eligibilityBase,
        policyVersion: { ...activePolicyVersion, immutable: false } as PolicyVersion,
      }),
    ).toMatchObject({
      status: 'REFUSED',
      reason: 'POLICY_VERSION_MUTABLE',
    });
  });

  it('refuses mismatched bindings, expired plans and stale or unknown observations', async () => {
    expect(
      decideEligibility({
        ...eligibilityBase,
        plan: await createExecutionPlan({
          ...planScopeDefaults,
          planId: asPlanId('plan-other-version'),
          policyVersionId: asPolicyVersionId('pv-2'),
          snapshotId: asSnapshotId('snapshot-1'),
          expiresAt: activePlan.expiresAt,
          actionFractionBps: activePlan.actionFractionBps,
          notionalMicros: activePlan.notionalMicros,
        }),
      }),
    ).toMatchObject({ status: 'REFUSED', reason: 'POLICY_VERSION_MISMATCH' });
    const expiredPlan = await createExecutionPlan({
      ...planScopeDefaults,
      planId: asPlanId('plan-expired'),
      policyVersionId: activePolicyVersion.policyVersionId,
      snapshotId: asSnapshotId('snapshot-1'),
      expiresAt: '2028-01-01T00:00:00.000Z',
      actionFractionBps: 500,
      notionalMicros: '500000',
    });
    expect(decideEligibility({ ...eligibilityBase, plan: expiredPlan })).toMatchObject({
      status: 'REFUSED',
      reason: 'PLAN_EXPIRED',
    });
    const expiredPolicyVersion = await createPolicyVersion({
      ...activePolicyPayload,
      constraints: { ...activePolicyPayload.constraints, expiresAt: '2028-01-01T00:00:00.000Z' },
    });
    expect(
      decideEligibility({ ...eligibilityBase, policyVersion: expiredPolicyVersion }),
    ).toMatchObject({
      status: 'REFUSED',
      reason: 'POLICY_EXPIRED',
    });
    expect(decideEligibility({ ...eligibilityBase, observationQuality: 'STALE' })).toMatchObject({
      status: 'REFUSED',
      reason: 'OBSERVATION_NOT_FRESH',
    });
    expect(decideEligibility({ ...eligibilityBase, observationQuality: 'UNKNOWN' })).toMatchObject({
      status: 'REFUSED',
      reason: 'OBSERVATION_NOT_FRESH',
    });
  });

  it('blocks execution while the global kill switch is on and in M01 mainnet', () => {
    expect(decideEligibility({ ...eligibilityBase, globalExecutionDisabled: true })).toMatchObject({
      status: 'REFUSED',
      reason: 'KILL_SWITCH_ENABLED',
    });
    expect(
      decideEligibility({ ...eligibilityBase, environment: 'MAINNET_EXECUTION' }),
    ).toMatchObject({
      status: 'REFUSED',
      reason: 'MAINNET_EXECUTION_DISABLED',
    });
    expect(
      decideEligibility({ ...eligibilityBase, environment: 'MAINNET_READONLY' }),
    ).toMatchObject({
      status: 'REFUSED',
      reason: 'MAINNET_READONLY',
    });
    expect(
      decideEligibility({ ...eligibilityBase, environment: 'TESTNET_DEMO', demoOnly: false }),
    ).toMatchObject({
      status: 'REFUSED',
      reason: 'DEMO_ONLY',
    });
  });

  it('refuses missing runtime safety controls at the eligibility boundary', () => {
    type EligibilityInput = Parameters<typeof decideEligibility>[0];

    expect(
      decideEligibility({
        ...eligibilityBase,
        globalExecutionDisabled: undefined,
      } as unknown as EligibilityInput),
    ).toMatchObject({ status: 'REFUSED', reason: 'SAFETY_CONTEXT_INVALID' });
    expect(
      decideEligibility({
        ...eligibilityBase,
        executionEnabled: undefined,
      } as unknown as EligibilityInput),
    ).toMatchObject({ status: 'REFUSED', reason: 'SAFETY_CONTEXT_INVALID' });
    expect(
      decideEligibility({ ...eligibilityBase, demoOnly: undefined } as unknown as EligibilityInput),
    ).toMatchObject({ status: 'REFUSED', reason: 'SAFETY_CONTEXT_INVALID' });
  });

  it('prevents DEMO_ONLY authorization and defaults execution to off', () => {
    expect(
      decideEligibility({ ...eligibilityBase, demoOnly: true, environment: 'TESTNET_DEMO' }),
    ).toMatchObject({ status: 'REFUSED', reason: 'DEMO_ONLY' });
    expect(decideEligibility(eligibilityBase).executionEnabled).toBe(false);
  });
});

describe('M01-IDEMP-001 and M01-REC-001', () => {
  it('prevents a duplicate effect from advancing and refuses blind retry after UNKNOWN', () => {
    const input = {
      current: 'AUTHORIZED' as ExecutionState,
      next: 'SUBMITTED' as ExecutionState,
      idempotencyKey: asIdempotencyKey('effect-1'),
      alreadyAppliedKeys: new Set(['effect-1']),
      effectStatus: 'NONE' as const,
      policyState: 'ACTIVE' as const,
      policyVersion: activePolicyVersion,
      plan: activePlan,
      observationQuality: 'FRESH' as const,
      environment: 'LOCAL' as const,
      demoOnly: false,
      authorizationContext: {
        schemaVersion: '0.1' as const,
        planDigest: activePlan.digest,
        policyVersionId: activePolicyVersion.policyVersionId,
        expiresAt: '2031-01-01T00:00:00.000Z',
        decision: 'APPROVED' as const,
      },
      now: '2029-01-01T00:00:00.000Z',
      globalExecutionDisabled: false,
    };
    expect(() => transitionExecution(input.current, input.next, input)).toThrow(/duplicate/i);
    expect(() =>
      transitionExecution('SUBMITTED', 'CONFIRMED', {
        ...input,
        alreadyAppliedKeys: new Set(),
        effectStatus: 'UNKNOWN',
      }),
    ).toThrow(/unknown/i);
  });
});

describe('M01-AUTH-002 authorization binding', () => {
  const authorization = {
    schemaVersion: '0.1' as const,
    planDigest: 'plan-digest-1',
    policyVersionId: asPolicyVersionId('pv-1'),
    expiresAt: '2030-01-02T00:00:00.000Z',
    decision: 'APPROVED' as const,
  };

  it('refuses a different plan digest or policy version', () => {
    expect(
      verifyAuthorizationBinding({
        authorization,
        planDigest: 'other-plan',
        policyVersionId: asPolicyVersionId('pv-1'),
        now: '2030-01-01T00:00:00.000Z',
      }),
    ).toMatchObject({ status: 'REFUSED', reason: 'PLAN_DIGEST_MISMATCH' });
    expect(
      verifyAuthorizationBinding({
        authorization,
        planDigest: 'plan-digest-1',
        policyVersionId: asPolicyVersionId('pv-2'),
        now: '2030-01-01T00:00:00.000Z',
      }),
    ).toMatchObject({ status: 'REFUSED', reason: 'POLICY_VERSION_MISMATCH' });
    expect(
      verifyAuthorizationBinding({
        authorization,
        planDigest: 'plan-digest-1',
        policyVersionId: asPolicyVersionId('pv-1'),
        now: '2030-01-03T00:00:00.000Z',
      }),
    ).toMatchObject({ status: 'REFUSED', reason: 'AUTHORIZATION_EXPIRED' });
  });
});

describe('M01-AUTH-001 exact numeric policy authority', () => {
  it('compares bounded basis points and decimal micros without trusting a caller boolean', () => {
    expect(
      isPlanWithinPolicyAuthority({
        ...matchingPolicyScope,
        planActionFractionBps: 500,
        policyMaxActionFractionBps: 1_000,
        planNotionalMicros: '9007199254740993',
        policyMaxNotionalMicros: '9007199254740994',
      }),
    ).toBe(true);
    expect(
      isPlanWithinPolicyAuthority({
        ...matchingPolicyScope,
        planActionFractionBps: 500,
        policyMaxActionFractionBps: 1_000,
        planNotionalMicros: '9007199254740995',
        policyMaxNotionalMicros: '9007199254740994',
      }),
    ).toBe(false);
    expect(
      isPlanWithinPolicyAuthority({
        ...matchingPolicyScope,
        planActionFractionBps: 1_001,
        policyMaxActionFractionBps: 1_000,
        planNotionalMicros: '1',
        policyMaxNotionalMicros: '2',
      }),
    ).toBe(false);
    expect(
      isPlanWithinPolicyAuthority({
        ...matchingPolicyScope,
        planActionFractionBps: 1,
        policyMaxActionFractionBps: 1_000,
        planNotionalMicros: '01',
        policyMaxNotionalMicros: '2',
      }),
    ).toBe(false);
  });

  it('refuses plans whose network, market, or slippage exceeds policy authority', async () => {
    type PlanInput = Parameters<typeof createExecutionPlan>[0];
    const planInput = {
      planId: asPlanId('plan-outside-scope'),
      policyVersionId: activePolicyVersion.policyVersionId,
      snapshotId: asSnapshotId('snapshot-1'),
      expiresAt: activePlan.expiresAt,
      actionFractionBps: activePlan.actionFractionBps,
      notionalMicros: activePlan.notionalMicros,
      actionFamily: 'REDUCE_POSITION',
      network: 'local',
      protocolCapability: 'generic-risk-preview-v0',
      marketSelector: 'BTC-PERP',
      slippageBps: 50,
    };
    const outsideMarket = await createExecutionPlan(planInput as unknown as PlanInput);
    expect(outsideMarket.digest).not.toBe(activePlan.digest);
    expect(decideEligibility({ ...eligibilityBase, plan: outsideMarket })).toMatchObject({
      status: 'REFUSED',
      reason: 'PLAN_EXCEEDS_POLICY',
    });
    expect(() =>
      transitionExecution('OBSERVED', 'ELIGIBLE', {
        ...eligibilityBase,
        plan: outsideMarket,
      }),
    ).toThrow(/plan exceeds/i);

    const outsideNetwork = await createExecutionPlan({
      ...planInput,
      planId: asPlanId('plan-outside-network'),
      network: 'monad-mainnet',
      marketSelector: 'ETH-PERP',
    } as unknown as PlanInput);
    expect(decideEligibility({ ...eligibilityBase, plan: outsideNetwork })).toMatchObject({
      status: 'REFUSED',
      reason: 'PLAN_EXCEEDS_POLICY',
    });

    const excessiveSlippage = await createExecutionPlan({
      ...planInput,
      planId: asPlanId('plan-excessive-slippage'),
      marketSelector: 'ETH-PERP',
      slippageBps: 101,
    } as unknown as PlanInput);
    expect(decideEligibility({ ...eligibilityBase, plan: excessiveSlippage })).toMatchObject({
      status: 'REFUSED',
      reason: 'PLAN_EXCEEDS_POLICY',
    });

    const outsideAction = await createExecutionPlan({
      ...planInput,
      planId: asPlanId('plan-outside-action'),
      actionFamily: 'CLOSE_POSITION',
      marketSelector: 'ETH-PERP',
    } as unknown as PlanInput);
    expect(decideEligibility({ ...eligibilityBase, plan: outsideAction })).toMatchObject({
      status: 'REFUSED',
      reason: 'PLAN_EXCEEDS_POLICY',
    });

    await expect(
      createExecutionPlan({
        ...planInput,
        protocolCapability: 'unapproved-provider',
      } as unknown as PlanInput),
    ).rejects.toThrow(/protocol capability/i);
  });

  it('rejects structurally invalid network values in the exported authority predicate', () => {
    expect(
      isPlanWithinPolicyAuthority({
        ...matchingPolicyScope,
        planNetwork: 'unsupported-network' as never,
        policyNetwork: 'unsupported-network' as never,
        planActionFractionBps: 500,
        policyMaxActionFractionBps: 1_000,
        planNotionalMicros: '500000',
        policyMaxNotionalMicros: '1000000',
      }),
    ).toBe(false);
  });
});
