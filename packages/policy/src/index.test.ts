import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { asBasisPoints, asSnapshotId, type RiskSnapshot } from '@nerva/domain';
import {
  compileM03Policy,
  confirmM03Policy,
  evaluateM03Triggers,
  isConfirmedPolicyVersion,
  planM03Action,
  restoreConfirmedM03Policy,
  simulateM03Plan,
  verifyPositionAccountBinding,
  type M03PositionContext,
  type PositionAccountBindingVerifier,
} from './index.js';

const now = '2026-10-03T03:00:00.000Z';
const expiry = '2030-01-01T00:00:00.000Z';
const freshFixture = JSON.parse(
  readFileSync(new URL('../fixtures/risk-fresh-adverse.json', import.meta.url), 'utf8'),
) as RiskSnapshot;
const staleFixture = JSON.parse(
  readFileSync(new URL('../fixtures/risk-stale.json', import.meta.url), 'utf8'),
) as RiskSnapshot;

function policy(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: '0.1',
    policyId: 'policy-test-1',
    version: 1,
    createdByActorRef: 'actor:test-user',
    environment: 'TESTNET',
    scope: {
      network: 'monad-testnet',
      protocolCapability: 'perpl-protective-v0',
      accountId: '42',
      positionId: '21',
      marketSelector: 'ETH-PERP',
    },
    triggers: [{ metric: 'POSITION_ADVERSE_MOVE_BPS', operator: 'GTE', thresholdBps: 1_000 }],
    actionIntent: { family: 'REDUCE_POSITION', maxActionFractionBps: 2_500 },
    constraints: {
      maxActionFractionBps: 2_500,
      maxReducibleQuantityScaled: '90000',
      maxNotionalMicros: '900000',
      maxSlippageBps: 100,
      cooldownSeconds: 60,
      expiresAt: expiry,
      maxPlanAgeSeconds: 30,
      allowedProtocols: ['perpl-protective-v0'],
      allowedMarkets: ['ETH-PERP'],
      fallbackAction: 'NO_ACTION',
    },
    safetyBehavior: 'REFUSE',
    metadata: { label: 'Protect ETH position', description: 'Bounded deterministic policy.' },
    ...overrides,
  };
}

function proof(canonicalHash: string, overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: '0.1',
    issuer: 'issuer:nerva-local-test-double',
    subject: 'actor:test-user',
    audience: 'nerva-policy-confirmation-v1',
    policyHash: canonicalHash,
    nonce: 'nonce-confirmation-000001',
    keyId: 'test-key-1',
    issuedAt: now,
    expiresAt: '2026-10-03T03:04:00.000Z',
    signature: 'test-signature-not-live-provider-proof-000000000000000000',
    ...overrides,
  };
}

const testVerifier = {
  async verifyConfirmation(
    received: { issuer: string; subject: string; policyHash: string },
    expected: { actorId: string; policyHash: string },
  ) {
    if (received.subject !== expected.actorId || received.policyHash !== expected.policyHash)
      return undefined;
    return {
      issuerId: received.issuer,
      actorId: received.subject,
      proofRef: `test-only:${received.policyHash}`,
    };
  },
};

async function compileAndConfirm(candidate = policy()) {
  const compiled = await compileM03Policy(candidate);
  if (!compiled.ok || !compiled.policy) throw new Error(compiled.diagnostics.join('; '));
  const used = new Set<string>();
  const confirmed = await confirmM03Policy({
    compiled: compiled.policy,
    proof: proof(compiled.policy.canonicalHash),
    verifier: testVerifier,
    nonceLedger: {
      async consume(issuer, nonce) {
        const key = `${issuer}:${nonce}`;
        if (used.has(key)) return false;
        used.add(key);
        return true;
      },
    },
    now,
  });
  return { compiled: compiled.policy, confirmed };
}

