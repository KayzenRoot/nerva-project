import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { latestM03SimulationsAreCurrentPass, parseM03Request } from './m03-api.js';

const schema = z
  .object({
    correlationId: z.string().min(1).max(200),
    value: z.string().min(1),
  })
  .strict();

const invalid = { code: 'REQUEST_INVALID', message: 'The request is invalid.' };
const currentTime = '2026-10-03T16:00:00.000Z';
const checkedAt = new Date('2026-10-03T15:59:00.000Z');
const expiresAt = new Date('2026-10-03T16:01:00.000Z');

describe('M03 request parsing', () => {
  it('returns validated data with the bounded correlation identifier', async () => {
    const request = new Request('http://localhost/api/m03', {
      method: 'POST',
      body: JSON.stringify({ correlationId: 'm03-test-1', value: 'safe' }),
    });

    const result = await parseM03Request(request, schema, invalid);

    expect(result).toEqual({
      ok: true,
      correlationId: 'm03-test-1',
      data: { correlationId: 'm03-test-1', value: 'safe' },
    });
  });

  it('rejects malformed JSON and oversized declared bodies', async () => {
    const malformed = await parseM03Request(
      new Request('http://localhost/api/m03', { method: 'POST', body: '{' }),
      schema,
      invalid,
    );
    const oversized = await parseM03Request(
      new Request('http://localhost/api/m03', {
        method: 'POST',
        headers: { 'content-length': '64001' },
        body: '{}',
      }),
      schema,
      invalid,
    );

    expect(malformed.ok).toBe(false);
    expect(oversized.ok).toBe(false);
    if (!malformed.ok && !oversized.ok) {
      expect(malformed.response.status).toBe(400);
      expect(oversized.response.status).toBe(400);
    }
  });

  it('rejects schema-invalid and malformed correlation identifiers', async () => {
    const invalidShape = await parseM03Request(
      new Request('http://localhost/api/m03', {
        method: 'POST',
        body: JSON.stringify({ correlationId: 'm03-test-2', value: '' }),
      }),
      schema,
      invalid,
    );
    const invalidCorrelation = await parseM03Request(
      new Request('http://localhost/api/m03', {
        method: 'POST',
        body: JSON.stringify({ correlationId: 'bad correlation id', value: 'safe' }),
      }),
      schema,
      invalid,
    );

    expect(invalidShape.ok).toBe(false);
    expect(invalidCorrelation.ok).toBe(false);
    if (!invalidShape.ok && !invalidCorrelation.ok) {
      expect(invalidShape.response.status).toBe(422);
      expect(invalidCorrelation.response.status).toBe(400);
    }
  });
});

describe('latest M03 simulation authorization gate', () => {
  const passing = [
    { kind: 'DETERMINISTIC_DRY_RUN', status: 'PASS', checkedAt, expiresAt },
    { kind: 'PROVIDER_TESTNET_PREFLIGHT', status: 'PASS', checkedAt, expiresAt },
  ] as const;

  it('requires a current PASS for both simulation and provider preflight', () => {
    expect(latestM03SimulationsAreCurrentPass(passing, currentTime)).toBe(true);
    expect(latestM03SimulationsAreCurrentPass(passing.slice(0, 1), currentTime)).toBe(false);
    expect(
      latestM03SimulationsAreCurrentPass(
        passing.map((row) => ({ ...row, expiresAt: new Date('2026-10-03T15:59:59.999Z') })),
        currentTime,
      ),
    ).toBe(false);
  });

  it('blocks UNKNOWN at the newest timestamp even when a PASS ties it', () => {
    expect(
      latestM03SimulationsAreCurrentPass(
        [
          ...passing,
          {
            kind: 'DETERMINISTIC_DRY_RUN',
            status: 'UNKNOWN',
            checkedAt: new Date(checkedAt.getTime()),
            expiresAt,
          },
        ],
        currentTime,
      ),
    ).toBe(false);
  });

  it('allows a newer PASS to supersede an older UNKNOWN and rejects future evidence', () => {
    expect(
      latestM03SimulationsAreCurrentPass(
        [
          ...passing,
          {
            kind: 'DETERMINISTIC_DRY_RUN',
            status: 'UNKNOWN',
            checkedAt: new Date('2026-10-03T15:58:00.000Z'),
            expiresAt,
          },
        ],
        currentTime,
      ),
    ).toBe(true);
    expect(
      latestM03SimulationsAreCurrentPass(
        passing.map((row) => ({ ...row, checkedAt: new Date('2026-10-03T16:00:01.000Z') })),
        currentTime,
      ),
    ).toBe(false);
  });
});
