import {
  asSnapshotId,
  canonicalHash,
  type AccountSnapshot,
  type MarketSnapshot,
  type ObservationSource,
  type PortfolioSeriesSnapshot,
  type PositionSnapshot,
} from '@nerva/domain';

type Network = 'monad-mainnet' | 'monad-testnet';
interface NormalizeBase {
  readonly network: Network;
  readonly chainId: 143 | 10_143;
  readonly receivedAt: string;
  readonly correlationId: string;
  readonly quality?: ObservationSource['quality'];
  readonly sequence?: string;
  readonly sessionId?: string;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function exactInteger(value: unknown, label: string, signed = false): string {
  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'number' && Number.isSafeInteger(value)
        ? String(value)
        : '';
  if (!(signed ? /^(?:0|-?[1-9][0-9]*)$/ : /^(?:0|[1-9][0-9]*)$/).test(text))
    throw new TypeError(`${label} must be an exact integer lexeme`);
  return text;
}

function decimals(value: unknown, label: string): number {
  const number = Number(exactInteger(value, label));
  if (!Number.isInteger(number) || number < 0 || number > 30)
    throw new RangeError(`${label} is outside [0, 30]`);
  return number;
}

function instant(value: unknown, label: string): string {
  const millis = Number(exactInteger(value, label, true));
  if (!Number.isSafeInteger(millis) || millis <= 0)
    throw new TypeError(`${label} must be a positive millisecond timestamp`);
  return new Date(millis).toISOString();
}

async function source(
  base: NormalizeBase,
  observedAt: string,
  raw: unknown,
  block?: string,
): Promise<ObservationSource> {
  const contentHash = await canonicalHash(raw);
  return Object.freeze({
    source: 'perpl',
    network: base.network,
    chainId: base.chainId,
    observedAt,
    receivedAt: base.receivedAt,
    ...(block ? { sourceBlock: block } : {}),
    ...(base.sequence ? { sequence: exactInteger(base.sequence, 'source sequence') } : {}),
    ...(base.sessionId ? { sessionId: base.sessionId } : {}),
    quality: base.quality ?? 'FRESH',
    correlationId: base.correlationId,
    contentHash,
  });
}

export async function amountToMicros(rawAmount: string, tokenDecimals: number): Promise<string> {
  const amount = BigInt(exactInteger(rawAmount, 'token amount'));
  const precision = decimals(tokenDecimals, 'token decimals');
  if (precision <= 6) return (amount * 10n ** BigInt(6 - precision)).toString();
  const divisor = 10n ** BigInt(precision - 6);
  return (amount / divisor).toString();
}

export async function normalizePerplMarket(
  input: NormalizeBase & {
    readonly market: unknown;
    readonly state: unknown;
    readonly quoteToken: string;
  },
): Promise<MarketSnapshot> {
  const market = object(input.market, 'Perpl market');
  const config = object(market.config, 'Perpl market config');
  const rawMarketId = exactInteger(market.id, 'Perpl market ID');
  if (BigInt(rawMarketId) <= 0n) throw new TypeError('Perpl market ID must be positive');
  if (typeof market.symbol !== 'string' || market.symbol.trim() === '')
    throw new TypeError('Perpl market symbol must be a non-empty string');
  const state = object(input.state, 'Perpl market state');
  const blockTimestamp = object(state.at, 'Perpl market timestamp');
  const observedAt = instant(blockTimestamp.t, 'Perpl market timestamp');
  const marketId = rawMarketId;
  const markPriceScaled = exactInteger(state.mrk, 'Perpl mark price', true);
  if (BigInt(markPriceScaled) <= 0n) throw new TypeError('Perpl mark price must be positive');
  const funding =
    market.funding === undefined ? undefined : object(market.funding, 'Perpl funding state');
  const raw = { market, state };
  const provenance = await source(
    input,
    observedAt,
    raw,
    blockTimestamp.b === undefined
      ? undefined
      : exactInteger(blockTimestamp.b, 'Perpl source block'),
  );
  const snapshotHash = await canonicalHash(raw);
  return Object.freeze({
    schemaVersion: '0.1',
    snapshotId: asSnapshotId(`market-${snapshotHash.slice(0, 40)}`),
    marketId,
    symbol: String(market.symbol),
    priceDecimals: decimals(config.price_decimals, 'Perpl price decimals'),
    sizeDecimals: decimals(config.size_decimals, 'Perpl size decimals'),
    markPriceScaled,
    oraclePriceScaled:
      state.orl === undefined ? undefined : exactInteger(state.orl, 'Perpl oracle price', true),
    quoteToken: input.quoteToken,
    ...(funding
      ? {
          fundingIntervalId: exactInteger(funding.feb, 'Perpl funding interval', true),
          fundingRateMicros: exactInteger(funding.rate, 'Perpl funding rate', true),
        }
      : {}),
    source: provenance,
  });
}

export async function normalizePerplPosition(
  input: NormalizeBase & {
    readonly position: unknown;
    readonly market: unknown;
    readonly marketSnapshot: Pick<
      MarketSnapshot,
      'markPriceScaled' | 'priceDecimals' | 'quoteToken'
    >;
    readonly collateralDecimals: number;
  },
): Promise<PositionSnapshot> {
  const position = object(input.position, 'Perpl position');
  const market = object(input.market, 'Perpl position market');
  const config = object(market.config, 'Perpl market config');
  if (typeof market.symbol !== 'string' || market.symbol.trim() === '')
    throw new TypeError('Perpl position market symbol must be a non-empty string');
  const at = object(position.at, 'Perpl position timestamp');
  const observedAt = instant(at.t, 'Perpl position timestamp');
  const entry = BigInt(exactInteger(position.ep, 'Perpl entry price'));
  const residue =
    position.epr === undefined ? 0n : BigInt(exactInteger(position.epr, 'Perpl Q16 residue'));
  if (residue > 65_535n || entry <= 0n)
    throw new TypeError('Perpl entry price residue or base is invalid');
  const sideValue = exactInteger(position.sd, 'Perpl position side');
  if (sideValue !== '1' && sideValue !== '2')
    throw new TypeError('Perpl position side is unsupported');
  const decimalScale = 10n ** 16n;
  const exactEntry = entry * decimalScale + residue * (decimalScale / 65_536n);
  if (exactEntry <= 0n) throw new TypeError('Perpl effective entry price must be positive');
  const size = exactInteger(position.s, 'Perpl position size');
  if (BigInt(size) <= 0n) throw new TypeError('Perpl open position size must be positive');
  const collateralRaw = exactInteger(position.c, 'Perpl position collateral');
  const collateralMicros = await amountToMicros(collateralRaw, input.collateralDecimals);
  const marketId = exactInteger(position.mkt, 'Perpl position market');
  if (BigInt(marketId) <= 0n || marketId !== exactInteger(market.id, 'Perpl context market'))
    throw new TypeError('Perpl position market is not present in the supplied context');
  const snapshotHash = await canonicalHash(position);
  return Object.freeze({
    schemaVersion: '0.1',
    snapshotId: asSnapshotId(`position-${snapshotHash.slice(0, 40)}`),
    positionId: exactInteger(position.pid, 'Perpl position identity'),
    marketId,
    symbol: market.symbol,
    side: sideValue === '1' ? 'LONG' : 'SHORT',
    sizeScaled: size,
    sizeDecimals: decimals(config.size_decimals, 'Perpl size decimals'),
    entryPriceScaled: exactEntry.toString(),
    entryPriceDecimals: decimals(config.price_decimals, 'Perpl price decimals') + 16,
    markPriceScaled: exactInteger(
      input.marketSnapshot.markPriceScaled,
      'normalized mark price',
      true,
    ),
    markPriceDecimals: decimals(
      input.marketSnapshot.priceDecimals,
      'normalized mark price decimals',
    ),
    collateralMicros,
    quoteToken: input.marketSnapshot.quoteToken,
    source: await source(
      input,
      observedAt,
      position,
      at.b === undefined ? undefined : exactInteger(at.b, 'Perpl source block'),
    ),
  });
}

export async function normalizePerplWallet(
  input: NormalizeBase & {
    readonly wallet: unknown;
    readonly collateralDecimals: number;
  },
): Promise<AccountSnapshot> {
  const wallet = object(input.wallet, 'Perpl wallet');
  const at = object(wallet.at, 'Perpl wallet timestamp');
  const observedAt = instant(at.t, 'Perpl wallet timestamp');
  if (!Array.isArray(wallet.as))
    throw new TypeError('Perpl wallet response is missing its accounts list');
  const accounts = wallet.as.map((account) => object(account, 'Perpl account'));
  if (accounts.length === 0) {
    const snapshotHash = await canonicalHash({ wallet: 'NO_ACCOUNT', observedAt });
    return Object.freeze({
      schemaVersion: '0.1',
      snapshotId: asSnapshotId(`account-${snapshotHash.slice(0, 40)}`),
      status: 'NO_ACCOUNT',
      source: await source(input, observedAt, wallet),
    });
  }
  const balance = accounts.reduce(
    (sum, account) => sum + BigInt(exactInteger(account.b, 'Perpl account balance')),
    0n,
  );
  const collateralMicros = await amountToMicros(balance.toString(), input.collateralDecimals);
  const snapshotHash = await canonicalHash({ wallet, collateralMicros });
  return Object.freeze({
    schemaVersion: '0.1',
    snapshotId: asSnapshotId(`account-${snapshotHash.slice(0, 40)}`),
    status: 'AVAILABLE',
    collateralMicros,
    source: await source(
      input,
      observedAt,
      wallet,
      at.b === undefined ? undefined : exactInteger(at.b, 'Perpl source block'),
    ),
  });
}

export async function normalizePerplSeries(
  input: NormalizeBase & {
    readonly chart: readonly unknown[];
    readonly tokenDecimals: number;
    readonly period: 'day';
  },
): Promise<PortfolioSeriesSnapshot> {
  const points = await Promise.all(
    input.chart.map(async (value) => {
      const point = object(value, 'Perpl portfolio point');
      return Object.freeze({
        at: instant(point.t, 'Perpl portfolio timestamp'),
        valueMicros: await amountToMicros(
          exactInteger(point.v, 'Perpl portfolio value'),
          input.tokenDecimals,
        ),
      });
    }),
  );
  for (let index = 1; index < points.length; index += 1) {
    if (Date.parse(points[index - 1]!.at) >= Date.parse(points[index]!.at))
      throw new TypeError('Perpl portfolio points must be chronological and unique');
  }
  const observedAt = points.at(-1)?.at ?? input.receivedAt;
  const payload = { chart: input.chart, period: input.period };
  const snapshotHash = await canonicalHash(payload);
  return Object.freeze({
    schemaVersion: '0.1',
    snapshotId: asSnapshotId(`portfolio-${snapshotHash.slice(0, 40)}`),
    period: input.period,
    points: Object.freeze(points),
    source: await source(input, observedAt, payload),
  });
}