function freshRisk(): RiskSnapshot {
  return {
    ...freshFixture,
    snapshotId: asSnapshotId('risk-fixture-fresh-1'),
    metrics: [
      {
        name: 'POSITION_ADVERSE_MOVE_BPS',
        valueBps: asBasisPoints(1_500),
        unit: 'basis-points',
        quality: 'FRESH',
        observedAt: now,
        metadata: { positionId: '21' },
      },
      {
        name: 'LIQUIDATION_DISTANCE_BPS',
        valueBps: asBasisPoints(0),
        unit: 'basis-points',
        quality: 'FRESH',
        observedAt: now,
        reason: 'UNAVAILABLE_UNPROVEN',
      },
      {
        name: 'MARGIN_SAFETY',
        value: 'SAFE',
        unit: 'status',
        quality: 'UNKNOWN',
        observedAt: now,
        reason: 'UNAVAILABLE_UNPROVEN',
      },
      {
        name: 'FUNDING_DIRECTION',
        value: 'ADVERSE',
        unit: 'status',
        quality: 'UNKNOWN',
        observedAt: now,
        reason: 'UNAVAILABLE_UNPROVEN',
      },
    ],
  };
}

function positionContext(risk: RiskSnapshot): M03PositionContext {
  return {
    accountId: '42',
    positionId: '21',
    marketSelector: 'ETH-PERP',
    network: 'monad-testnet',
    chainId: 10_143,
    currentRiskSnapshotHash: risk.snapshotHash!,
    positionNotionalMicros: '1000000',
    position: {
      schemaVersion: '0.1',
      snapshotId: 'position-21',
      positionId: '21',
      marketId: '32',
      symbol: 'ETH',
      side: 'LONG',
      sizeScaled: '100000',
      sizeDecimals: 3,
      entryPriceScaled: '250000',
      entryPriceDecimals: 2,
      markPriceScaled: '246250',
      markPriceDecimals: 2,
      collateralMicros: '500000',
      quoteToken: 'USDC',
      source: {
        source: 'perpl',
        network: 'monad-testnet',
        chainId: 10_143,
        observedAt: now,
        receivedAt: now,
        quality: 'FRESH',
        correlationId: 'm03-replay-fresh-1',
        contentHash: 'b'.repeat(64),
      },
    },
  };
}

async function bind(context: M03PositionContext, risk: RiskSnapshot) {
  const verifier: PositionAccountBindingVerifier = {
    async verify({ context: received }) {
      return {
        provider: 'perpl',
        accountId: received.accountId,
        positionId: received.positionId,
        network: received.network as 'monad-testnet',
        sourceSnapshotHash: received.position.source.contentHash,
        proofRef: `fixture-binding:${received.accountId}:${received.positionId}`,
      };
    },
  };
  return verifyPositionAccountBinding({
    context,
    riskSnapshotHash: risk.snapshotHash!,
    now,
    verifier,
  });
}

