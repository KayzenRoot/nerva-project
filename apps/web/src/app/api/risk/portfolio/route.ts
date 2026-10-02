import { NextResponse } from 'next/server';
import { RiskSnapshotM02Schema } from '@nerva/contracts';
import { createDatabase, latestRiskSnapshot } from '@nerva/db';
import { loadPerplConfig, loadServerConfig } from '@nerva/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = loadServerConfig();
  const perpl = loadPerplConfig(process.env, config.environment);
  if (!config.databaseUrl) return unavailable();
  const { pool } = createDatabase(config);
  try {
    const raw = await latestRiskSnapshot(pool);
    if (raw === undefined) return unavailable('NO_OBSERVATION_YET');
    const parsed = RiskSnapshotM02Schema.safeParse(raw);
    if (!parsed.success) return unavailable('INCOMPATIBLE_READ_MODEL');
    const snapshot = parsed.data;
    const account = snapshot.metrics.find((metric) => metric.name === 'ACCOUNT_COLLATERAL_MICROS');
    const positionCount = snapshot.metrics.find((metric) => metric.name === 'OPEN_POSITION_COUNT');
    const snapshotAgeMs = Date.now() - Date.parse(snapshot.generatedAt);
    const status =
      account?.reason === 'NO_ACCOUNT'
        ? 'NO_ACCOUNT'
        : account?.reason === 'ACCOUNT_UNAVAILABLE' || account?.reason === 'COLLATERAL_UNAVAILABLE'
          ? 'UNAVAILABLE'
          : snapshot.quality === 'STALE' || snapshotAgeMs > perpl.marketFreshnessMs
            ? 'STALE'
            : snapshot.quality !== 'FRESH' || snapshotAgeMs < 0
              ? 'UNAVAILABLE'
              : positionCount?.value === '0'
                ? 'NO_POSITION'
                : 'AVAILABLE';
    return NextResponse.json(
      {
        schemaVersion: '0.1',
        status,
        generatedAt: snapshot.generatedAt,
        snapshot,
        safety: { executionEnabled: false },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return unavailable('READ_MODEL_UNAVAILABLE');
  } finally {
    await pool.end();
  }
}

function unavailable(reason = 'DATABASE_NOT_CONFIGURED') {
  return NextResponse.json(
    {
      schemaVersion: '0.1',
      status: 'UNAVAILABLE',
      reason,
      snapshot: null,
      safety: { executionEnabled: false },
    },
    {
      status:
        reason === 'DATABASE_NOT_CONFIGURED' || reason === 'READ_MODEL_UNAVAILABLE' ? 503 : 200,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
