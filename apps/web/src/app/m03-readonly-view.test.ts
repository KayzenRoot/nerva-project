import { describe, expect, it } from 'vitest';
import { mapEvaluationLineage } from './flight-recorder-lineage.ts';

const labels = {
  evaluationId: 'Trigger evaluation ID',
  policyVersionId: 'Policy version ID',
  policyVersionHash: 'Policy version hash',
  sourceSnapshotId: 'Risk snapshot ID',
  snapshotHash: 'Risk snapshot hash',
  triggerResult: 'Trigger result',
  triggerReason: 'Trigger reason',
  correlation: 'Correlation',
  time: 'Time',
} as const;

describe('M05 persisted Flight Recorder evaluation lineage', () => {
  it('maps accepted M03 read-model version, trigger, snapshot and correlation fields for inspection', () => {
    const entries = mapEvaluationLineage(
      {
        evaluation_id: 'evaluation-17',
        policy_version_id: 'policy-version-4',
        policy_version_hash: 'a'.repeat(64),
        snapshot_id: 'risk-snapshot-9',
        snapshot_hash: 'b'.repeat(64),
        result: 'MATCH',
        reason: 'fixture trigger matched',
        correlation_id: 'correlation-12',
        evaluated_at: '2026-10-04T12:00:00.000Z',
      },
      labels,
    );

    expect(entries).toEqual([
      { label: 'Trigger evaluation ID', value: 'evaluation-17', code: true },
      { label: 'Policy version ID', value: 'policy-version-4', code: true },
      { label: 'Policy version hash', value: 'a'.repeat(64), code: true },
      { label: 'Risk snapshot ID', value: 'risk-snapshot-9', code: true },
      { label: 'Risk snapshot hash', value: 'b'.repeat(64), code: true },
      { label: 'Trigger result', value: 'MATCH' },
      { label: 'Trigger reason', value: 'fixture trigger matched' },
      { label: 'Correlation', value: 'correlation-12', code: true },
      { label: 'Time', value: '2026-10-04T12:00:00.000Z' },
    ]);
  });

  it('keeps absent persisted lineage explicitly UNKNOWN instead of inventing values', () => {
    const entries = mapEvaluationLineage(
      {},
      { ...labels, policyVersionHash: 'Hash da versão da política' },
    );

    expect(entries.every((entry) => entry.value === 'UNKNOWN')).toBe(true);
    expect(entries.map((entry) => entry.label)).toContain('Hash da versão da política');
  });
});
