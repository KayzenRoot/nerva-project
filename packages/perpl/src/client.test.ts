import { createHash, createPublicKey, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createRestAuthHeaders,
  marketSubscriptionFrame,
  normalizePerplFundingFrame,
  parseLosslessJson,
  PerplReadClient,
  PerplReadError,
  sequenceDecision,
  upsertFundingInterval,
} from './client.js';

describe('M02 Perpl read-only transport contracts', () => {
  it('signs only the documented REST canonical request and preserves large JSON integers', () => {
    const seed = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
    const auth = createRestAuthHeaders({
      chainId: 143,
      apiKey: 'test-read-key',
      keySecretHex: seed,
      method: 'GET',
      target: '/v1/trading/positions?count=1',
      timestamp: '1700000000000',
      nonce: 'bm9uY2U',
      body: '',
    });
    const canonical = [
      143,
      'GET',
      '/v1/trading/positions?count=1',
      '1700000000000',
      'bm9uY2U',
      createHash('sha256').update('').digest('hex'),
    ].join('\n');
    const publicDer = Buffer.from(
      '302a300506032b6570032100d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
      'hex',
    );
    expect(
      verify(
        null,
        Buffer.from(canonical),
        createPublicKey({ key: publicDer, format: 'der', type: 'spki' }),
        Buffer.from(auth['X-API-Signature'], 'base64url'),
      ),
    ).toBe(true);
    expect(auth).toHaveProperty('X-API-Key', 'test-read-key');
    expect(parseLosslessJson<{ value: string }>('{"value":9007199254740993}').value).toBe(
      '9007199254740993',
    );
  });

  it('requires heartbeat progression and replaces rather than duplicates a funding interval', () => {
    expect(
      sequenceDecision({ sessionId: 's1', previous: 10 }, { sessionId: 's1', sequence: 11 }),
    ).toBe('ACCEPT');
    expect(
      sequenceDecision({ sessionId: 's1', previous: 10 }, { sessionId: 's1', sequence: 12 }),
    ).toBe('RECONNECT_STALE');
    const updated = upsertFundingInterval(
      [{ intervalId: 'feb-1', appliedAt: '2030-01-01T00:00:00Z', rateMicros: '10' }],
      { intervalId: 'feb-1', appliedAt: '2030-01-01T00:00:01Z', rateMicros: '11' },
    );
    expect(updated).toEqual([
      { intervalId: 'feb-1', appliedAt: '2030-01-01T00:00:01Z', rateMicros: '11' },
    ]);
    expect(marketSubscriptionFrame(143).subs).toHaveLength(4);
  });

  it('uses bounded idempotent retry and distinguishes no-account from auth refusal', async () => {
    let calls = 0;
    const client = new PerplReadClient({
      apiUrl: 'https://app.perpl.xyz/api',
      wsUrl: 'wss://app.perpl.xyz',
      chainId: 143,
      credentials: {
        apiKey: 'read-key',
        keySecretHex: '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
        scope: 'read',
      },
      now: () => 1_700_000_000_000,
      nonce: () => 'nonce-1',
      random: () => 0,
      sleep: async () => undefined,
      fetcher: async () => {
        calls += 1;
        return calls === 1
          ? new Response('', { status: 429 })
          : Response.json({ mt: 2, at: { t: 1 }, d: {} });
      },
    });
    await expect(client.getMarketTicker()).resolves.toHaveProperty('d');
    expect(calls).toBe(2);
    const noAccountClient = new PerplReadClient({
      apiUrl: 'https://app.perpl.xyz/api',
      wsUrl: 'wss://app.perpl.xyz',
      chainId: 143,
      credentials: {
        apiKey: 'read-key',
        keySecretHex: '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
        scope: 'read',
      },
      fetcher: async () => new Response('', { status: 404 }),
      maxRetries: 0,
    });
    await expect(noAccountClient.getPositions()).resolves.toEqual({ status: 'NO_ACCOUNT' });
    const deniedClient = new PerplReadClient({
      apiUrl: 'https://app.perpl.xyz/api',
      wsUrl: 'wss://app.perpl.xyz',
      chainId: 143,
      credentials: {
        apiKey: 'read-key',
        keySecretHex: '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
        scope: 'read',
      },
      fetcher: async () => new Response('', { status: 403 }),
      maxRetries: 3,
    });
    await expect(deniedClient.getPositions()).rejects.toMatchObject<Partial<PerplReadError>>({
      status: 'SCOPE_REFUSED',
      httpStatus: 403,
    });
  });

  it('normalizes funding interval updates with a market-scoped feb identity', () => {
    expect(
      normalizePerplFundingFrame({
        mt: 10,
        d: { '1': { feb: 500, rate: 10, ppl: 2, at: { t: 1893456000000 } } },
      }),
    ).toEqual([
      {
        marketId: '1',
        intervalId: '1:500',
        appliedAt: '2030-01-01T00:00:00.000Z',
        rateMicros: '10',
        paymentPerLotScaled: '2',
      },
    ]);
  });
});
