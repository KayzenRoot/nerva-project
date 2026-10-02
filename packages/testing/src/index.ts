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
