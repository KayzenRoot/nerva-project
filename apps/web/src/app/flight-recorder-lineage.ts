export interface EvaluationLineageLabels {
  readonly evaluationId: string;
  readonly policyVersionId: string;
  readonly policyVersionHash: string;
  readonly sourceSnapshotId: string;
  readonly snapshotHash: string;
  readonly triggerResult: string;
  readonly triggerReason: string;
  readonly correlation: string;
  readonly time: string;
}

export interface EvaluationLineageEntry {
  readonly label: string;
  readonly value: string;
  readonly code?: boolean;
}

function field(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : 'UNKNOWN';
}

export function mapEvaluationLineage(
  record: Record<string, unknown>,
  labels: EvaluationLineageLabels,
): readonly EvaluationLineageEntry[] {
  return [
    { label: labels.evaluationId, value: field(record, 'evaluation_id'), code: true },
    { label: labels.policyVersionId, value: field(record, 'policy_version_id'), code: true },
    { label: labels.policyVersionHash, value: field(record, 'policy_version_hash'), code: true },
    { label: labels.sourceSnapshotId, value: field(record, 'snapshot_id'), code: true },
    { label: labels.snapshotHash, value: field(record, 'snapshot_hash'), code: true },
    { label: labels.triggerResult, value: field(record, 'result') },
    { label: labels.triggerReason, value: field(record, 'reason') },
    { label: labels.correlation, value: field(record, 'correlation_id'), code: true },
    { label: labels.time, value: field(record, 'evaluated_at') },
  ];
}
