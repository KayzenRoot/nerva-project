import type { Pool } from 'pg';
import type {
  IntegrationHealth,
  MarketSnapshot,
  ObservationQuality,
  PortfolioSeriesSnapshot,
  PositionSnapshot,
  ProviderCheckpoint,
  RiskMetric,
  RiskSnapshot,
} from '@nerva/domain';

type RiskSnapshotRecord = Omit<RiskSnapshot, 'snapshotId'> & {
  readonly snapshotId: string;
  readonly generatedAt: string;
  readonly snapshotHash: string;
  readonly correlationId: string;
  readonly sourceSnapshotHashes: readonly string[];
  readonly actionable: false;
};

function rejectCredentialFields(value: unknown, path = '$'): void {
  if (value === null || typeof value !== 'object') return;
  for (const [key, member] of Object.entries(value)) {
    if (/(?:api[_-]?key|secret|signature|private|mnemonic|seedphrase|seed_phrase)/i.test(key))
      throw new TypeError(`Observation payload contains credential material at ${path}.${key}`);
    rejectCredentialFields(member, `${path}.${key}`);
  }
}

function assertHash(value: string, label: string): void {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new TypeError(`${label} must be a SHA-256 hex digest`);
}

function commonObservation(value: {
  readonly snapshotId: string;
  readonly source: {
    readonly contentHash: string;
    readonly correlationId: string;
    readonly observedAt: string;
    readonly receivedAt: string;
    readonly quality: string;
  };
}): readonly unknown[] {
  rejectCredentialFields(value);
  assertHash(value.source.contentHash, 'source contentHash');
  return [
    value.snapshotId,
    value.source.observedAt,
    value.source.receivedAt,
    value.source.quality,
    value.source.contentHash,
    value.source.correlationId,
    value,
  ];
}

export async function appendMarketSnapshot(pool: Pool, snapshot: MarketSnapshot): Promise<void> {
  const common = commonObservation(snapshot);
  await pool.query(
    'INSERT INTO market_snapshots (snapshot_id,market_id,observed_at,received_at,quality,content_hash,correlation_id,payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT (snapshot_id) DO NOTHING',
    [snapshot.snapshotId, snapshot.marketId, ...common.slice(1, 6), JSON.stringify(snapshot)],
  );
}

export async function appendPositionSnapshot(
  pool: Pool,
  snapshot: PositionSnapshot,
): Promise<void> {
  const common = commonObservation(snapshot);
  await pool.query(
    'INSERT INTO position_snapshots (snapshot_id,position_id,market_id,observed_at,received_at,quality,content_hash,correlation_id,payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) ON CONFLICT (snapshot_id) DO NOTHING',
    [
      snapshot.snapshotId,
      snapshot.positionId,
      snapshot.marketId,
      ...common.slice(1, 6),
      JSON.stringify(snapshot),
    ],
  );
}

export async function appendPortfolioSnapshot(
  pool: Pool,
  snapshot: PortfolioSeriesSnapshot,
): Promise<void> {
  const common = commonObservation(snapshot);
  await pool.query(
    'INSERT INTO portfolio_snapshots (snapshot_id,observed_at,received_at,quality,content_hash,correlation_id,payload) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT (snapshot_id) DO NOTHING',
    [snapshot.snapshotId, ...common.slice(1, 6), JSON.stringify(snapshot)],
  );
}

export async function appendRiskSnapshot(pool: Pool, snapshot: RiskSnapshotRecord): Promise<void> {
  rejectCredentialFields(snapshot);
  if (snapshot.actionable !== false)
    throw new TypeError('M02 persistence cannot grant execution eligibility');
  assertHash(snapshot.snapshotHash, 'risk snapshotHash');
  if (snapshot.sourceSnapshotHashes.some((hash) => !/^[0-9a-f]{64}$/.test(hash)))
    throw new TypeError('Risk source hashes must be SHA-256 hex digests');
  await pool.query(
    'INSERT INTO risk_snapshots (snapshot_id,generated_at,quality,actionable,content_hash,correlation_id,source_snapshot_hashes,payload) VALUES ($1,$2,$3,FALSE,$4,$5,$6,$7::jsonb) ON CONFLICT (snapshot_id) DO NOTHING',
    [
      snapshot.snapshotId,
      snapshot.generatedAt,
      snapshot.quality,
      snapshot.snapshotHash,
      snapshot.correlationId,
      [...snapshot.sourceSnapshotHashes],
      JSON.stringify(snapshot),
    ],
  );
  for (const [index, metric] of snapshot.metrics.entries()) {
    rejectCredentialFields(metric);
    const metricId = `${snapshot.snapshotId}:${index}`;
    await pool.query(
      'INSERT INTO risk_metrics (metric_id,snapshot_id,name,value,value_bps,quality,observed_at,payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT (metric_id) DO NOTHING',
      [
        metricId,
        snapshot.snapshotId,
        metric.name,
        metric.value ?? null,
        metric.valueBps ?? null,
        metric.quality,
        metric.observedAt,
        JSON.stringify(metric),
      ],
    );
  }
}

