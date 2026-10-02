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
          accessToken: 'access-token-secret',
          clientSecret: 'client-secret',
          privateKeyHex: 'private-key-hex-secret',
          nested: {
            password: 'do-not-log',
            request: {
              Authorization: 'nested-auth-secret',
              headers: { Authorization: 'deep-auth-secret' },
            },
          },
        },
        'safety event',
      ),
    );
    const record = JSON.parse(lines.join('')) as Record<string, unknown>;
    expect(record.correlationId).toBe('corr-m01');
    expect(JSON.stringify(record)).not.toContain('secret-token');
    expect(JSON.stringify(record)).not.toContain('api-secret');
    expect(JSON.stringify(record)).not.toContain('private-material');
    expect(JSON.stringify(record)).not.toContain('access-token-secret');
    expect(JSON.stringify(record)).not.toContain('client-secret');
    expect(JSON.stringify(record)).not.toContain('private-key-hex-secret');
    expect(JSON.stringify(record)).not.toContain('do-not-log');
    expect(JSON.stringify(record)).not.toContain('nested-auth-secret');
    expect(JSON.stringify(record)).not.toContain('deep-auth-secret');
  });

  it('redacts deeply nested credentials in child logger bindings', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      },
    });
    const logger = createLogger({ level: 'info', environment: 'LOCAL', stream: sink });
    logger
      .child({ requestContext: { headers: { Authorization: 'child-auth-secret' } } })
      .info('child event');

    expect(lines.join('')).not.toContain('child-auth-secret');
  });
});
