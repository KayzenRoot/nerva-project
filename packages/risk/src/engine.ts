import {
  asBasisPoints,
  asSnapshotId,
  canonicalHash,
  type ObservationQuality,
  type ObservationSource,
  type RiskMetric,
  type RiskSnapshot,
} from '@nerva/domain';

export interface RiskPositionInput {
  readonly positionId: string;
  readonly marketId: string;
  readonly symbol: string;
  readonly side: 'LONG' | 'SHORT';
  readonly sizeScaled: string;
  readonly sizeDecimals: number;
  readonly entryPriceScaled: string;
  readonly entryPriceDecimals: number;
  readonly markPriceScaled: string;
  readonly markPriceDecimals: number;
  readonly collateralMicros: string;
  readonly quoteToken: string;
  readonly source: ObservationSource;
}

export interface FundingInput {
  readonly intervalId: string;
  readonly rateMicros: string;
  readonly appliedAt: string;
  readonly source: ObservationSource;
}

export interface RiskEvaluationInput {
  readonly generatedAt: string;
  readonly positions: readonly RiskPositionInput[];
  readonly account: {
    readonly status: 'AVAILABLE' | 'NO_ACCOUNT' | 'UNAVAILABLE';
    readonly collateralMicros?: string;
    readonly source: ObservationSource;
  };
  readonly portfolio: {
    readonly period: 'day';
    readonly points: readonly Readonly<{ at: string; valueMicros: string }>[];
    readonly source: ObservationSource;
  };
  readonly requiredSources: readonly ObservationSource[];
  readonly funding?: FundingInput;
  readonly maxSourceAgeMs?: number;
  readonly maxAccountSourceAgeMs?: number;
}

type MetricInput = Omit<RiskMetric, 'observedAt'> & { readonly observedAt?: string };

const canonicalUnsigned = /^(?:0|[1-9][0-9]{0,77})$/;
const canonicalSigned = /^(?:0|-?[1-9][0-9]{0,77})$/;

function integer(value: string, label: string, signed = false): bigint {
  if (!(signed ? canonicalSigned : canonicalUnsigned).test(value))
    throw new TypeError(
      `${label} must be a canonical ${signed ? 'signed' : 'unsigned'} integer string`,
    );
  return BigInt(value);
}

function decimals(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 30)
    throw new RangeError(`${label} must be an integer in [0, 30]`);
  return value;
}

function power10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

function compareLexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function notionalMicros(position: RiskPositionInput): bigint {
  const size = integer(position.sizeScaled, 'position size');
  const mark = integer(position.markPriceScaled, 'mark price');
  const scale =
    decimals(position.sizeDecimals, 'size decimals') +
    decimals(position.markPriceDecimals, 'mark price decimals');
  if (size <= 0n || mark <= 0n)
    throw new RangeError('Position size and mark price must be positive');
  const raw = size * mark;
  return scale <= 6
    ? raw * power10(6 - scale)
    : (raw + power10(scale - 6) - 1n) / power10(scale - 6);
}

function ratioBps(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError('Ratio denominator must be positive');
  return (numerator * 10_000n) / denominator;
}

function adverseMoveBps(position: RiskPositionInput): bigint {
  const entry = integer(position.entryPriceScaled, 'entry price');
  const mark = integer(position.markPriceScaled, 'mark price');
  const entryDecimals = decimals(position.entryPriceDecimals, 'entry price decimals');
  const markDecimals = decimals(position.markPriceDecimals, 'mark price decimals');
  if (entry <= 0n || mark <= 0n) throw new RangeError('Entry and mark prices must be positive');
  const commonEntry = entry * power10(Math.max(entryDecimals, markDecimals) - entryDecimals);
  const commonMark = mark * power10(Math.max(entryDecimals, markDecimals) - markDecimals);
  const adverseDelta =
    position.side === 'LONG' ? commonEntry - commonMark : commonMark - commonEntry;
  if (adverseDelta <= 0n) return 0n;
  return (adverseDelta * 10_000n) / commonEntry;
}

function qualityRank(quality: ObservationQuality): number {
  return { FRESH: 0, STALE: 1, UNKNOWN: 2, INCONSISTENT: 3 }[quality];
}

function worstQuality(qualities: readonly ObservationQuality[]): ObservationQuality {
  return qualities.reduce<ObservationQuality>(
    (worst, quality) => (qualityRank(quality) > qualityRank(worst) ? quality : worst),
    'FRESH',
  );
}

