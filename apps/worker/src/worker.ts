import { setTimeout as delay } from 'node:timers/promises';
import {
  loadPerplConfig,
  loadServerConfig,
  type PerplServerConfig,
  type ServerConfig,
} from '@nerva/config';
import {
  appendIntegrationHealth,
  appendM03DryRun,
  appendM03ExecutionPlan,
  appendM03PlanningRefusal,
  appendM03TriggerEvaluation,
  appendMarketSnapshot,
  appendPortfolioSnapshot,
  appendPositionSnapshot,
  appendRiskSnapshot,
  createDatabase,
  latestM03EffectAt,
  listActiveM03PolicyConfirmations,
  readGlobalExecutionDisabled,
  upsertProviderCheckpoint,
} from '@nerva/db';
import {
  asCorrelationId,
  asSnapshotId,
  canonicalHash,
  type AccountSnapshot,
  type ObservationQuality,
  type ObservationSource,
} from '@nerva/domain';
import {
  normalizePerplFundingFrame,
  PerplReadClient,
  runPublicMarketStream,
  runReadOnlyAccountStream,
  upsertFundingInterval,
} from '@nerva/perpl';
import {
  normalizePerplMarket,
  normalizePerplPosition,
  normalizePerplSeries,
  normalizePerplWallet,
} from '@nerva/perpl/normalizer';
import { evaluateRisk } from '@nerva/risk';
import {
  compileM03Policy,
  evaluateM03Triggers,
  planM03Action,
  restoreConfirmedM03Policy,
  simulateM03Plan,
} from '@nerva/policy';
import { createLogger } from '@nerva/observability';

export interface WorkerRuntime {
  readonly status: 'OBSERVATION_MODE' | 'STOPPED';
  readonly executionEnabled: false;
  readonly globalExecutionDisabled: boolean;
  refreshKillSwitch(): Promise<boolean>;
  shutdown(reason?: string): Promise<void>;
}

type DbPool = ReturnType<typeof createDatabase>['pool'];
type PlainRecord = Record<string, unknown>;