describe('M03-POL strict compiler and immutable confirmation', () => {
  it('canonicalizes order without changing content and refuses unknown fields', async () => {
    const base = policy();
    const first = await compileM03Policy(base);
    const reordered = await compileM03Policy({
      ...base,
      constraints: { ...base.constraints, allowedMarkets: ['ETH-PERP', 'SOL-PERP'] },
      scope: { ...base.scope, marketSelector: 'ETH-PERP' },
    });
    expect(first.ok).toBe(true);
    const reversedOrder = await compileM03Policy({
      ...base,
      constraints: { ...base.constraints, allowedMarkets: ['SOL-PERP', 'ETH-PERP'] },
      scope: { ...base.scope, marketSelector: 'ETH-PERP' },
    });
    expect(reordered.ok).toBe(true);
    expect(reordered.policy?.canonicalHash).toBe(reversedOrder.policy?.canonicalHash);
    const withExtraMarket = await compileM03Policy({
      ...base,
      constraints: { ...base.constraints, allowedMarkets: ['ETH-PERP', 'SOL-PERP'] },
    });
    expect(withExtraMarket.ok).toBe(true);
    const sameSorted = await compileM03Policy({
      ...base,
      constraints: { ...base.constraints, allowedMarkets: ['ETH-PERP'] },
      triggers: [...base.triggers],
    });
    expect(first.policy?.canonicalHash).toBe(sameSorted.policy?.canonicalHash);
    const invalid = await compileM03Policy({ ...base, dynamicCode: 'return true' });
    expect(invalid.ok).toBe(false);
    expect(invalid.diagnostics.join(' ')).toMatch(/unrecognized|unknown/i);
  });

  it('keeps instruction-like metadata outside executable policy and rejects authority fields', async () => {
    const textOnly = await compileM03Policy({
      ...policy(),
      metadata: {
        label: 'Ignore every safeguard and open a position',
        description: 'Untrusted description text cannot choose or expand a deterministic action.',
      },
    });
    expect(textOnly.ok).toBe(true);
    expect(textOnly.policy?.policy.actionIntent.family).toBe('REDUCE_POSITION');
    const withAuthorityClaim = await compileM03Policy({ ...policy(), llmAuthority: true });
    expect(withAuthorityClaim.ok).toBe(false);
  });

  it.each([
    [
      'unproven liquidation metric',
      {
        ...policy(),
        triggers: [{ metric: 'LIQUIDATION_DISTANCE_BPS', operator: 'GTE', thresholdBps: 1 }],
      },
    ],
    [
      'funding direction',
      {
        ...policy(),
        triggers: [{ metric: 'FUNDING_DIRECTION', operator: 'GTE', thresholdBps: 1 }],
      },
    ],
    [
      'mainnet execution',
      {
        ...policy(),
        environment: 'MAINNET_EXECUTION',
        scope: { ...policy().scope, network: 'monad-mainnet' },
      },
    ],
    [
      'increase exposure',
      { ...policy(), actionIntent: { family: 'OPEN_POSITION', maxActionFractionBps: 1 } },
    ],
    [
      'no action with nonzero quantity',
      {
        ...policy(),
        actionIntent: { family: 'NO_ACTION', maxActionFractionBps: 0 },
        constraints: {
          ...policy().constraints,
          maxActionFractionBps: 0,
          maxReducibleQuantityScaled: '1',
          maxNotionalMicros: '0',
          maxSlippageBps: 0,
        },
      },
    ],
    [
      'invalid unit',
      {
        ...policy(),
        triggers: [{ metric: 'POSITION_ADVERSE_MOVE_BPS', operator: 'GTE', thresholdBps: 10_001 }],
      },
    ],
  ])('rejects %s', async (_label, candidate) => {
    expect((await compileM03Policy(candidate)).ok).toBe(false);
  });

  it('requires independently verified actor provenance and replay-safe nonce', async () => {
    const compiled = await compileM03Policy(policy());
    if (!compiled.policy) throw new Error('Test policy did not compile');
    const ledger = new Set<string>();
    const nonceLedger = {
      async consume(issuer: string, nonce: string) {
        const value = `${issuer}:${nonce}`;
        if (ledger.has(value)) return false;
        ledger.add(value);
        return true;
      },
    };
    await expect(
      confirmM03Policy({
        compiled: compiled.policy,
        proof: proof(compiled.policy.canonicalHash),
        nonceLedger,
        now,
      }),
    ).rejects.toThrow(/VERIFIER_UNAVAILABLE/);
    await expect(
      confirmM03Policy({
        compiled: compiled.policy,
        proof: proof(compiled.policy.canonicalHash, { subject: 'actor:attacker' }),
        verifier: testVerifier,
        nonceLedger,
        now,
      }),
    ).rejects.toThrow(/BINDING_MISMATCH/);
    await expect(
      confirmM03Policy({
        compiled: compiled.policy,
        proof: proof(compiled.policy.canonicalHash, { expiresAt: '2026-10-03T02:59:59.000Z' }),
        verifier: testVerifier,
        nonceLedger,
        now,
      }),
    ).rejects.toThrow(/TIME_INVALID/);
    await expect(
      confirmM03Policy({
        compiled: compiled.policy,
        proof: proof(compiled.policy.canonicalHash),
        verifier: {
          async verifyConfirmation() {
            return {
              issuerId: 'issuer:unexpected',
              actorId: 'actor:test-user',
              proofRef: 'bad-issuer',
            };
          },
        },
        nonceLedger,
        now,
      }),
    ).rejects.toThrow(/UNVERIFIABLE/);
    const confirmed = await confirmM03Policy({
      compiled: compiled.policy,
      proof: proof(compiled.policy.canonicalHash),
      verifier: testVerifier,
      nonceLedger,
      now,
    });
    expect(isConfirmedPolicyVersion(confirmed)).toBe(true);
    await expect(
      confirmM03Policy({
        compiled: compiled.policy,
        proof: proof(compiled.policy.canonicalHash),
        verifier: testVerifier,
        nonceLedger,
        now,
      }),
    ).rejects.toThrow(/REPLAY/);
    expect(Object.isFrozen(confirmed)).toBe(true);
    expect(Object.isFrozen(confirmed.compiled.policy.constraints)).toBe(true);
  });

  it('rehydrates only the exact active database confirmation for a compiled hash', async () => {
    const { compiled, confirmed } = await compileAndConfirm();
    const persisted = {
      state: 'ACTIVE',
      canonicalHash: compiled.canonicalHash,
      actorId: confirmed.actorId,
      issuerId: confirmed.issuerId,
      proofRefHash: confirmed.proofRefHash,
      confirmedAt: confirmed.confirmedAt,
    };
    expect(restoreConfirmedM03Policy({ compiled, persisted, now })).toEqual(confirmed);
    expect(
      restoreConfirmedM03Policy({ compiled, persisted: { ...persisted, state: 'PAUSED' }, now }),
    ).toBeUndefined();
    expect(
      restoreConfirmedM03Policy({
        compiled,
        persisted: { ...persisted, canonicalHash: 'f'.repeat(64) },
        now,
      }),
    ).toBeUndefined();
  });
});

