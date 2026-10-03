import {
  asCorrelationId,
  asBasisPoints,
  asIdempotencyKey,
  asPlanId,
  asPolicyId,
  asSnapshotId,
  createPolicyVersion,
  type IntegrationHealth,
  type Policy,
  type PolicyVersion,
  type PositionSnapshot,
  type RiskSnapshot,
} from '@nerva/domain';

export const FIXED_NOW = '2030-01-01T00:00:00.000Z';

export function riskSnapshotFixture(
  now = FIXED_NOW,
  quality: RiskSnapshot['quality'] = 'FRESH',
): RiskSnapshot {
  return {
    schemaVersion: '0.1',
    snapshotId: asSnapshotId('snapshot-fixture-1'),
    observedAt: now,
    quality,
    metrics: [{ name: 'drawdown', valueBps: asBasisPoints(500), quality, observedAt: now }],
  };
}

export function policyFixture(state: Policy['state'] = 'ACTIVE'): Policy {
  return {
    schemaVersion: '0.1',
    policyId: asPolicyId('policy-fixture-1'),
    environment: 'LOCAL',
    state,
  };
}

export function policyVersionFixture(
  overrides: {
    readonly policyId?: string;
    readonly version?: number;
    readonly expiresAt?: string;
  } = {},
): Promise<PolicyVersion> {
  return createPolicyVersion({
    schemaVersion: '0.1',
    policyId: overrides.policyId ?? 'policy-fixture-1',
    version: overrides.version ?? 1,
    environment: 'LOCAL',
    scope: {
      network: 'local',
      protocolCapability: 'generic-risk-preview-v0',
      marketSelector: 'ETH-PERP',
    },
    triggers: [{ family: 'DRAWDOWN_THRESHOLD', thresholdBps: 1_000 }],
    actionIntent: { family: 'REDUCE_POSITION', maxActionFractionBps: 1_000 },
    constraints: {
      maxActionFractionBps: 1_000,
      maxNotionalMicros: '1000000',
      maxSlippageBps: 100,
      cooldownSeconds: 60,
      expiresAt: overrides.expiresAt ?? '2031-01-01T00:00:00.000Z',
      allowedProtocols: ['generic-risk-preview-v0'],
      allowedMarkets: ['ETH-PERP'],
    },
    safetyBehavior: 'REFUSE',
    metadata: { label: 'Fixture policy', description: 'Deterministic fixture' },
  });
}

export function integrationHealthFixture(
  status: IntegrationHealth['status'] = 'HEALTHY',
  now = FIXED_NOW,
): IntegrationHealth {
  return {
    schemaVersion: '0.1',
    integration: 'database',
    status,
    observedAt: now,
    correlationId: asCorrelationId('corr-fixture-1'),
  };
}

export const fixtureIds = Object.freeze({
  planId: asPlanId('plan-fixture-1'),
  idempotencyKey: asIdempotencyKey('effect-fixture-1'),
});

export const M03_FIXTURE_NOW = '2026-10-03T03:00:00.000Z';
export const M03_FIXTURE_EXPIRY = '2030-01-01T00:00:00.000Z';

export function m03PolicyFixture(overrides: Record<string, unknown> = {}) {
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
      expiresAt: M03_FIXTURE_EXPIRY,
      maxPlanAgeSeconds: 30,
      allowedProtocols: ['perpl-protective-v0'],
      allowedMarkets: ['ETH-PERP'],
      fallbackAction: 'NO_ACTION',
    },
    safetyBehavior: 'REFUSE',
    metadata: { label: 'Protect ETH position', description: 'Bounded deterministic fixture.' },
    ...overrides,
  };
}

export function m03ConfirmationProof(policyHash: string, overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: '0.1',
    issuer: 'issuer:nerva-local-test-double',
    subject: 'actor:test-user',
    audience: 'nerva-policy-confirmation-v1',
    policyHash,
    nonce: 'policy-confirm-nonce-0001',
    keyId: 'test-key',
    issuedAt: M03_FIXTURE_NOW,
    expiresAt: '2026-10-03T03:04:00.000Z',
    signature: 'test-only-signature-value-0000000000000000',
    ...overrides,
  };
}

export function m03AdverseRiskFixture(
  source: RiskSnapshot,
  snapshotId: string,
  now = M03_FIXTURE_NOW,
): RiskSnapshot {
  return {
    ...source,
    snapshotId: asSnapshotId(snapshotId),
    generatedAt: now,
    observedAt: now,
    metrics: [
      {
        name: 'POSITION_ADVERSE_MOVE_BPS',
        valueBps: asBasisPoints(1_500),
        unit: 'basis-points',
        quality: 'FRESH',
        observedAt: now,
        metadata: { positionId: '21' },
      },
    ],
  };
}

export function m03PositionContextFixture(input: {
  readonly riskSnapshotHash: string;
  readonly now?: string;
  readonly marketId?: string;
  readonly correlationId?: string;
  readonly source?: 'perpl' | 'synthetic-benchmark';
}): {
  readonly accountId: string;
  readonly positionId: string;
  readonly marketSelector: string;
  readonly network: 'monad-testnet';
  readonly chainId: 10_143;
  readonly currentRiskSnapshotHash: string;
  readonly positionNotionalMicros: string;
  readonly position: PositionSnapshot;
} {
  const now = input.now ?? M03_FIXTURE_NOW;
  const source = input.source ?? 'perpl';
  return {
    accountId: '42',
    positionId: '21',
    marketSelector: 'ETH-PERP',
    network: 'monad-testnet',
    chainId: 10_143,
    currentRiskSnapshotHash: input.riskSnapshotHash,
    positionNotionalMicros: '1000000',
    position: {
      schemaVersion: '0.1',
      snapshotId: source === 'perpl' ? 'position-fixture-1' : 'benchmark-position-1',
      positionId: '21',
      marketId: input.marketId ?? (source === 'perpl' ? '7' : '32'),
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
        source,
        network: 'monad-testnet',
        chainId: 10_143,
        observedAt: now,
        receivedAt: now,
        quality: 'FRESH',
        correlationId: input.correlationId ?? 'execution-fixture-1',
        contentHash: 'b'.repeat(64),
      },
    },
  };
}
