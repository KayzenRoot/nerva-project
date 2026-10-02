import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger, runWithCorrelation } from './index.js';

describe('M01-SEC-001 structured correlation logging', () => {
  it('propagates correlation IDs and redacts credential-shaped fields', async () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      },
    });
    const logger = createLogger({ level: 'info', environment: 'LOCAL', stream: sink });
    await runWithCorrelation('corr-m01', () =>
      logger.info(
        {
          authorization: 'Bearer secret-token',
          apiKey: 'api-secret',
          privateKey: 'private-material',
          nested: { password: 'do-not-log' },
        },
        'safety event',
      ),
    );
    const record = JSON.parse(lines.join('')) as Record<string, unknown>;
    expect(record.correlationId).toBe('corr-m01');
    expect(JSON.stringify(record)).not.toContain('secret-token');
    expect(JSON.stringify(record)).not.toContain('api-secret');
    expect(JSON.stringify(record)).not.toContain('private-material');
    expect(JSON.stringify(record)).not.toContain('do-not-log');
  });
});