function metric(input: MetricInput): RiskMetric {
  const present = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
  return { ...present, observedAt: input.observedAt ?? '' } as RiskMetric;
}

function freshnessQuality(
  source: ObservationSource,
  generatedAt: string,
  budgetMs: number,
): ObservationQuality {
  if (source.quality !== 'FRESH') return source.quality;
  const generated = Date.parse(generatedAt);
  const observed = Date.parse(source.observedAt);
  const received = Date.parse(source.receivedAt);
  if (
    !Number.isFinite(generated) ||
    !Number.isFinite(observed) ||
    !Number.isFinite(received) ||
    received > generated ||
    observed > generated + 30_000
  )
    return 'INCONSISTENT';
  return Math.max(generated - observed, generated - received) > budgetMs ? 'STALE' : 'FRESH';
}

function assertInstant(value: string, label: string): void {
  if (!Number.isFinite(Date.parse(value)))
    throw new TypeError(`${label} must be an ISO-compatible timestamp`);
}

function portfolioDrawdown(points: RiskEvaluationInput['portfolio']['points']): number | undefined {
  if (points.length < 2) return undefined;
  let peak: bigint | undefined;
  let current: bigint | undefined;
  let previousAt = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    assertInstant(point.at, 'portfolio point timestamp');
    const instant = Date.parse(point.at);
    if (instant <= previousAt)
      throw new TypeError('Portfolio points must be strictly chronological');
    previousAt = instant;
    const value = integer(point.valueMicros, 'portfolio equity');
    if (peak === undefined || value > peak) peak = value;
    current = value;
  }
  if (!peak || !current || peak === 0n) return undefined;
  return Number(ratioBps(peak > current ? peak - current : 0n, peak));
}

/** Pure fixed-point risk evaluation; clock, transport, randomness and persistence are supplied by the caller. */
export async function evaluateRisk(input: RiskEvaluationInput): Promise<
  RiskSnapshot & {
    readonly actionable: false;
    readonly generatedAt: string;
    readonly correlationId: string;
    readonly sourceSnapshotHashes: readonly string[];
    readonly snapshotHash: string;
    readonly limitations: readonly string[];
    readonly liquidationDistance: Readonly<{ status: 'UNAVAILABLE_UNPROVEN'; reason: string }>;
  }
