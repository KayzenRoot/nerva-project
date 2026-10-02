import { describe, expect, it } from 'vitest';
import {
  normalizePerplMarket,
  normalizePerplPosition,
  normalizePerplSeries,
  amountToMicros,
} from './normalizer.js';

const base = {
  network: 'monad-mainnet' as const,
  chainId: 143 as const,
  receivedAt: '2030-01-01T00:00:01.000Z',
  correlationId: 'normalizer-fixture',
};

describe('Perpl normalization boundary', () => {
  it('converts provider market fields into hashed provider-neutral observations', async () => {
    const snapshot = await normalizePerplMarket({
      ...base,
      market: {
        id: '1',
        symbol: 'ETH-PERP',
        config: { price_decimals: 2, size_decimals: 4 },
        funding: { feb: 99, rate: 12, ppl: 4, at: { t: 1893456000000, b: 500 } },
      },
      state: { mrk: 180000, orl: 179900, at: { t: 1893456000000, b: 500 } },
      quoteToken: 'USDC',
    });
    expect(snapshot.markPriceScaled).toBe('180000');
    expect(snapshot.source.sourceBlock).toBe('500');
    expect(snapshot.fundingIntervalId).toBe('99');
    expect(snapshot.source.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('preserves stream session, sequence, and integrity quality when present', async () => {
    const snapshot = await normalizePerplMarket({
      ...base,
      quality: 'STALE',
      sequence: '42',
      sessionId: 'session-7',
      market: { id: '1', symbol: 'ETH-PERP', config: { price_decimals: 2, size_decimals: 4 } },
      state: { mrk: 180000, at: { t: 1893456000000 } },
      quoteToken: 'USDC',
    });
    expect(snapshot.source).toMatchObject({
      sequence: '42',
      sessionId: 'session-7',
      quality: 'STALE',
    });
  });

  it('preserves Perpl Q16 entry residue and converts token units to micros exactly', async () => {
    const shared = {
      ...base,
      position: {
        pid: '7',
        mkt: '1',
        sd: 1,
        st: 1,
        s: 250000,
        ep: 200000,
        epr: 32768,
        c: '1234567',
        at: { t: 1893456000000, b: 500 },
      },
      market: { id: '1', symbol: 'ETH-PERP', config: { price_decimals: 2, size_decimals: 4 } },
      marketSnapshot: { markPriceScaled: '180000', priceDecimals: 2, quoteToken: 'USDC' },
      collateralDecimals: 6,
    };
    const long = await normalizePerplPosition(shared);
    const short = await normalizePerplPosition({
      ...shared,
      position: { ...shared.position, sd: 2 },
    });
    expect(long.entryPriceScaled).toBe(
      String(200000n * 10n ** 16n + 32768n * (10n ** 16n / 65536n)),
    );
    expect(long.entryPriceDecimals).toBe(18);
    expect(short.entryPriceScaled).toBe(long.entryPriceScaled);
    expect(long.collateralMicros).toBe('1234567');
    expect(await amountToMicros('123456789', 8)).toBe('1234567');
  });

  it('keeps an empty portfolio series empty instead of inventing an equity point', async () => {
    const series = await normalizePerplSeries({
      ...base,
      chart: [],
      tokenDecimals: 6,
      period: 'day',
    });
    expect(series.points).toEqual([]);
    expect(series.source.quality).toBe('FRESH');
  });
});
