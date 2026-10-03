import { NextResponse } from 'next/server';
import {
  createDatabase,
  latestIntegrationHealth,
  listM03EvaluationReadModels,
  listM03SimulationReadModels,
  readM03ExecutionReadModel,
} from '@nerva/db';
import { loadServerConfig } from '@nerva/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = loadServerConfig();
  if (!config.databaseUrl)
    return NextResponse.json(
      {
        schemaVersion: '0.1',
        status: 'UNAVAILABLE',
        events: [],
        evaluations: [],
        simulations: [],
        integrations: [],
        executionEnabled: false,
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  const { pool } = createDatabase(config);
  try {
    const [events, evaluations, simulations, integrations] = await Promise.all([
      readM03ExecutionReadModel(pool),
      listM03EvaluationReadModels(pool),
      listM03SimulationReadModels(pool),
      latestIntegrationHealth(pool),
    ]);
    return NextResponse.json(
      {
        schemaVersion: '0.1',
        status: 'AVAILABLE',
        events,
        evaluations,
        simulations,
        integrations,
        executionEnabled: false,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      {
        schemaVersion: '0.1',
        status: 'UNAVAILABLE',
        events: [],
        evaluations: [],
        simulations: [],
        integrations: [],
        executionEnabled: false,
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  } finally {
    await pool.end();
  }
}