> {
  assertInstant(input.generatedAt, 'generatedAt');
  if (!Array.isArray(input.requiredSources) || input.requiredSources.length === 0)
    throw new TypeError('At least one required source must be supplied');
  const ageBudget = input.maxSourceAgeMs ?? 5_000;
  if (!Number.isInteger(ageBudget) || ageBudget < 0 || ageBudget > 300_000)
    throw new RangeError('maxSourceAgeMs must be an integer in [0, 300000]');
  const accountAgeBudget = input.maxAccountSourceAgeMs ?? ageBudget;
  if (!Number.isInteger(accountAgeBudget) || accountAgeBudget < 0 || accountAgeBudget > 300_000)
    throw new RangeError('maxAccountSourceAgeMs must be an integer in [0, 300000]');

  const positions = [...input.positions].sort((left, right) =>
    compareLexical(left.positionId, right.positionId),
  );
  const qualities = input.requiredSources.map((source) =>
    freshnessQuality(source, input.generatedAt, ageBudget),
  );
  const accountQuality = freshnessQuality(
    input.account.source,
    input.generatedAt,
    accountAgeBudget,
  );
  const portfolioQuality = freshnessQuality(
    input.portfolio.source,
    input.generatedAt,
    accountAgeBudget,
  );
  qualities.push(accountQuality, portfolioQuality);
  if (input.funding)
    qualities.push(freshnessQuality(input.funding.source, input.generatedAt, ageBudget));
  for (const position of positions)
    qualities.push(freshnessQuality(position.source, input.generatedAt, accountAgeBudget));
  if (input.account.status !== 'AVAILABLE') qualities.push('UNKNOWN');
  const quality = worstQuality(qualities);
  // Data quality may be current, but M02 never sets a state eligible for execution.
  const correlationId = input.account.source.correlationId;
  const sourceSnapshotHashes = [
    ...new Set(
      [
        ...input.requiredSources,
        input.account.source,
        input.portfolio.source,
        ...positions.map((position) => position.source),
        ...(input.funding ? [input.funding.source] : []),
      ].map((source) => source.contentHash),
    ),
  ].sort();
  const metrics: RiskMetric[] = [];
  for (const [index, source] of input.requiredSources.entries()) {
    const sourceQuality = freshnessQuality(source, input.generatedAt, ageBudget);
    const generated = Date.parse(input.generatedAt);
    const observed = Date.parse(source.observedAt);
    const received = Date.parse(source.receivedAt);
    const age =
      Number.isFinite(generated) && Number.isFinite(observed) && Number.isFinite(received)
        ? Math.max(0, generated - observed, generated - received)
        : undefined;
    metrics.push(
      metric({
        name: 'SOURCE_FRESHNESS_MS',
        value: age === undefined || !Number.isFinite(age) ? undefined : String(age),
        unit: 'milliseconds',
        quality: sourceQuality,
        source: source.source,
        reason: sourceQuality === 'FRESH' ? undefined : `SOURCE_${sourceQuality}`,
        metadata: { sourceIndex: index },
        observedAt: input.generatedAt,
      }),
    );
  }
  metrics.push(
    metric({
      name: 'ACCOUNT_COLLATERAL_MICROS',
      ...(input.account.status === 'AVAILABLE' && input.account.collateralMicros !== undefined
        ? { value: integer(input.account.collateralMicros, 'account collateral').toString() }
        : {}),
      unit: 'micro-units',
      quality:
        input.account.status === 'AVAILABLE' && input.account.collateralMicros !== undefined
          ? accountQuality
          : 'UNKNOWN',
      source: input.account.source.source,
      reason:
        input.account.status === 'NO_ACCOUNT'
          ? 'NO_ACCOUNT'
          : input.account.status === 'UNAVAILABLE'
            ? 'ACCOUNT_UNAVAILABLE'
            : input.account.collateralMicros === undefined
              ? 'COLLATERAL_UNAVAILABLE'
              : undefined,
      observedAt: input.generatedAt,
    }),
  );
  metrics.push(
    metric({
      name: 'OPEN_POSITION_COUNT',
      ...(input.account.status === 'AVAILABLE' ? { value: String(positions.length) } : {}),
      unit: 'count',
      quality: input.account.status === 'AVAILABLE' ? accountQuality : 'UNKNOWN',
      source: input.account.source.source,
      reason: input.account.status === 'AVAILABLE' ? undefined : 'ACCOUNT_STATE_NOT_AVAILABLE',
      observedAt: input.generatedAt,
    }),
  );
  const notionals = positions.map((position) => ({ position, value: notionalMicros(position) }));
  for (const { position, value } of notionals) {
    const positionQuality = freshnessQuality(position.source, input.generatedAt, accountAgeBudget);
    const move = adverseMoveBps(position);
    metrics.push(
      metric({
        name: 'POSITION_NOTIONAL_MICROS',
        value: value.toString(),
        unit: 'micro-units',
        quality: positionQuality,
        source: position.source.source,
        metadata: {
          positionId: position.positionId,
          symbol: position.symbol,
          quoteToken: position.quoteToken,
          rounding: 'ceiling-to-micros',
        },
        observedAt: input.generatedAt,
      }),
    );
    metrics.push(
      metric({
        name: 'POSITION_ADVERSE_MOVE_BPS',
        ...(move <= 10_000n
          ? { valueBps: asBasisPoints(Number(move)) }
          : { value: move.toString() }),
        unit: 'basis-points',
        quality: positionQuality,
        source: position.source.source,
        reason: 'mark-to-entry adverse move only; excludes fees, realized PnL and accrued funding',
        metadata: { positionId: position.positionId, side: position.side },
        observedAt: input.generatedAt,
      }),
    );
    const collateral = integer(position.collateralMicros, 'position collateral');
    metrics.push(
      metric({
        name: 'POSITION_COLLATERAL_TO_NOTIONAL_BPS',
        ...(value > 0n
          ? ratioBps(collateral, value) <= 10_000n
            ? { valueBps: asBasisPoints(Number(ratioBps(collateral, value))) }
            : { value: ratioBps(collateral, value).toString() }
          : {}),
        unit: 'basis-points',
        quality: positionQuality,
        source: position.source.source,
        reason:
          'observed collateral-to-mark-notional ratio; not maintenance margin or liquidation buffer',
        metadata: { positionId: position.positionId, quoteToken: position.quoteToken },
        observedAt: input.generatedAt,
      }),
    );
  }
  const quoteTokens = new Set(notionals.map(({ position }) => position.quoteToken));
  const totalNotional = notionals.reduce((sum, item) => sum + item.value, 0n);
  for (const { position, value } of notionals) {
    const concentrationQuality =
      quoteTokens.size === 1
        ? freshnessQuality(position.source, input.generatedAt, accountAgeBudget)
        : 'UNKNOWN';
    metrics.push(
      metric({
        name: 'POSITION_CONCENTRATION_BPS',
        ...(quoteTokens.size === 1 && totalNotional > 0n
          ? { valueBps: asBasisPoints(Number(ratioBps(value, totalNotional))) }
          : {}),
        unit: 'basis-points',
        quality: concentrationQuality,
        source: position.source.source,
        reason:
          quoteTokens.size === 1
            ? undefined
            : 'quote tokens differ; cross-token conversion is unavailable',
        metadata: { positionId: position.positionId },
        observedAt: input.generatedAt,
      }),
    );
  }
  const drawdown = portfolioDrawdown(input.portfolio.points);
  metrics.push(
    metric({
      name: 'PORTFOLIO_DRAWDOWN_BPS',
      ...(drawdown === undefined ? {} : { valueBps: asBasisPoints(drawdown) }),
      unit: 'basis-points',
      quality: drawdown === undefined ? 'UNKNOWN' : portfolioQuality,
      source: input.portfolio.source.source,
      reason:
        drawdown === undefined
          ? 'at least two positive chronological equity points are required'
          : undefined,
      metadata: {
        period: input.portfolio.period,
        methodology: 'peak-to-current over the supplied frozen period',
      },
      observedAt: input.generatedAt,
    }),
  );
  if (input.funding) {
    const fundingQuality = freshnessQuality(input.funding.source, input.generatedAt, ageBudget);
    const rate = integer(input.funding.rateMicros, 'funding rate', true);
    metrics.push(
      metric({
        name: 'FUNDING_RATE_MICROS',
        value: rate.toString(),
        unit: 'micro-units',
        quality: fundingQuality,
        source: input.funding.source.source,
        metadata: { intervalId: input.funding.intervalId, appliedAt: input.funding.appliedAt },
        observedAt: input.generatedAt,
      }),
    );
    metrics.push(
      metric({
        name: 'FUNDING_DIRECTION',
        value: 'UNKNOWN',
        unit: 'status',
        quality: 'UNKNOWN',
        source: input.funding.source.source,
        reason:
          'Perpl publishes ppl as SPrice; conversion to account debit and side semantics are not proven for this API mapping',
        metadata: {
          intervalId: input.funding.intervalId,
          intervalDeduplicationKey: input.funding.intervalId,
        },
        observedAt: input.generatedAt,
      }),
    );
  }
  metrics.push(
    metric({
      name: 'MARGIN_SAFETY',
      unit: 'status',
      quality: 'UNKNOWN',
      reason:
        'UNAVAILABLE_UNPROVEN: the current public API mapping does not prove maintenance-margin inputs and scaling',
      observedAt: input.generatedAt,
    }),
  );
  metrics.push(
    metric({
      name: 'LIQUIDATION_DISTANCE_BPS',
      unit: 'basis-points',
      quality: 'UNKNOWN',
      reason:
        'UNAVAILABLE_UNPROVEN: exact API-to-SDK margin and funding state mapping is not proven',
      observedAt: input.generatedAt,
    }),
  );
  metrics.sort(
    (left, right) =>
      compareLexical(left.name, right.name) ||
      compareLexical(
        (left.metadata?.positionId ?? '').toString(),
        (right.metadata?.positionId ?? '').toString(),
      ),
  );
  const body = {
    schemaVersion: '0.1' as const,
    observedAt: input.generatedAt,
    generatedAt: input.generatedAt,
    quality,
    actionable: false as const,
    correlationId,
    sourceSnapshotHashes,
    metrics,
    limitations: [
      'M02 computes observations only and never grants execution eligibility.',
      'Liquidation distance and maintenance margin are UNAVAILABLE_UNPROVEN.',
      'Position adverse move excludes fees, realized PnL and accrued funding.',
    ],
    liquidationDistance: {
      status: 'UNAVAILABLE_UNPROVEN' as const,
      reason:
        'Exact market maintenance-margin scaling and current funding state are not mapped from the API into the SDK calculation inputs.',
    },
  };
  const snapshotHash = await canonicalHash(body);
  return {
    ...body,
    snapshotId: asSnapshotId(`risk-${snapshotHash.slice(0, 40)}`),
    snapshotHash,
  };
}
