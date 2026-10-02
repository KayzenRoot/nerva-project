import { NextResponse } from 'next/server';
import { loadServerConfig } from '@nerva/config';
import { HealthResponseSchema } from '@nerva/contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  const config = loadServerConfig();
  const response = HealthResponseSchema.parse({
    status: 'live',
    module: 'M01',
    environment: config.environment,
    executionEnabled: false,
    timestamp: new Date().toISOString(),
  });
  return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } });
}
