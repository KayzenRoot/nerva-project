import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route.js';

describe('M02 integration health read model', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns explicit unavailable provider state without database observations', async () => {
    vi.stubEnv('DATABASE_URL', undefined);
    vi.stubEnv('NERVA_ENVIRONMENT', 'LOCAL');
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ integration: 'perpl-public-rest', status: 'UNAVAILABLE' }),
        expect.objectContaining({ integration: 'perpl-market-ws', status: 'UNAVAILABLE' }),
      ]),
    );
    expect(JSON.stringify(body)).not.toMatch(/secret|api.?key/i);
  });
});
