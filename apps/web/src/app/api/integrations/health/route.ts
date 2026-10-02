import { NextResponse } from 'next/server';
import { IntegrationHealthM02Schema } from '@nerva/contracts';
import { createDatabase, latestIntegrationHealth, latestProviderCheckpoints } from '@nerva/db';
import { loadPerplConfig, loadServerConfig } from '@nerva/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = loadServerConfig();
  const perpl = loadPerplConfig(process.env, config.environment);
  if (!config.databaseUrl) return unavailableProviders(perpl.network);
  const { pool } = createDatabase(config);
  try {
    const [persisted, checkpoints] = await Promise.all([
      latestIntegrationHealth(pool),
      latestProviderCheckpoints(pool),
    ]);
    const providers = persisted.map((item) => {
      const health = IntegrationHealthM02Schema.parse(item);
      const budget = health.integration.includes('account')
        ? perpl.accountFreshnessMs
        : perpl.marketFreshnessMs;
      const ageMs = Date.now() - Date.parse(health.observedAt);
      const stream =
        health.integration === 'perpl-market-ws'
          ? 'market-data'
          : health.integration === 'perpl-account-ws'
            ? 'account-data'
            : undefined;
      const checkpoint = stream
        ? checkpoints.find(
            (entry) =>
              entry.provider === 'perpl' &&
              entry.stream === stream &&
              entry.chainId === perpl.chainId,
          )
        : undefined;
      const status =
        health.status === 'UNAVAILABLE' || health.status === 'UNKNOWN'
          ? health.status
          : ageMs < 0 || ageMs > budget
            ? 'STALE'
            : health.status;
      return {
        ...health,
        status,
        ageMs: Math.max(0, ageMs),
        reconnectCount: checkpoint?.reconnectCount ?? 0,
        ...(checkpoint ? { checkpoint } : {}),
      };
    });
    if (providers.length === 0) return unavailableProviders(perpl.network);
    return NextResponse.json(
      { schemaVersion: '0.1', network: perpl.network, providers },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return unavailableProviders(perpl.network);
  } finally {
    await pool.end();
  }
}

function unavailableProviders(network: string) {
  const observedAt = new Date().toISOString();
  const providers = [
    {
      schemaVersion: '0.1',
      integration: 'perpl-public-rest',
      status: 'UNAVAILABLE',
      observedAt,
      correlationId: 'read-model-unavailable',
      reason: 'NOT_OBSERVED',
    },
    {
      schemaVersion: '0.1',
      integration: 'perpl-market-ws',
      status: 'UNAVAILABLE',
      observedAt,
      correlationId: 'read-model-unavailable',
      reason: 'NOT_OBSERVED',
    },
    {
      schemaVersion: '0.1',
      integration: 'perpl-account-rest',
      status: 'UNAVAILABLE',
      observedAt,
      correlationId: 'read-model-unavailable',
      reason: 'READ_ONLY_CREDENTIALS_OR_ACCOUNT_NOT_OBSERVED',
    },
    {
      schemaVersion: '0.1',
      integration: 'perpl-account-ws',
      status: 'UNAVAILABLE',
      observedAt,
      correlationId: 'read-model-unavailable',
      reason: 'READ_ONLY_CREDENTIALS_OR_ACCOUNT_NOT_OBSERVED',
    },
  ].map((health) => IntegrationHealthM02Schema.parse(health));
  return NextResponse.json(
    { schemaVersion: '0.1', network, providers },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
