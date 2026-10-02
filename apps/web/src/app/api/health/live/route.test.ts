import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route.js';

describe('M01-BOOT-001 live health route', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reports service liveness without exposing server configuration', async () => {
    vi.stubEnv('NERVA_ENVIRONMENT', 'LOCAL');
    vi.stubEnv('DATABASE_URL', 'postgresql://user:supersecret@localhost/private');
    const response = GET();
    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'live',
      module: 'M01',
      executionEnabled: false,
      environment: 'LOCAL',
    });
    expect(JSON.stringify(body)).not.toContain('supersecret');
  });
});