function object(value: unknown, label: string): PlainRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${label} must be an object`);
  return value as PlainRecord;
}

function exactInteger(value: unknown, label: string): string {
  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'number' && Number.isSafeInteger(value)
        ? String(value)
        : '';
  if (!/^(?:0|[1-9][0-9]*)$/.test(text)) throw new TypeError(`${label} is not an exact integer`);
  return text;
}

function quoteTokenFor(
  market: PlainRecord,
  context: PlainRecord,
  tokens: Map<string, PlainRecord>,
): { symbol: string; decimals: number } {
  const instances = Array.isArray(context.instances)
    ? context.instances.map((value) => object(value, 'Perpl instance'))
    : [];
  const instance = instances.find((entry) => String(entry.id) === String(market.instance_id));
  if (!instance) throw new TypeError('Perpl market instance is missing');
  const token = tokens.get(String(instance.collateral_token_id));
  if (!token || typeof token.symbol !== 'string')
    throw new TypeError('Perpl collateral token metadata is missing');
  return {
    symbol: token.symbol,
    decimals: Number(exactInteger(token.decimals, 'Perpl token decimals')),
  };
}

function syntheticSource(
  config: PerplServerConfig,
  quality: ObservationQuality,
  now: string,
  correlationId: string,
  value: unknown,
  sourceName = 'perpl',
  stream: { readonly sequence?: number; readonly sessionId?: string } = {},
): Promise<ObservationSource> {
  return canonicalHash(value).then((contentHash) =>
    Object.freeze({
      source: sourceName,
      network: config.network,
      chainId: config.chainId,
      observedAt: now,
      receivedAt: now,
      ...(stream.sequence !== undefined ? { sequence: String(stream.sequence) } : {}),
      ...(stream.sessionId ? { sessionId: stream.sessionId } : {}),
      quality,
      correlationId,
      contentHash,
    }),
  );
}

async function unavailableAccount(
  config: PerplServerConfig,
  status: 'NO_ACCOUNT' | 'UNAVAILABLE',
  now: string,
  correlationId: string,
): Promise<AccountSnapshot> {
  const source = await syntheticSource(
    config,
    status === 'NO_ACCOUNT' ? 'FRESH' : 'UNKNOWN',
    now,
    correlationId,
    { accountStatus: status },
  );
  const snapshotHash = await canonicalHash({ status, source: source.contentHash });
  return Object.freeze({
    schemaVersion: '0.1' as const,
    snapshotId: asSnapshotId(`account-${snapshotHash.slice(0, 40)}`),
    status,
    source,
  });
}

async function emptyPortfolio(config: PerplServerConfig, now: string, correlationId: string) {
  const source = await syntheticSource(config, 'UNKNOWN', now, correlationId, {
    portfolio: 'UNAVAILABLE',
  });
  const snapshotHash = await canonicalHash({ source: source.contentHash, points: [] });
  return Object.freeze({
    schemaVersion: '0.1' as const,
    snapshotId: asSnapshotId(`portfolio-${snapshotHash.slice(0, 40)}`),
    period: 'day' as const,
    points: Object.freeze([]),
    source,
  });
}

function healthId(component: string): {
  observedAt: string;
  correlationId: ReturnType<typeof asCorrelationId>;
} {
  const observedAt = new Date().toISOString();
  return { observedAt, correlationId: asCorrelationId(`m02-${component}-${Date.now()}`) };
}

async function persistHealth(
  pool: DbPool | undefined,
  integration: string,
  status: 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'STALE' | 'UNAVAILABLE',
  reason: string,
): Promise<void> {
  if (!pool) return;
  const identity = healthId(integration);
  try {
    await appendIntegrationHealth(pool, {
      schemaVersion: '0.1',
      integration,
      status,
      ...identity,
      reason,
    });
  } catch {
    // Health persistence itself remains best-effort and does not open a financial path.
  }
}

export async function startWorker(
  config: ServerConfig = loadServerConfig(),
  perplConfig: PerplServerConfig = loadPerplConfig(process.env, config.environment),
): Promise<WorkerRuntime> {
  const logger = createLogger({
    level: config.logLevel,
    environment: config.environment,
    component: 'worker',
  });
  let stopped = false;
  let globalExecutionDisabled = true;
  const database = config.databaseUrl ? createDatabase(config) : undefined;
  const controller = new AbortController();
  const refreshKillSwitch = async (): Promise<boolean> => {
    try {
      const persisted = database ? await readGlobalExecutionDisabled(database.db) : true;
      globalExecutionDisabled = config.killSwitchEnabled || persisted;
    } catch {
      globalExecutionDisabled = true;
      logger.warn(
        { globalExecutionDisabled: true },
        'kill-switch state unavailable; failing closed',
      );
    }
    return globalExecutionDisabled;
  };
  await refreshKillSwitch();
  const client = perplConfig.enabled
    ? new PerplReadClient({
        apiUrl: perplConfig.apiUrl,
        wsUrl: perplConfig.wsUrl,
        chainId: perplConfig.chainId,
        ...(perplConfig.credentials ? { credentials: perplConfig.credentials } : {}),
        timeoutMs: 5_000,
        maxRetries: 2,
      })
    : undefined;

  let currentContext: PlainRecord | undefined;
  let latestMarkets = new Map<string, PlainRecord>();
  const fundingByMarket = new Map<string, ReturnType<typeof normalizePerplFundingFrame>[number]>();
  let marketStreamCheckpoint: { sessionId?: string; sequence?: number } = {};
  let accountStreamCheckpoint: { sessionId?: string; sequence?: number } = {};
  let marketReconnectCount = 0;
  let accountReconnectCount = 0;
  let cyclePromise: Promise<void> | undefined;
  const collectOnce = (): Promise<void> => {
    if (!client || !database) return Promise.resolve();
    if (cyclePromise) return cyclePromise;
    cyclePromise = (async () => {
      const now = new Date().toISOString();
      const correlation = `m02-observation-${Date.now()}`;
      let observationStage: 'perpl-public-rest' | 'perpl-account-rest' = 'perpl-public-rest';
      try {
        const [contextValue, tickerValue] = await Promise.all([
          client.getPublicContext(),
          client.getMarketTicker(),
        ]);
        currentContext = object(contextValue, 'Perpl context');
        const ticker = object(tickerValue, 'Perpl ticker');
        const states = object(ticker.d, 'Perpl ticker market map');
        const tokenRows = Array.isArray(currentContext.tokens)
          ? currentContext.tokens.map((value) => object(value, 'Perpl token'))
          : [];
        const tokens = new Map(tokenRows.map((token) => [String(token.id), token]));
        const marketRows = Array.isArray(currentContext.markets)
          ? currentContext.markets.map((value) => object(value, 'Perpl market'))
          : [];
        if (marketRows.length === 0) throw new TypeError('Perpl context contains no markets');
        latestMarkets = new Map();
        const marketSnapshots = [];
        for (const market of marketRows) {
          const marketId = exactInteger(market.id, 'Perpl market id');
          const rawState = states[marketId];
          if (!rawState) continue;
          const quote = quoteTokenFor(market, currentContext, tokens);
          const streamedFunding = fundingByMarket.get(marketId);
          const normalizedMarket = streamedFunding
            ? {
                ...market,
                funding: {
                  feb: streamedFunding.intervalId.split(':').at(-1),
                  rate: streamedFunding.rateMicros,
                  ppl: streamedFunding.paymentPerLotScaled,
                  at: { t: Date.parse(streamedFunding.appliedAt) },
                },
              }
            : market;
          const snapshot = await normalizePerplMarket({
            network: perplConfig.network,
            chainId: perplConfig.chainId,
            receivedAt: now,
            correlationId: correlation,
            market: normalizedMarket,
            state: rawState,
            quoteToken: quote.symbol,
          });
          latestMarkets.set(marketId, market);
          marketSnapshots.push(snapshot);
          await appendMarketSnapshot(database.pool, snapshot);
        }
        if (marketSnapshots.length === 0)
          throw new TypeError('Perpl ticker contains no context markets');
        await persistHealth(database.pool, 'perpl-public-rest', 'HEALTHY', 'READS_VALIDATED');
        observationStage = 'perpl-account-rest';

        let accountSnapshot: AccountSnapshot;
        const positions: Awaited<ReturnType<typeof normalizePerplPosition>>[] = [];
        let portfolioSnapshot;
        if (client.hasReadCredentials) {
          const [positionResult, walletResult, portfolioResult] = await Promise.all([
            client.getPositions(),
            client.getWallet(),
            client.getPortfolio('day'),
          ]);
          const collateral = quoteTokenFor(marketRows[0]!, currentContext, tokens);
          if (
            positionResult.status === 'NO_ACCOUNT' ||
            walletResult.status === 'NO_ACCOUNT' ||
            portfolioResult.status === 'NO_ACCOUNT'
          ) {
            accountSnapshot = await unavailableAccount(perplConfig, 'NO_ACCOUNT', now, correlation);
          } else if (walletResult.status === 'AVAILABLE' && walletResult.payload) {
            accountSnapshot = await normalizePerplWallet({
              network: perplConfig.network,
              chainId: perplConfig.chainId,
              receivedAt: now,
              correlationId: correlation,
              wallet: walletResult.payload,
              collateralDecimals: collateral.decimals,
            });
          } else {
            accountSnapshot = await unavailableAccount(
              perplConfig,
              'UNAVAILABLE',
              now,
              correlation,
            );
          }
          if (positionResult.status === 'AVAILABLE' && positionResult.payload) {
            const rawPositions = Array.isArray(positionResult.payload.d)
              ? positionResult.payload.d.map((value) => object(value, 'Perpl position'))
              : [];
            for (const rawPosition of rawPositions) {
              if (String(rawPosition.st) !== '1') continue;
              const marketId = exactInteger(rawPosition.mkt, 'Perpl position market');
              const market = latestMarkets.get(marketId);
              const snapshot = marketSnapshots.find((item) => item.marketId === marketId);
              if (!market || !snapshot)
                throw new TypeError('Perpl position is missing a current market snapshot');
              const quote = quoteTokenFor(market, currentContext, tokens);
              const position = await normalizePerplPosition({
                network: perplConfig.network,
                chainId: perplConfig.chainId,
                receivedAt: now,
                correlationId: correlation,
                position: rawPosition,
                market,
                marketSnapshot: snapshot,
                collateralDecimals: quote.decimals,
              });
              positions.push(position);
              await appendPositionSnapshot(database.pool, position);
            }
          }
          if (
            portfolioResult.status === 'AVAILABLE' &&
            portfolioResult.payload &&
            Array.isArray(portfolioResult.payload.chart)
          ) {
            portfolioSnapshot = await normalizePerplSeries({
              network: perplConfig.network,
              chainId: perplConfig.chainId,
              receivedAt: now,
              correlationId: correlation,
              chart: portfolioResult.payload.chart,
              tokenDecimals: collateral.decimals,
              period: 'day',
            });
          } else {
            portfolioSnapshot = await emptyPortfolio(perplConfig, now, correlation);
          }
        } else {
          accountSnapshot = await unavailableAccount(perplConfig, 'UNAVAILABLE', now, correlation);
          portfolioSnapshot = await emptyPortfolio(perplConfig, now, correlation);
        }
        await appendPortfolioSnapshot(database.pool, portfolioSnapshot);
        const marketStreamSource = await syntheticSource(
          perplConfig,
          marketStreamFresh ? 'FRESH' : 'UNKNOWN',
          now,
          correlation,
          { wsFresh: marketStreamFresh, sequence: marketStreamCheckpoint.sequence ?? null },
          'perpl-market-ws',
          marketStreamCheckpoint,
        );
        const accountStreamSource = client.hasReadCredentials
          ? await syntheticSource(
              perplConfig,
              accountStreamFresh ? 'FRESH' : 'UNKNOWN',
              now,
              correlation,
              {
                wsFresh: accountStreamFresh,
                sequence: accountStreamCheckpoint.sequence ?? null,
                sessionId: accountStreamCheckpoint.sessionId ?? null,
              },
              'perpl-account-ws',
              accountStreamCheckpoint,
            )
          : undefined;
        const requiredSources: ObservationSource[] = [
          ...marketSnapshots.map((market) => market.source),
          marketStreamSource,
          ...(accountSnapshot.status === 'AVAILABLE' ? [accountSnapshot.source] : []),
          ...(accountStreamSource ? [accountStreamSource] : []),
        ];
        const riskPositions = positions.map((position) => {
          if (!position.markPriceScaled || position.markPriceDecimals === undefined)
            throw new TypeError('Normalized position is missing its mark price reference');
          return {
            ...position,
            markPriceScaled: position.markPriceScaled,
            markPriceDecimals: position.markPriceDecimals,
          };
        });
        const fundingMarket = marketSnapshots.find(
          (market) => market.fundingIntervalId !== undefined,
        );
        const risk = await evaluateRisk({
          generatedAt: now,
          positions: riskPositions,
          account: {
            status: accountSnapshot.status,
            ...(accountSnapshot.collateralMicros
              ? { collateralMicros: accountSnapshot.collateralMicros }
              : {}),
            source: accountSnapshot.source,
          },
          portfolio: {
            period: 'day',
            points: portfolioSnapshot.points,
            source: portfolioSnapshot.source,
          },
          requiredSources,
          ...(fundingMarket?.fundingIntervalId && fundingMarket.fundingRateMicros !== undefined
            ? {
                funding: {
                  intervalId: `${fundingMarket.marketId}:${fundingMarket.fundingIntervalId}`,
                  rateMicros: fundingMarket.fundingRateMicros,
                  appliedAt: fundingMarket.source.observedAt,
                  source: fundingMarket.source,
                },
              }
            : {}),
          maxSourceAgeMs: perplConfig.marketFreshnessMs,
          maxAccountSourceAgeMs: perplConfig.accountFreshnessMs,
        });
        await appendRiskSnapshot(database.pool, risk);
        try {
          const activePolicies = await listActiveM03PolicyConfirmations(database.pool);
          for (const value of activePolicies) {
            const row = object(value, 'persisted M03 policy');
            const compiled = await compileM03Policy(row.payload);
            if (
              !compiled.policy ||
              compiled.policy.versionId !== row.policy_version_id ||
              compiled.policy.canonicalHash !== row.content_hash ||
              compiled.policy.canonicalHash !== row.canonical_hash
            ) {
              continue;
            }
            const confirmedAtValue = row.provenance_confirmed_at;
            const confirmedAt =
              confirmedAtValue instanceof Date
                ? confirmedAtValue.toISOString()
                : typeof confirmedAtValue === 'string'
                  ? confirmedAtValue
                  : '';
            const confirmed = restoreConfirmedM03Policy({
              compiled: compiled.policy,
              now,
              persisted: {
                state: String(row.state),
                canonicalHash: String(row.canonical_hash),
                actorId: String(row.actor_ref),
                issuerId: String(row.issuer_ref),
                proofRefHash: String(row.proof_ref_hash),
                confirmedAt,
              },
            });
            if (!confirmed) continue;
            const lastEffectAt = await latestM03EffectAt(database.pool, compiled.policy.versionId);
            const evaluation = await evaluateM03Triggers({
              policy: confirmed,
              risk,
              now,
              ...(lastEffectAt ? { lastEffectAt } : {}),
            });
            await appendM03TriggerEvaluation(database.pool, {
              evaluation,
              evaluationId: evaluation.evaluationId,
              policyVersionId: compiled.policy.versionId,
              policyVersionHash: evaluation.policyVersionHash,
              snapshotId: risk.snapshotId,
              snapshotHash: evaluation.sourceSnapshotHash,
              result: evaluation.result,
              reason: evaluation.reason,
              correlationId: evaluation.correlationId,
              evaluatedAt: evaluation.evaluatedAt,
            });
            if (evaluation.result !== 'MATCH') continue;
            if (await refreshKillSwitch()) {
              await appendM03PlanningRefusal(database.pool, {
                evaluationId: evaluation.evaluationId,
                policyId: compiled.policy.policyId,
                policyVersionHash: compiled.policy.canonicalHash,
                snapshotHash: risk.snapshotHash!,
                reason: 'KILL_SWITCH_ENABLED',
                actorRef: confirmed.actorId,
                correlationId: evaluation.correlationId,
                occurredAt: now,
              });
              continue;
            }
            const planned = await planM03Action({ policy: confirmed, evaluation, risk, now });
            if (planned.status === 'REFUSED') {
              await appendM03PlanningRefusal(database.pool, {
                evaluationId: evaluation.evaluationId,
                policyId: compiled.policy.policyId,
                policyVersionHash: compiled.policy.canonicalHash,
                snapshotHash: risk.snapshotHash!,
                reason: planned.reason,
                actorRef: confirmed.actorId,
                correlationId: evaluation.correlationId,
                occurredAt: now,
              });
              continue;
            }
            await appendM03ExecutionPlan(database.pool, planned.plan);
            const simulation = await simulateM03Plan({
              plan: planned.plan,
              policy: confirmed,
              risk,
              now,
            });
            await appendM03DryRun(database.pool, simulation);
          }
        } catch {
          await persistHealth(
            database.pool,
            'm03-policy-runtime',
            'DEGRADED',
            'POLICY_EVALUATION_OR_PLAN_PERSISTENCE_FAILURE',
          );
          logger.warn({ component: 'm03-policy-runtime' }, 'M03 policy cycle failed closed');
        }
        await persistHealth(database.pool, 'perpl-public-rest', 'HEALTHY', 'READS_VALIDATED');
        await persistHealth(
          database.pool,
          'perpl-account-rest',
          client.hasReadCredentials
            ? accountSnapshot.status === 'AVAILABLE'
              ? 'HEALTHY'
              : 'UNAVAILABLE'
            : 'UNAVAILABLE',
          client.hasReadCredentials ? accountSnapshot.status : 'READ_ONLY_CREDENTIALS_ABSENT',
        );
        await upsertProviderCheckpoint(database.pool, {
          schemaVersion: '0.1',
          provider: 'perpl',
          stream: 'market-data',
          chainId: perplConfig.chainId,
          ...(marketStreamCheckpoint.sessionId
            ? { sessionId: marketStreamCheckpoint.sessionId }
            : {}),
          ...(marketStreamCheckpoint.sequence !== undefined
            ? { sequence: String(marketStreamCheckpoint.sequence) }
            : {}),
          quality: marketStreamFresh ? 'FRESH' : 'UNKNOWN',
          reconnectCount: marketReconnectCount,
          observedAt: now,
          reason: marketStreamFresh ? 'HEARTBEAT_CONTIGUOUS' : 'AWAITING_CONTIGUOUS_HEARTBEAT',
        });
        if (client.hasReadCredentials)
          await upsertProviderCheckpoint(database.pool, {
            schemaVersion: '0.1',
            provider: 'perpl',
            stream: 'account-data',
            chainId: perplConfig.chainId,
            ...(accountStreamCheckpoint.sessionId
              ? { sessionId: accountStreamCheckpoint.sessionId }
              : {}),
            ...(accountStreamCheckpoint.sequence !== undefined
              ? { sequence: String(accountStreamCheckpoint.sequence) }
              : {}),
            quality: accountStreamFresh ? 'FRESH' : 'UNKNOWN',
            reconnectCount: accountReconnectCount,
            observedAt: now,
            reason: accountStreamFresh
              ? 'ACCOUNT_BASELINE_CONTIGUOUS'
              : 'AWAITING_ACCOUNT_BASELINE',
          });
      } catch (error) {
        const reason =
          error instanceof Error && 'status' in error
            ? String((error as { status: unknown }).status)
            : 'READ_OR_SCHEMA_FAILURE';
        await persistHealth(
          database.pool,
          observationStage,
          reason === 'DEGRADED' || reason === 'RATE_LIMITED' ? 'DEGRADED' : 'UNAVAILABLE',
          reason,
        );
        logger.warn({ provider: 'perpl', reason }, 'observation cycle failed closed');
      }
    })().finally(() => {
      cyclePromise = undefined;
    });
    return cyclePromise;
  };

  let marketStreamFresh = false;
  let accountStreamFresh = false;
  const streamTasks: Promise<void>[] = [];
  let observationTask: Promise<void> | undefined;
  if (client && database) {
    observationTask = (async () => {
      while (!controller.signal.aborted) {
        await collectOnce();
        try {
          await delay(15_000, undefined, { signal: controller.signal });
        } catch {
          break;
        }
      }
    })();
    streamTasks.push(
      runPublicMarketStream({
        wsUrl: perplConfig.wsUrl,
        chainId: perplConfig.chainId,
        callbacks: {
          onMessage(message) {
            const messageType = Number(message.mt);
            if (messageType === 100) {
              marketStreamCheckpoint = {
                ...(typeof message.ses === 'string' ? { sessionId: message.ses } : {}),
                sequence: Number(exactInteger(message.sn, 'market heartbeat sequence')),
              };
            }
            if (messageType === 9 && currentContext && database) {
              void (async () => {
                const states = object(message.d, 'Perpl WebSocket market states');
                const tokenRows = Array.isArray(currentContext?.tokens)
                  ? currentContext.tokens.map((value) => object(value, 'Perpl token'))
                  : [];
                const tokens = new Map(tokenRows.map((token) => [String(token.id), token]));
                const marketRows = Array.isArray(currentContext?.markets)
                  ? currentContext.markets.map((value) => object(value, 'Perpl market'))
                  : [];
                for (const market of marketRows) {
                  const id = String(market.id);
                  if (!states[id]) continue;
                  const quote = quoteTokenFor(market, currentContext!, tokens);
                  const snapshot = await normalizePerplMarket({
                    network: perplConfig.network,
                    chainId: perplConfig.chainId,
                    receivedAt: new Date().toISOString(),
                    correlationId: `m02-market-ws-${Date.now()}`,
                    quality: marketStreamFresh ? 'FRESH' : 'UNKNOWN',
                    ...(marketStreamCheckpoint.sequence !== undefined
                      ? { sequence: String(marketStreamCheckpoint.sequence) }
                      : {}),
                    ...(marketStreamCheckpoint.sessionId
                      ? { sessionId: marketStreamCheckpoint.sessionId }
                      : {}),
                    market,
                    state: states[id],
                    quoteToken: quote.symbol,
                  });
                  await appendMarketSnapshot(database.pool, snapshot);
                }
              })().catch(
                () =>
                  void persistHealth(
                    database?.pool,
                    'perpl-market-ws',
                    'DEGRADED',
                    'MARKET_STATE_NORMALIZATION_FAILURE',
                  ),
              );
            }
            if (messageType === 10) {
              for (const funding of normalizePerplFundingFrame(message)) {
                const current = fundingByMarket.get(funding.marketId);
                const next = upsertFundingInterval(current ? [current] : [], funding)[0];
                if (next) fundingByMarket.set(funding.marketId, next);
              }
              void collectOnce();
            }
          },
          onIntegrity(state) {
            marketStreamFresh = state.fresh;
            marketReconnectCount = state.reconnectCount;
            if (state.reason === 'RECONNECT_STALE') void collectOnce();
            void persistHealth(
              database?.pool,
              'perpl-market-ws',
              state.fresh ? 'HEALTHY' : state.reason === 'DISCONNECTED' ? 'STALE' : 'DEGRADED',
              state.reason,
            );
            if (database)
              void upsertProviderCheckpoint(database.pool, {
                schemaVersion: '0.1',
                provider: 'perpl',
                stream: 'market-data',
                chainId: perplConfig.chainId,
                ...(marketStreamCheckpoint.sessionId
                  ? { sessionId: marketStreamCheckpoint.sessionId }
                  : {}),
                ...(marketStreamCheckpoint.sequence !== undefined
                  ? { sequence: String(marketStreamCheckpoint.sequence) }
                  : {}),
                quality: state.fresh ? 'FRESH' : 'STALE',
                reconnectCount: marketReconnectCount,
                observedAt: new Date().toISOString(),
                reason: state.reason,
              }).catch(() => undefined);
          },
        },
        signal: controller.signal,
        minReconnectDelayMs: perplConfig.reconnectMinMs,
        maxReconnectDelayMs: perplConfig.reconnectMaxMs,
      }),
    );
    if (perplConfig.credentials) {
      streamTasks.push(
        runReadOnlyAccountStream({
          wsUrl: perplConfig.wsUrl,
          chainId: perplConfig.chainId,
          credentials: perplConfig.credentials,
          callbacks: {
            onMessage(message) {
              const messageType = Number(message.mt);
              if (messageType === 19 || messageType === 100)
                accountStreamCheckpoint = {
                  ...(typeof message.ses === 'string'
                    ? { sessionId: message.ses }
                    : accountStreamCheckpoint.sessionId
                      ? { sessionId: accountStreamCheckpoint.sessionId }
                      : {}),
                  sequence: Number(exactInteger(message.sn, 'account stream sequence')),
                };
              if (messageType !== 100) void collectOnce();
              if (database)
                void upsertProviderCheckpoint(database.pool, {
                  schemaVersion: '0.1',
                  provider: 'perpl',
                  stream: 'account-data',
                  chainId: perplConfig.chainId,
                  ...(accountStreamCheckpoint.sessionId
                    ? { sessionId: accountStreamCheckpoint.sessionId }
                    : {}),
                  ...(accountStreamCheckpoint.sequence !== undefined
                    ? { sequence: String(accountStreamCheckpoint.sequence) }
                    : {}),
                  quality: accountStreamFresh ? 'FRESH' : 'UNKNOWN',
                  reconnectCount: accountReconnectCount,
                  observedAt: new Date().toISOString(),
                  reason:
                    messageType === 100 ? 'ACCOUNT_HEARTBEAT_CONTIGUOUS' : 'ACCOUNT_STATE_UPDATE',
                }).catch(() => undefined);
            },
            onIntegrity(state) {
              accountStreamFresh = state.fresh;
              accountReconnectCount = state.reconnectCount;
              if (state.reason === 'RECONNECT_STALE') void collectOnce();
              void persistHealth(
                database?.pool,
                'perpl-account-ws',
                state.fresh ? 'HEALTHY' : state.reason === 'DISCONNECTED' ? 'STALE' : 'DEGRADED',
                state.reason,
              );
              if (database)
                void upsertProviderCheckpoint(database.pool, {
                  schemaVersion: '0.1',
                  provider: 'perpl',
                  stream: 'account-data',
                  chainId: perplConfig.chainId,
                  ...(accountStreamCheckpoint.sessionId
                    ? { sessionId: accountStreamCheckpoint.sessionId }
                    : {}),
                  ...(accountStreamCheckpoint.sequence !== undefined
                    ? { sequence: String(accountStreamCheckpoint.sequence) }
                    : {}),
                  quality: state.fresh ? 'FRESH' : 'STALE',
                  reconnectCount: accountReconnectCount,
                  observedAt: new Date().toISOString(),
                  reason: state.reason,
                }).catch(() => undefined);
            },
          },
          signal: controller.signal,
          minReconnectDelayMs: perplConfig.reconnectMinMs,
          maxReconnectDelayMs: perplConfig.reconnectMaxMs,
        }),
      );
    }
  } else if (perplConfig.enabled) {
    void persistHealth(
      database?.pool,
      'perpl-public-rest',
      'UNAVAILABLE',
      'DATABASE_NOT_CONFIGURED',
    );
  } else {
    void persistHealth(database?.pool, 'perpl-public-rest', 'UNAVAILABLE', 'OBSERVATION_DISABLED');
    void persistHealth(database?.pool, 'perpl-market-ws', 'UNAVAILABLE', 'OBSERVATION_DISABLED');
    void persistHealth(
      database?.pool,
      'perpl-account-rest',
      'UNAVAILABLE',
      'READ_ONLY_CREDENTIALS_ABSENT',
    );
  }

  logger.info(
    {
      state: 'OBSERVATION_MODE',
      executionEnabled: false,
      globalExecutionDisabled,
      perplObservationEnabled: perplConfig.enabled,
    },
    'worker started in observation mode',
  );
  return {
    get status() {
      return stopped ? 'STOPPED' : 'OBSERVATION_MODE';
    },
    executionEnabled: false,
    get globalExecutionDisabled() {
      return globalExecutionDisabled;
    },
    refreshKillSwitch,
    async shutdown(reason = 'shutdown requested') {
      if (stopped) return;
      stopped = true;
      controller.abort();
      await Promise.allSettled(streamTasks);
      await observationTask;
      await database?.pool.end();
      logger.info({ state: 'STOPPED', reason }, 'worker stopped');
    },
  };
}
