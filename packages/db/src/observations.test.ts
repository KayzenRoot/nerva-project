import { describe, expect, it } from 'vitest';
import { appendRiskSnapshot } from './observations.js';

const snapshot = {
  schemaVersion: '0.1' as const,
  snapshotId: 'risk-fixture',
  snapshotHash: 'a'.repeat(64),
  observedAt: '2030-01-01T00:00:00.000Z',
  generatedAt: '2030-01-01T00:00:00.000Z',
  quality: 'FRESH' as const,
  actionable: false as const,
  correlationId: 'corr-1',
  sourceSnapshotHashes: ['b'.repeat(64)],
  metrics: [
    {
      name: 'LIQUIDATION_DISTANCE_BPS',
      quality: 'UNKNOWN' as const,
      observedAt: '2030-01-01T00:00:00.000Z',
      reason: 'UNAVAILABLE_UNPROVEN',
    },
  ],
  limitations: ['read-only'],
  liquidationDistance: { status: 'UNAVAILABLE_UNPROVEN' as const, reason: 'proof absent' },
};

describe('M02 append-oriented persistence boundary', () => {
  it('appends risk snapshot and metric evidence without credential material', async () => {
    const queries: string[] = [];
    const pool = {
      query: async (text: string) => {
        queries.push(text);
        return { rowCount: 1, rows: [] };
      },
    } as never;
    await appendRiskSnapshot(pool, snapshot);
    expect(queries.some((query) => query.includes('INSERT INTO risk_snapshots'))).toBe(true);
    expect(queries.some((query) => query.includes('INSERT INTO risk_metrics'))).toBe(true);
  });

  it('rejects a payload that contains a credential-shaped field before writing', async () => {
    let calls = 0;
    const pool = {
      query: async () => {
        calls += 1;
        return { rowCount: 1, rows: [] };
      },
    } as never;
    await expect(
      appendRiskSnapshot(pool, {
        ...snapshot,
        leaked: { apiKeySecret: 'must-not-persist' },
      } as never),
    ).rejects.toThrow(/credential/i);
    expect(calls).toBe(0);
  });
});
