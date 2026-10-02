import { describe, expect, it } from 'vitest';
import { evaluateRisk } from './engine.js';

const source = (quality: 'FRESH' | 'STALE' = 'FRESH') => ({
  source: 'perpl',
  network: 'monad-mainnet' as const,
  chainId: 143,
  observedAt: '2030-01-01T00:00:00.000Z',
  receivedAt: '2030-01-01T00:00:00.000Z',
  quality,
  correlationId: 'risk-fixture-1',
  contentHash: 'a'.repeat(64),
});

const position = (side: 'LONG' | 'SHORT') => ({
  positionId: `${side.toLowerCase()}-1`,
  marketId: 'market-1',
  symbol: 'ETH-PERP',
  side,
  sizeScaled: '250000',
  sizeDecimals: 4,
  entryPriceScaled: '200000',
  entryPriceDecimals: 2,
  markPriceScaled: '180000',
  markPriceDecimals: 2,
  collateralMicros: '5000000',
  quoteToken: 'USDC',
  source: source(),
});

describe('M02 deterministic provider-neutral risk engine', () => {
  it('computes fixed-point exposure and direction-aware adverse movement for long and short positions', async () => {
    const long = await evaluateRisk({
      generatedAt: '2030-01-01T00:00:01.000Z',
      positions: [position('LONG')],
      account: { status: 'AVAILABLE', collateralMicros: '5000000', source: source() },
      portfolio: { period: 'day', points: [], source: source() },
      requiredSources: [source()],
    });
    const short = await evaluateRisk({
      generatedAt: '2030-01-01T00:00:01.000Z',
      positions: [position('SHORT')],
      account: { status: 'AVAILABLE', collateralMicros: '5000000', source: source() },
      portfolio: { period: 'day', points: [], source: source() },
      requiredSources: [source()],
    });
    expect(
      long.metrics.find((metric) => metric.name === 'POSITION_ADVERSE_MOVE_BPS')?.valueBps,
    ).toBe(1_000);
    expect(
      short.metrics.find((metric) => metric.name === 'POSITION_ADVERSE_MOVE_BPS')?.valueBps,
    ).toBe(0);
    expect(long.metrics.find((metric) => metric.name === 'POSITION_NOTIONAL_MICROS')?.value).toBe(
      '45000000000',
    );
    expect(long.liquidationDistance.status).toBe('UNAVAILABLE_UNPROVEN');
    expect(long.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
    expect(
      await evaluateRisk({
        generatedAt: '2030-01-01T00:00:01.000Z',
        positions: [position('LONG')],
        account: { status: 'AVAILABLE', collateralMicros: '5000000', source: source() },
        portfolio: { period: 'day', points: [], source: source() },
        requiredSources: [source()],
      }),
    ).toEqual(long);
  });

  it('marks stale required inputs non-actionable and leaves insufficient portfolio history unknown', async () => {
    const result = await evaluateRisk({
      generatedAt: '2030-01-01T00:00:01.000Z',
      positions: [position('LONG')],
      account: { status: 'AVAILABLE', collateralMicros: '5000000', source: source('STALE') },
      portfolio: { period: 'day', points: [], source: source() },
      requiredSources: [source(), source('STALE')],
    });
    expect(result.actionable).toBe(false);
    expect(result.quality).toBe('STALE');
    expect(result.metrics.find((metric) => metric.name === 'PORTFOLIO_DRAWDOWN_BPS')?.quality).toBe(
      'UNKNOWN',
    );
    expect(
      result.metrics.find((metric) => metric.name === 'PORTFOLIO_DRAWDOWN_BPS')?.valueBps,
    ).toBeUndefined();
  });

  it('uses provider event time and leaves Perpl payment direction unproven', async () => {
    const eventSource = source();
    const stalePosition = {
      ...position('LONG'),
      source: { ...eventSource, observedAt: '2029-12-31T23:59:00.000Z' },
    };
    const result = await evaluateRisk({
      generatedAt: '2030-01-01T00:00:01.000Z',
      positions: [stalePosition],
      account: { status: 'AVAILABLE', source: eventSource },
      portfolio: { period: 'day', points: [], source: eventSource },
      requiredSources: [eventSource],
      funding: {
        intervalId: '1:2',
        rateMicros: '10',
        appliedAt: '2030-01-01T00:00:00.000Z',
        source: eventSource,
      },
      maxSourceAgeMs: 5_000,
      maxAccountSourceAgeMs: 20_000,
    });
    expect(result.quality).toBe('STALE');
    expect(result.metrics.find((entry) => entry.name === 'FUNDING_DIRECTION')).toMatchObject({
      value: 'UNKNOWN',
      quality: 'UNKNOWN',
    });
    expect(
      result.metrics.find((entry) => entry.name === 'ACCOUNT_COLLATERAL_MICROS'),
    ).toMatchObject({ quality: 'UNKNOWN', reason: 'COLLATERAL_UNAVAILABLE' });
  });

  it('computes peak-to-current portfolio drawdown from a chronological equity series', async () => {
    const evidence = source();
    const result = await evaluateRisk({
      generatedAt: '2030-01-01T00:00:04.000Z',
      positions: [],
      account: { status: 'AVAILABLE', collateralMicros: '90000000', source: evidence },
      portfolio: {
        period: 'day',
        points: [
          { at: '2030-01-01T00:00:01.000Z', valueMicros: '100000000' },
          { at: '2030-01-01T00:00:02.000Z', valueMicros: '120000000' },
          { at: '2030-01-01T00:00:03.000Z', valueMicros: '90000000' },
        ],
        source: evidence,
      },
      requiredSources: [evidence],
    });
    expect(result.metrics.find((entry) => entry.name === 'PORTFOLIO_DRAWDOWN_BPS')?.valueBps).toBe(
      2500,
    );
  });

  it('reports source age using the older event or receive timestamp', async () => {
    const delayedEvent = {
      ...source(),
      observedAt: '2029-12-31T23:59:00.000Z',
      receivedAt: '2030-01-01T00:00:01.000Z',
    };
    const result = await evaluateRisk({
      generatedAt: '2030-01-01T00:00:01.000Z',
      positions: [],
      account: { status: 'UNAVAILABLE', source: delayedEvent },
      portfolio: { period: 'day', points: [], source: delayedEvent },
      requiredSources: [delayedEvent],
    });
    expect(result.metrics.find((entry) => entry.name === 'SOURCE_FRESHNESS_MS')?.value).toBe(
      '61000',
    );
    expect(result.metrics.find((entry) => entry.name === 'SOURCE_FRESHNESS_MS')?.quality).toBe(
      'STALE',
    );
  });

  it('preserves short adverse movement and collateral ratios beyond one hundred percent', async () => {
    const result = await evaluateRisk({
      generatedAt: '2030-01-01T00:00:01.000Z',
      positions: [
        {
          ...position('SHORT'),
          entryPriceScaled: '200000',
          markPriceScaled: '500000',
          collateralMicros: '1000000000000',
        },
      ],
      account: { status: 'AVAILABLE', collateralMicros: '1000000000000', source: source() },
      portfolio: { period: 'day', points: [], source: source() },
      requiredSources: [source()],
    });
    expect(result.metrics.find((entry) => entry.name === 'POSITION_ADVERSE_MOVE_BPS')?.value).toBe(
      '15000',
    );
    expect(
      result.metrics.find((entry) => entry.name === 'POSITION_COLLATERAL_TO_NOTIONAL_BPS')?.value,
    ).toBeDefined();
  });
});
