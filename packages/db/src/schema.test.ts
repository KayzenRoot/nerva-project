import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  auditEvents,
  integrationHealthSamples,
  policies,
  policyVersions,
  runtimeControls,
} from './schema.js';

describe('M01-DB-001 foundational persistence surface', () => {
  it('contains only the five admitted platform tables', () => {
    const names = [policies, policyVersions, auditEvents, integrationHealthSamples, runtimeControls]
      .map((table) => getTableConfig(table).name)
      .sort();
    expect(names).toEqual([
      'audit_events',
      'integration_health_samples',
      'policies',
      'policy_versions',
      'runtime_controls',
    ]);
  });
});