export async function appendIntegrationHealth(
  pool: Pool,
  health: IntegrationHealth & {
    readonly status: 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'STALE' | 'UNAVAILABLE';
    readonly reason?: string;
  },
): Promise<void> {
  rejectCredentialFields(health);
  const id = `${health.integration}:${health.observedAt}:${health.correlationId}`;
  await pool.query(
    'INSERT INTO integration_health_samples (sample_id,integration,status,observed_at,correlation_id,reason) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (sample_id) DO NOTHING',
    [
      id,
      health.integration,
      health.status,
      health.observedAt,
      health.correlationId,
      health.reason ?? health.status,
    ],
  );
}

export async function upsertProviderCheckpoint(
  pool: Pool,
  checkpoint: ProviderCheckpoint & { readonly reason?: string },
): Promise<void> {
  rejectCredentialFields(checkpoint);
  await pool.query(
    'INSERT INTO provider_checkpoints (provider,stream,chain_id,session_id,sequence,source_block,quality,reconnect_count,reason,observed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (provider,stream,chain_id) DO UPDATE SET session_id=EXCLUDED.session_id,sequence=EXCLUDED.sequence,source_block=EXCLUDED.source_block,quality=EXCLUDED.quality,reconnect_count=EXCLUDED.reconnect_count,reason=EXCLUDED.reason,observed_at=EXCLUDED.observed_at',
    [
      checkpoint.provider,
      checkpoint.stream,
      checkpoint.chainId,
      checkpoint.sessionId ?? null,
      checkpoint.sequence ?? null,
      checkpoint.sourceBlock ?? null,
      checkpoint.quality,
      checkpoint.reconnectCount,
      checkpoint.reason ?? null,
      checkpoint.observedAt,
    ],
  );
}

export async function latestRiskSnapshot(pool: Pool): Promise<unknown | undefined> {
  const result = await pool.query<{ payload: unknown }>(
    'SELECT payload FROM risk_snapshots ORDER BY generated_at DESC LIMIT 1',
  );
  return result.rows[0]?.payload;
}

export async function latestMarketSnapshots(pool: Pool): Promise<readonly unknown[]> {
  const result = await pool.query<{ payload: unknown }>(
    'SELECT DISTINCT ON (market_id) payload FROM market_snapshots ORDER BY market_id, observed_at DESC',
  );
  return result.rows.map((row) => row.payload);
}

export async function latestPositionSnapshot(
  pool: Pool,
  positionId: string,
): Promise<unknown | undefined> {
  const result = await pool.query<{ payload: unknown }>(
    'SELECT payload FROM position_snapshots WHERE position_id = $1 ORDER BY observed_at DESC LIMIT 1',
    [positionId],
  );
  return result.rows[0]?.payload;
}

export async function latestPositionSnapshots(pool: Pool): Promise<readonly unknown[]> {
  const result = await pool.query<{ payload: unknown }>(
    'SELECT DISTINCT ON (position_id) payload FROM position_snapshots ORDER BY position_id, observed_at DESC',
  );
  return result.rows.map((row) => row.payload);
}

export async function latestIntegrationHealth(pool: Pool): Promise<readonly unknown[]> {
  const result = await pool.query<{
    integration: string;
    status: string;
    observed_at: Date;
    correlation_id: string;
    reason: string;
    last_good_at: Date | null;
  }>(
    `SELECT DISTINCT ON (h.integration) h.integration,h.status,h.observed_at,h.correlation_id,h.reason,
      (SELECT max(g.observed_at) FROM integration_health_samples g WHERE g.integration=h.integration AND g.status='HEALTHY') AS last_good_at
      FROM integration_health_samples h ORDER BY h.integration,h.observed_at DESC`,
  );
  return result.rows.map((row) => ({
    schemaVersion: '0.1',
    integration: row.integration,
    status: row.status,
    observedAt: new Date(row.observed_at).toISOString(),
    correlationId: row.correlation_id,
    reason: row.reason,
    ...(row.last_good_at ? { lastGoodAt: new Date(row.last_good_at).toISOString() } : {}),
  }));
}

export async function latestProviderCheckpoints(
  pool: Pool,
): Promise<readonly ProviderCheckpoint[]> {
  const result = await pool.query<{
    provider: string;
    stream: string;
    chain_id: number;
    session_id: string | null;
    sequence: string | null;
    source_block: string | null;
    quality: string;
    reconnect_count: number;
    observed_at: Date;
  }>(
    'SELECT provider,stream,chain_id,session_id,sequence,source_block,quality,reconnect_count,observed_at FROM provider_checkpoints ORDER BY provider,stream,chain_id',
  );
  return result.rows.map((row) => ({
    schemaVersion: '0.1',
    provider: row.provider,
    stream: row.stream,
    chainId: row.chain_id,
    ...(row.session_id ? { sessionId: row.session_id } : {}),
    ...(row.sequence ? { sequence: row.sequence } : {}),
    ...(row.source_block ? { sourceBlock: row.source_block } : {}),
    quality: row.quality as ObservationQuality,
    reconnectCount: row.reconnect_count,
    observedAt: new Date(row.observed_at).toISOString(),
  }));
}

export async function metricsForPosition(
  pool: Pool,
  positionId: string,
): Promise<readonly RiskMetric[]> {
  const result = await pool.query<{ payload: RiskMetric }>(
    "SELECT payload FROM risk_metrics WHERE payload->'metadata'->>'positionId' = $1 ORDER BY observed_at DESC LIMIT 100",
    [positionId],
  );
  return result.rows.map((row) => row.payload);
}
