import { NextResponse } from 'next/server';
import { PositionSnapshotM02Schema } from '@nerva/contracts';
import { createDatabase, latestPositionSnapshot, metricsForPosition } from '@nerva/db';
import { loadPerplConfig, loadServerConfig } from '@nerva/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { readonly params: Promise<{ readonly positionId: string }> },
) {
  const { positionId } = await context.params;
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(positionId))
    return response('UNAVAILABLE', 400, 'INVALID_POSITION_ID');
  const config = loadServerConfig();
  const perpl = loadPerplConfig(process.env, config.environment);
  if (!config.databaseUrl)
    return response('UNAVAILABLE', 503, 'DATABASE_NOT_CONFIGURED', perpl.network);
  const { pool } = createDatabase(config);
  try {
    const raw = await latestPositionSnapshot(pool, positionId);
    if (raw === undefined) return response('NO_POSITION', 200, undefined, perpl.network);
    const parsed = PositionSnapshotM02Schema.safeParse(raw);
    if (!parsed.success)
      return response('UNAVAILABLE', 200, 'INCOMPATIBLE_READ_MODEL', perpl.network);
    const now = Date.now();
    const ageMs = Math.max(
      now - Date.parse(parsed.data.source.receivedAt),
      now - Date.parse(parsed.data.source.observedAt),
    );
    const stale =
      parsed.data.source.quality !== 'FRESH' || ageMs < 0 || ageMs > perpl.accountFreshnessMs;
    const metrics = await metricsForPosition(pool, positionId);
    return NextResponse.json(
      {
        schemaVersion: '0.1',
        status: stale ? 'STALE' : 'AVAILABLE',
        network: perpl.network,
        position: parsed.data,
        metrics,
        freshness: { quality: stale ? 'STALE' : 'FRESH', ageMs: Math.max(0, ageMs) },
        safety: { executionEnabled: false },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return response('UNAVAILABLE', 503, 'READ_MODEL_UNAVAILABLE', perpl.network);
  } finally {
    await pool.end();
  }
}

function response(status: string, httpStatus: number, reason?: string, network?: string) {
  return NextResponse.json(
    {
      schemaVersion: '0.1',
      status,
      ...(reason ? { reason } : {}),
      ...(network ? { network } : {}),
      position: null,
      metrics: [],
      safety: { executionEnabled: false },
    },
    {
      status: httpStatus,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
