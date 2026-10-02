import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route.js';

const readiness = vi.hoisted(() => ({
  databaseHealth: vi.fn(),
  readGlobalExecutionDisabled: vi.fn(),
  poolEnd: vi.fn(),
}));

vi.mock('@nerva/db', () => ({
  createDatabase: vi.fn(() => ({ pool: { end: readiness.poolEnd }, db: {} })),
  databaseHealth: readiness.databaseHealth,
  readGlobalExecutionDisabled: readiness.readGlobalExecutionDisabled,
}));

describe('M01-BOOT-001 readiness safety projection', () => {
  beforeEach(() => {
    vi.stubEnv('NERVA_ENVIRONMENT', 'LOCAL');
    vi.stubEnv('NERVA_KILL_SWITCH_ENABLED', 'false');
    vi.stubEnv('DATABASE_URL', 'postgresql://user:password@localhost/nerva');
    readiness.databaseHealth.mockResolvedValue({
      status: 'HEALTHY',
      checkedAt: '2030-01-01T00:00:00.000Z',
    });
    readiness.readGlobalExecutionDisabled.mockResolvedValue(false);
    readiness.poolEnd.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('reports the persisted global control when configuration does not force it on', async () => {
    const response = await GET();
    const body = (await response.json()) as { safety: { globalExecutionDisabled: boolean } };

    expect(response.status).toBe(200);
    expect(body.safety.globalExecutionDisabled).toBe(false);
    expect(readiness.readGlobalExecutionDisabled).toHaveBeenCalledOnce();
    expect(readiness.poolEnd).toHaveBeenCalledOnce();
  });

  it('keeps the reported control disabled when configured on', async () => {
    vi.stubEnv('NERVA_KILL_SWITCH_ENABLED', 'true');

    const response = await GET();
    const body = (await response.json()) as { safety: { globalExecutionDisabled: boolean } };

    expect(body.safety.globalExecutionDisabled).toBe(true);
  });

  it('fails closed when the persisted control cannot be read', async () => {
    readiness.readGlobalExecutionDisabled.mockRejectedValue(new Error('database unavailable'));

    const response = await GET();
    const body = (await response.json()) as { safety: { globalExecutionDisabled: boolean } };

    expect(response.status).toBe(200);
    expect(body.safety.globalExecutionDisabled).toBe(true);
  });
});
