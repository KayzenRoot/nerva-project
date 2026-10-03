import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  auditEvents,
  integrationHealthSamples,
  marketSnapshots,
  policies,
  policyVersions,
  portfolioSnapshots,
  positionSnapshots,
  providerCheckpoints,
  riskMetrics,
  riskSnapshots,
  runtimeControls,
} from './schema.js';

describe('M01-DB-001 foundational persistence surface', () => {
  it('contains the M01 foundation plus append-oriented M02 observation evidence', () => {
    const names = [
      policies,
      policyVersions,
      auditEvents,
      integrationHealthSamples,
      runtimeControls,
      marketSnapshots,
      positionSnapshots,
      portfolioSnapshots,
      riskSnapshots,
      riskMetrics,
      providerCheckpoints,
    ]
      .map((table) => getTableConfig(table).name)
      .sort();
    expect(names).toEqual([
      'audit_events',
      'integration_health_samples',
      'market_snapshots',
      'policies',
      'policy_versions',
      'portfolio_snapshots',
      'position_snapshots',
      'provider_checkpoints',
      'risk_metrics',
      'risk_snapshots',
      'runtime_controls',
    ]);
  });
});
