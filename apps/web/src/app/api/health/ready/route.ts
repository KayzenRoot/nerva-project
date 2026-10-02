import { NextResponse } from 'next/server';
import { loadServerConfig } from '@nerva/config';
import { databaseHealth, createDatabase, readGlobalExecutionDisabled } from '@nerva/db';
import { HealthResponseSchema } from '@nerva/contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = loadServerConfig();
  let database: 'HEALTHY' | 'UNKNOWN' | 'NOT_CONFIGURED' = 'NOT_CONFIGURED';
  let globalExecutionDisabled = true;
  if (config.databaseUrl) {
    const { pool, db } = createDatabase(config);
    try {
      database = (await databaseHealth(pool)).status;
      if (database === 'HEALTHY') {
        try {
          globalExecutionDisabled =
            config.killSwitchEnabled || (await readGlobalExecutionDisabled(db));
        } catch {
          // A missing or unavailable persisted control must remain fail-closed.
          globalExecutionDisabled = true;
        }
      }
    } finally {
      await pool.end();
    }
  }
  const ready = database === 'HEALTHY';
  const response = {
    ...HealthResponseSchema.parse({
      status: ready ? 'ready' : 'not_ready',
      module: 'M01',
      environment: config.environment,
      executionEnabled: false,
      timestamp: new Date().toISOString(),
    }),
    dependencies: { database },
    safety: { globalExecutionDisabled },
  };
  return NextResponse.json(response, {
    status: ready ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
