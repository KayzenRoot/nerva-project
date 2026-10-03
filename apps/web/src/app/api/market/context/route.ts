import { NextResponse } from 'next/server';
import { MarketSnapshotM02Schema } from '@nerva/contracts';
import { createDatabase, latestMarketSnapshots } from '@nerva/db';
import { loadPerplConfig, loadServerConfig } from '@nerva/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = loadServerConfig();
  const perpl = loadPerplConfig(process.env, config.environment);
  if (!config.databaseUrl) return unavailable(perpl.network, 'DATABASE_NOT_CONFIGURED');
  const { pool } = createDatabase(config);
  try {
    const raw = await latestMarketSnapshots(pool);
    const markets = raw.map((item) => MarketSnapshotM02Schema.parse(item));
    if (markets.length === 0) return unavailable(perpl.network, 'NO_OBSERVATION_YET', 200);
    const now = Date.now();
    const stale = markets.some((market) => {
      const age = Math.max(
        now - Date.parse(market.source.receivedAt),
        now - Date.parse(market.source.observedAt),
      );
      return market.source.quality !== 'FRESH' || age < 0 || age > perpl.marketFreshnessMs;
    });
    return NextResponse.json(
      {
        schemaVersion: '0.1',
        status: stale ? 'STALE' : 'AVAILABLE',
        network: perpl.network,
        markets,
        source: 'persisted-read-model',
        safety: { executionEnabled: false },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return unavailable(perpl.network, 'READ_MODEL_UNAVAILABLE');
  } finally {
    await pool.end();
  }
}

function unavailable(network: string, reason: string, status = 503) {
  return NextResponse.json(
    {
      schemaVersion: '0.1',
      status: 'UNAVAILABLE',
      reason,
      network,
      markets: [],
      source: 'persisted-read-model',
      safety: { executionEnabled: false },
    },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