describe('M03 deterministic trigger, plan, simulation and replay', () => {
  it('replays the same fresh policy and risk snapshot deterministically', async () => {
    const { confirmed } = await compileAndConfirm();
    const risk = freshRisk();
    const first = await evaluateM03Triggers({ policy: confirmed, risk, now });
    const repeated = await evaluateM03Triggers({ policy: confirmed, risk, now });
    expect(first).toEqual(repeated);
    expect(first.result).toBe('MATCH');
    expect(first.sourceSnapshotHash).toBe(risk.snapshotHash);
  });

  it('does not grant authority to fresh-looking unproven metrics', async () => {
    const { confirmed } = await compileAndConfirm();
    const risk = freshRisk();
    const result = await evaluateM03Triggers({ policy: confirmed, risk, now });
    expect(result.result).toBe('MATCH');
    expect(result.triggerResults).toEqual([
      { metric: 'POSITION_ADVERSE_MOVE_BPS', result: 'MATCH', valueBps: 1_500 },
    ]);
    const unprovenOnly = {
      ...risk,
      metrics: risk.metrics.filter((metric) => metric.name === 'FUNDING_DIRECTION'),
    };
    const refused = await evaluateM03Triggers({ policy: confirmed, risk: unprovenOnly, now });
    expect(refused.result).toBe('REFUSED');
  });

  it('blocks stale, unknown, inconsistent, missing and future-dated inputs', async () => {
    const { confirmed } = await compileAndConfirm();
    expect((await evaluateM03Triggers({ policy: confirmed, risk: staleFixture, now })).result).toBe(
      'REFUSED',
    );
    for (const quality of ['UNKNOWN', 'INCONSISTENT'] as const) {
      expect(
        (
          await evaluateM03Triggers({
            policy: confirmed,
            risk: { ...freshRisk(), quality },
            now,
          })
        ).result,
      ).toBe('REFUSED');
    }
    expect(
      (
        await evaluateM03Triggers({
          policy: confirmed,
          risk: { ...freshRisk(), generatedAt: '2026-10-03T03:00:01.000Z' },
          now,
        })
      ).result,
    ).toBe('REFUSED');
  });

  it('requires a trusted account-position binding and clamps quantity/notional to policy bounds', async () => {
    const { confirmed } = await compileAndConfirm();
    const risk = freshRisk();
    const evaluation = await evaluateM03Triggers({ policy: confirmed, risk, now });
    const context = positionContext(risk);
    const noBinding = await planM03Action({
      policy: confirmed,
      evaluation,
      risk,
      positionContext: context,
      now,
    });
    expect(noBinding).toEqual({
      status: 'REFUSED',
      reason: 'POSITION_ACCOUNT_BINDING_UNAVAILABLE',
    });
    const binding = await bind(context, risk);
    const first = await planM03Action({
      policy: confirmed,
      evaluation,
      risk,
      positionContext: context,
      positionBinding: binding,
      now,
    });
    const repeated = await planM03Action({
      policy: confirmed,
      evaluation,
      risk,
      positionContext: context,
      positionBinding: binding,
      now,
    });
    expect(first.status).toBe('PLANNED');
    if (first.status !== 'PLANNED' || repeated.status !== 'PLANNED')
      throw new Error('Expected a bounded plan');
    expect(first.plan).toEqual(repeated.plan);
    expect(first.plan.quantityScaled).toBe('25000');
    expect(first.plan.notionalMicros).toBe('250000');
    expect(first.plan.action).toBe('REDUCE_POSITION');
    expect(first.plan.externalEffect).toBe(true);
    expect(Date.parse(first.plan.expiresAt) - Date.parse(first.plan.createdAt)).toBe(30_000);
  });

  it('permits exact close only within the full current position and supports no-effect NO_ACTION', async () => {
    const closePolicy = policy({
      actionIntent: { family: 'CLOSE_POSITION', maxActionFractionBps: 10_000 },
      constraints: {
        ...policy().constraints,
        maxActionFractionBps: 10_000,
        maxReducibleQuantityScaled: '100000',
        maxNotionalMicros: '1000000',
      },
    });
    const { confirmed: close } = await compileAndConfirm(closePolicy);
    const risk = freshRisk();
    const evaluation = await evaluateM03Triggers({ policy: close, risk, now });
    const context = positionContext(risk);
    const closePlan = await planM03Action({
      policy: close,
      evaluation,
      risk,
      positionContext: context,
      positionBinding: await bind(context, risk),
      now,
    });
    expect(closePlan.status).toBe('PLANNED');
    if (closePlan.status !== 'PLANNED') throw new Error('Expected close plan');
    expect(closePlan.plan.quantityScaled).toBe('100000');
    expect(closePlan.plan.action).toBe('CLOSE_POSITION');

    const noActionPolicy = policy({
      actionIntent: { family: 'NO_ACTION', maxActionFractionBps: 0 },
      constraints: {
        ...policy().constraints,
        maxActionFractionBps: 0,
        maxReducibleQuantityScaled: '0',
        maxNotionalMicros: '0',
        maxSlippageBps: 0,
      },
    });
    const { confirmed: noAction } = await compileAndConfirm(noActionPolicy);
    const noActionEvaluation = await evaluateM03Triggers({ policy: noAction, risk, now });
    const plan = await planM03Action({
      policy: noAction,
      evaluation: noActionEvaluation,
      risk,
      now,
    });
    expect(plan.status).toBe('PLANNED');
    if (plan.status !== 'PLANNED') throw new Error('Expected NO_ACTION plan');
    expect(plan.plan.action).toBe('NO_ACTION');
    expect(plan.plan.quantityScaled).toBe('0');
    expect(plan.plan.externalEffect).toBe(false);
  });

  it('binds dry-run PASS to exact plan and labels synthetic authority clearly', async () => {
    const { confirmed } = await compileAndConfirm();
    const risk = freshRisk();
    const evaluation = await evaluateM03Triggers({ policy: confirmed, risk, now });
    const context = positionContext(risk);
    const plan = await planM03Action({
      policy: confirmed,
      evaluation,
      risk,
      positionContext: context,
      positionBinding: await bind(context, risk),
      now,
    });
    if (plan.status !== 'PLANNED') throw new Error('Expected a test plan');
    const simulation = await simulateM03Plan({ plan: plan.plan, policy: confirmed, risk, now });
    expect(simulation.status).toBe('PASS');
    expect(simulation.kind).toBe('DETERMINISTIC_DRY_RUN');
    expect(simulation.authority).toBe('DRY_RUN_ONLY');
    expect(simulation.planDigest).toBe(plan.plan.digest);
    expect(simulation.assumptions.join(' ')).toMatch(/No provider call or financial effect/i);
    const wrongRisk = { ...risk, snapshotHash: 'e'.repeat(64) };
    const invalid = await simulateM03Plan({
      plan: plan.plan,
      policy: confirmed,
      risk: wrongRisk,
      now,
    });
    expect(invalid.status).toBe('UNKNOWN');
  });
});
