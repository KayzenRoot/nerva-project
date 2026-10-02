import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadServerConfig } from '@nerva/config';
import { startWorker } from './worker.js';

describe('M02-BOOT-001 worker observation-mode lifecycle', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('starts without providers or execution and shuts down deterministically', async () => {
    vi.stubEnv('NERVA_LOG_LEVEL', 'fatal');
    const worker = await startWorker(
      loadServerConfig({ NODE_ENV: 'test', NERVA_LOG_LEVEL: 'fatal' }),
    );
    expect(worker.status).toBe('OBSERVATION_MODE');
    expect(worker.executionEnabled).toBe(false);
    expect(worker.globalExecutionDisabled).toBe(true);
    await worker.refreshKillSwitch();
    await worker.shutdown('test');
    await worker.shutdown('duplicate signal');
    expect(worker.status).toBe('STOPPED');
  });
});
