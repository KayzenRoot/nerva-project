import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseM03Request } from './m03-api.js';

const schema = z
  .object({
    correlationId: z.string().min(1).max(200),
    value: z.string().min(1),
  })
  .strict();

const invalid = { code: 'REQUEST_INVALID', message: 'The request is invalid.' };

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
