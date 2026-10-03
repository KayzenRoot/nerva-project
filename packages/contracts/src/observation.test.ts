import { describe, expect, it } from 'vitest';
import {
  IndexedEvidenceReferenceM02Schema,
  ReadModelStatusSchema,
  RiskSnapshotM02Schema,
} from './index.js';

describe('M02 read-only observation contracts', () => {
  it('distinguishes unavailable and no-account from a healthy empty account', () => {
    expect(ReadModelStatusSchema.parse('NO_ACCOUNT')).toBe('NO_ACCOUNT');
    expect(ReadModelStatusSchema.parse('NO_POSITION')).toBe('NO_POSITION');
    expect(ReadModelStatusSchema.parse('UNAVAILABLE')).toBe('UNAVAILABLE');
  });

  it('accepts provider-neutral risk metrics and rejects Perpl wire fields', () => {
    const snapshot = {
      schemaVersion: '0.1',
      snapshotId: 'risk-1',
      snapshotHash: 'a'.repeat(64),
      generatedAt: '2030-01-01T00:00:00.000Z',
      observedAt: '2030-01-01T00:00:00.000Z',
      quality: 'FRESH',
      actionable: false,
      sourceSnapshotHashes: ['b'.repeat(64)],
      metrics: [
        {
          name: 'POSITION_ADVERSE_MOVE_BPS',
          valueBps: 125,
          quality: 'FRESH',
          unit: 'basis-points',
          observedAt: '2030-01-01T00:00:00.000Z',
        },
      ],
      limitations: [],
      liquidationDistance: { status: 'UNAVAILABLE_UNPROVEN', reason: 'No proven mapping' },
    };
    expect(RiskSnapshotM02Schema.parse(snapshot)).toEqual(snapshot);
    expect(RiskSnapshotM02Schema.safeParse({ ...snapshot, mt: 9 }).success).toBe(false);
    expect(RiskSnapshotM02Schema.safeParse({ ...snapshot, actionable: true }).success).toBe(false);
  });

  it('freezes the optional indexer seam to advisory provenance without state authority', () => {
    expect(
      IndexedEvidenceReferenceM02Schema.parse({
        schemaVersion: '0.1',
        provider: 'envio',
        network: 'monad-mainnet',
        chainId: 143,
        sourceBlock: '5',
        observedAt: '2030-01-01T00:00:00.000Z',
        receivedAt: '2030-01-01T00:00:01.000Z',
        lagMs: 1000,
        contentHash: 'c'.repeat(64),
        authority: 'ADVISORY_ONLY',
      }).authority,
    ).toBe('ADVISORY_ONLY');
    expect(
      IndexedEvidenceReferenceM02Schema.safeParse({
        schemaVersion: '0.1',
        provider: 'envio',
        network: 'monad-mainnet',
        chainId: 143,
        sourceBlock: '5',
        observedAt: '2030-01-01T00:00:00.000Z',
        receivedAt: '2030-01-01T00:00:01.000Z',
        lagMs: 1000,
        contentHash: 'c'.repeat(64),
        authority: 'AUTHORITATIVE',
      }).success,
    ).toBe(false);
  });
});
