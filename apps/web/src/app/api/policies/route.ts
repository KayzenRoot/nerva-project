import { NextResponse } from 'next/server';
import { createDatabase, listM03PolicyReadModels } from '@nerva/db';
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
        policies: [],
        safety: { executionEnabled: false },
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  const { pool } = createDatabase(config);
  try {
    const policies = await listM03PolicyReadModels(pool);
    return NextResponse.json(
      { schemaVersion: '0.1', status: 'AVAILABLE', policies, safety: { executionEnabled: false } },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      {
        schemaVersion: '0.1',
        status: 'UNAVAILABLE',
        policies: [],
        safety: { executionEnabled: false },
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  } finally {
    await pool.end();
  }
}
