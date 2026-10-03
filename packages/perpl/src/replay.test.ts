import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MarketStreamIntegrity,
  normalizePerplFundingFrame,
  PerplReadClient,
  PerplReadError,
  upsertFundingInterval,
} from './client.js';
import {
  normalizePerplMarket,
  normalizePerplPosition,
  normalizePerplSeries,
  normalizePerplWallet,
} from './normalizer.js';

const fixture = <T>(name: string): T =>
  JSON.parse(fs.readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')) as T;
const base = {
  network: 'monad-mainnet' as const,
  chainId: 143 as const,
  receivedAt: '2030-01-01T00:00:01.000Z',
  correlationId: 'M02-REPLAY',
};

describe('M02 sanitized deterministic replay fixtures', () => {
  it('replays long/short vectors against one fresh market and proves adverse direction', async () => {
    const marketInput = fixture<{ market: unknown; state: unknown; quoteToken: string }>(
      'market.json',
    );
    const market = await normalizePerplMarket({ ...base, ...marketInput });
    const long = fixture<{ position: unknown }>('position-long.json');
    const short = fixture<{ position: unknown }>('position-short.json');
    const common = {
      ...base,
      market: marketInput.market,
      marketSnapshot: market,
      collateralDecimals: 6,
    };
    const longSnapshot = await normalizePerplPosition({ ...common, position: long.position });
    const shortSnapshot = await normalizePerplPosition({ ...common, position: short.position });
    expect(longSnapshot.side).toBe('LONG');
    expect(shortSnapshot.side).toBe('SHORT');
    expect(longSnapshot.source.contentHash).not.toBe(shortSnapshot.source.contentHash);
    expect(market.source.quality).toBe('FRESH');
  });

  it('replays a repeated funding interval as a same-feb update', () => {
    const replay = fixture<{ frames: unknown[] }>('funding-updates.json');
    let intervals: ReturnType<typeof normalizePerplFundingFrame> = [];
    for (const frame of replay.frames) {
      const next = normalizePerplFundingFrame(frame)[0]!;
      intervals = upsertFundingInterval(intervals, next);
    }
    expect(intervals).toHaveLength(1);
    expect(intervals[0]).toMatchObject({
      intervalId: '1:500',
      rateMicros: '11',
      appliedAt: '2030-01-01T00:00:01.000Z',
    });
  });

  it('invalidates sequence gaps and establishes a fresh baseline after resnapshot', () => {
    const replay = fixture<{
      heartbeats: Array<{ ses: string; sn: number }>;
      resnapshot: { ses: string; sn: number };
    }>('sequence-gap.json');
    const integrity = new MarketStreamIntegrity();
    integrity.beginSession(replay.heartbeats[0]!.ses);
    expect(
      integrity.acceptHeartbeat({
        sessionId: replay.heartbeats[0]!.ses,
        sequence: replay.heartbeats[0]!.sn,
      }),
    ).toBe('ACCEPT');
    expect(
      integrity.acceptHeartbeat({
        sessionId: replay.heartbeats[1]!.ses,
        sequence: replay.heartbeats[1]!.sn,
      }),
    ).toBe('RECONNECT_STALE');
    expect(integrity.isFresh).toBe(false);
    integrity.markDisconnected();
    integrity.beginSession(replay.resnapshot.ses);
    expect(
      integrity.acceptHeartbeat({
        sessionId: replay.resnapshot.ses,
        sequence: replay.resnapshot.sn,
      }),
    ).toBe('ACCEPT');
    expect(integrity.isFresh).toBe(true);
    expect(integrity.reconnectCount).toBe(1);
  });

  it('keeps no-account, zero positions and empty portfolio distinct from malformed payloads', async () => {
    const empty = fixture<{ wallet: unknown; chart: unknown[] }>('empty-portfolio.json');
    const wallet = await normalizePerplWallet({
      ...base,
      wallet: empty.wallet,
      collateralDecimals: 6,
    });
    const series = await normalizePerplSeries({
      ...base,
      chart: empty.chart,
      tokenDecimals: 6,
      period: 'day',
    });
    expect(wallet.status).toBe('NO_ACCOUNT');
    expect(series.points).toEqual([]);
    const client = new PerplReadClient({
      apiUrl: 'https://app.perpl.xyz/api',
      wsUrl: 'wss://app.perpl.xyz',
      chainId: 143,
      credentials: {
        apiKey: 'read-key',
        keySecretHex: '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
        scope: 'read',
      },
      fetcher: async () => Response.json({ d: [] }),
    });
    await expect(client.getPositions()).resolves.toMatchObject({
      status: 'AVAILABLE',
      payload: { d: [] },
    });
    const malformed = fixture<{ market: unknown; state: unknown; quoteToken: string }>(
      'malformed-market.json',
    );
    await expect(normalizePerplMarket({ ...base, ...malformed })).rejects.toThrow();
  });

  it('replays REST status classes without retrying credential or scope failures', async () => {
    const responses = fixture<{ cases: Array<{ status: number; expected: string }> }>(
      'rest-responses.json',
    );
    expect(responses.cases.map((entry) => entry.expected)).toEqual([
      'RATE_LIMITED',
      'DEGRADED',
      'AUTHENTICATION_FAILED',
      'SCOPE_REFUSED',
      'NO_ACCOUNT',
    ]);
    for (const status of [401, 403]) {
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
        maxRetries: 3,
        fetcher: async () => {
          calls += 1;
          return new Response('', { status });
        },
      });
      await expect(client.getPositions()).rejects.toBeInstanceOf(PerplReadError);
      expect(calls).toBe(1);
    }
    let unavailableCalls = 0;
    const unavailable = new PerplReadClient({
      apiUrl: 'https://app.perpl.xyz/api',
      wsUrl: 'wss://app.perpl.xyz',
      chainId: 143,
      maxRetries: 0,
      fetcher: async () => {
        unavailableCalls += 1;
        return new Response('', { status: 503 });
      },
    });
    await expect(unavailable.getMarketTicker()).rejects.toMatchObject<Partial<PerplReadError>>({
      status: 'DEGRADED',
      httpStatus: 503,
    });
    expect(unavailableCalls).toBe(1);
  });
});
