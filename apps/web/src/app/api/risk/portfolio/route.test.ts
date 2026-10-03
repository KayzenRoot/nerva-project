import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route.js';

describe('M02 portfolio risk read model', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reports unavailable when persistence is not configured and never implies execution', async () => {
    vi.stubEnv('DATABASE_URL', undefined);
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      schemaVersion: '0.1',
      status: 'UNAVAILABLE',
      safety: { executionEnabled: false },
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
