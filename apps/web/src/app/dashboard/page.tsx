import Link from 'next/link';
import {
  RiskSnapshotM02Schema,
  MarketSnapshotM02Schema,
  PositionSnapshotM02Schema,
  IntegrationHealthM02Schema,
} from '@nerva/contracts';
import {
  createDatabase,
  latestIntegrationHealth,
  latestMarketSnapshots,
  latestPositionSnapshots,
  latestRiskSnapshot,
} from '@nerva/db';
import { loadPerplConfig, loadServerConfig } from '@nerva/config';
import { dashboardCopy } from '../dashboard-copy.ts';
import { resolveLocale, type Locale } from '../i18n.ts';
import { ExperienceHeader } from '../experience-header.tsx';

export const dynamic = 'force-dynamic';

function formatScaled(value: string, precision: number): string {
  const negative = value.startsWith('-');
  const digits = negative ? value.slice(1) : value;
  const padded = digits.padStart(precision + 1, '0');
  const integer = precision === 0 ? padded : padded.slice(0, -precision);
  const fraction = precision === 0 ? '' : padded.slice(-precision).replace(/0+$/, '');
  return `${negative ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`;
}

async function loadDashboardReadModel() {
  const server = loadServerConfig();
  const perpl = loadPerplConfig(process.env, server.environment);
  if (!server.databaseUrl)
    return {
      network: perpl.network,
      riskStatus: 'UNAVAILABLE' as const,
      risk: undefined,
      markets: [],
      positions: [],
      providers: [],
    };
  const { pool } = createDatabase(server);
  try {
    const [rawRisk, rawMarkets, rawPositions, rawHealth] = await Promise.all([
      latestRiskSnapshot(pool),
      latestMarketSnapshots(pool),
      latestPositionSnapshots(pool),
      latestIntegrationHealth(pool),
    ]);
    const parsedRisk = rawRisk === undefined ? undefined : RiskSnapshotM02Schema.safeParse(rawRisk);
    const risk = parsedRisk?.success ? parsedRisk.data : undefined;
    const markets = rawMarkets.flatMap((raw) => {
      const parsed = MarketSnapshotM02Schema.safeParse(raw);
      return parsed.success ? [parsed.data] : [];
    });
    const positions = rawPositions.flatMap((raw) => {
      const parsed = PositionSnapshotM02Schema.safeParse(raw);
      return parsed.success ? [parsed.data] : [];
    });
    const providers = rawHealth.flatMap((raw) => {
      const parsed = IntegrationHealthM02Schema.safeParse(raw);
      return parsed.success ? [parsed.data] : [];
    });
    let riskStatus: 'AVAILABLE' | 'NO_ACCOUNT' | 'NO_POSITION' | 'STALE' | 'UNAVAILABLE' =
      'UNAVAILABLE';
    if (risk) {
      const account = risk.metrics.find((metric) => metric.name === 'ACCOUNT_COLLATERAL_MICROS');
      const count = risk.metrics.find((metric) => metric.name === 'OPEN_POSITION_COUNT');
      const ageMs = Date.now() - Date.parse(risk.generatedAt);
      riskStatus =
        account?.reason === 'NO_ACCOUNT'
          ? 'NO_ACCOUNT'
          : account?.reason === 'ACCOUNT_UNAVAILABLE' ||
              account?.reason === 'COLLATERAL_UNAVAILABLE'
            ? 'UNAVAILABLE'
            : risk.quality === 'STALE' || ageMs > perpl.marketFreshnessMs
              ? 'STALE'
              : risk.quality !== 'FRESH' || ageMs < 0
                ? 'UNAVAILABLE'
                : count?.value === '0'
                  ? 'NO_POSITION'
                  : 'AVAILABLE';
    }
    return { network: perpl.network, riskStatus, risk, markets, positions, providers };
  } catch {
    return {
      network: perpl.network,
      riskStatus: 'UNAVAILABLE' as const,
      risk: undefined,
      markets: [],
      positions: [],
      providers: [],
    };
  } finally {
    await pool.end();
  }
}

type DashboardModel = Awaited<ReturnType<typeof loadDashboardReadModel>>;
type DashboardCopy = (typeof dashboardCopy)['en'];
type Position = DashboardModel['positions'][number];

function statusLabel(value: string, copy: DashboardCopy): string {
  return copy.status[value as keyof typeof copy.status] ?? copy.status.UNKNOWN;
}

function freshnessStatus(status: DashboardModel['riskStatus'], quality: string): string {
  if (status === 'STALE' || quality === 'STALE') return 'STALE';
  return 'UNKNOWN';
}

function drawdownValue(model: DashboardModel, copy: DashboardCopy): string {
  const metric = model.risk?.metrics.find((item) => item.name === 'PORTFOLIO_DRAWDOWN_BPS');
  if (model.riskStatus !== 'AVAILABLE' || metric?.quality !== 'FRESH') {
    return statusLabel(freshnessStatus(model.riskStatus, metric?.quality ?? ''), copy);
  }
  if (metric.valueBps === undefined) return statusLabel('UNKNOWN', copy);
  return `${metric.valueBps} bps`;
}

function markPrice(position: Position, copy: DashboardCopy): string {
  if (
    position.source.quality === 'FRESH' &&
    position.markPriceScaled &&
    position.markPriceDecimals !== undefined
  ) {
    return formatScaled(position.markPriceScaled, position.markPriceDecimals);
  }
  return statusLabel(freshnessStatus('AVAILABLE', position.source.quality), copy);
}

function positionNotional(position: Position, model: DashboardModel, copy: DashboardCopy): string {
  const metric = model.risk?.metrics.find(
    (item) =>
      item.name === 'POSITION_NOTIONAL_MICROS' && item.metadata?.positionId === position.positionId,
  );
  if (model.riskStatus === 'AVAILABLE' && metric?.quality === 'FRESH' && metric.value) {
    return `${formatScaled(metric.value, 6)} ${position.quoteToken}`;
  }
  return `${statusLabel(freshnessStatus(model.riskStatus, metric?.quality ?? ''), copy)} ${position.quoteToken}`;
}

function adverseMove(position: Position, model: DashboardModel, copy: DashboardCopy): string {
  const metric = model.risk?.metrics.find(
    (item) =>
      item.name === 'POSITION_ADVERSE_MOVE_BPS' &&
      item.metadata?.positionId === position.positionId,
  );
  const value = metric?.valueBps ?? metric?.value;
  if (model.riskStatus !== 'AVAILABLE' || metric?.quality !== 'FRESH' || value === undefined) {
    return statusLabel(freshnessStatus(model.riskStatus, metric?.quality ?? ''), copy);
  }
  return `${value} bps`;
}

function RiskSummaryCard({
  model,
  locale,
  copy,
}: {
  readonly model: DashboardModel;
  readonly locale: Locale;
  readonly copy: DashboardCopy;
}) {
  const unproven = [copy.liquidationDistance, copy.maintenanceMargin, copy.fundingDirection];
  return (
    <article className="dashboard-card">
      <h2>{copy.riskSummary}</h2>
      <span className={`state state-${model.riskStatus.toLowerCase()}`}>
        {statusLabel(model.riskStatus, copy)}
      </span>
      {model.risk ? (
        <>
          <p>
            {model.risk.quality} · {new Date(model.risk.generatedAt).toLocaleString(locale)}
          </p>
          <dl className="metric-list">
            <MetricRow label={copy.portfolioDrawdown} value={drawdownValue(model, copy)} />
            {unproven.map((label) => (
              <MetricRow
                key={label}
                label={label}
                value={`${statusLabel('UNAVAILABLE', copy)} · ${copy.unavailableUnproven}`}
              />
            ))}
          </dl>
        </>
      ) : (
        <p>{copy.noObservation}</p>
      )}
    </article>
  );
}

function MetricRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ProviderHealthCard({
  model,
  copy,
}: {
  readonly model: DashboardModel;
  readonly copy: DashboardCopy;
}) {
  return (
    <article className="dashboard-card">
      <h2>{copy.health}</h2>
      {model.providers.length > 0 ? (
        <ul className="health-list">
          {model.providers.map((provider) => (
            <li key={provider.integration}>
              <span>{provider.integration}</span>
              <strong className={`state state-${provider.status.toLowerCase()}`}>
                {statusLabel(provider.status, copy)}
              </strong>
            </li>
          ))}
        </ul>
      ) : (
        <p>{copy.noObservation}</p>
      )}
    </article>
  );
}

function RiskProvenanceCard({
  model,
  copy,
}: {
  readonly model: NonNullable<DashboardModel['risk']>;
  readonly copy: DashboardCopy;
}) {
  return (
    <section className="dashboard-card market-card" aria-labelledby="risk-provenance-title">
      <h2 id="risk-provenance-title">{copy.provenanceTitle}</h2>
      <p>
        {copy.snapshotLabel}: <code>{model.snapshotId}</code> · {model.quality} ·{' '}
        {copy.observedLabel} <time dateTime={model.observedAt}>{model.observedAt}</time>
      </p>
      <p>{copy.sourceHashes}</p>
      {model.sourceSnapshotHashes?.length ? (
        <ul className="source-hash-list">
          {model.sourceSnapshotHashes.map((hash) => (
            <li key={hash}>
              <code>{hash}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p>UNKNOWN · {copy.unknownSourceHash}</p>
      )}
    </section>
  );
}

function MarketCard({
  model,
  copy,
}: {
  readonly model: DashboardModel;
  readonly copy: DashboardCopy;
}) {
  return (
    <section className="dashboard-card market-card">
      <h2>
        {copy.markets} · {model.network}
      </h2>
      {model.markets.length > 0 ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{copy.symbol}</th>
                <th>{copy.mark}</th>
                <th>{copy.quality}</th>
                <th>{copy.observedLabel}</th>
              </tr>
            </thead>
            <tbody>
              {model.markets.map((market) => (
                <tr key={market.marketId}>
                  <td>{market.symbol}</td>
                  <td>
                    {formatScaled(market.markPriceScaled, market.priceDecimals)} {market.quoteToken}
                  </td>
                  <td>{market.source.quality}</td>
                  <td>
                    <time dateTime={market.source.observedAt}>{market.source.observedAt}</time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>{copy.noObservation}</p>
      )}
    </section>
  );
}

function PositionRow({
  position,
  model,
  copy,
}: {
  readonly position: Position;
  readonly model: DashboardModel;
  readonly copy: DashboardCopy;
}) {
  return (
    <tr key={position.snapshotId}>
      <td>{position.symbol}</td>
      <td>{position.side}</td>
      <td>{formatScaled(position.sizeScaled, position.sizeDecimals)}</td>
      <td>{formatScaled(position.entryPriceScaled, position.entryPriceDecimals)}</td>
      <td>{markPrice(position, copy)}</td>
      <td>{positionNotional(position, model, copy)}</td>
      <td>{adverseMove(position, model, copy)}</td>
      <td>
        <span className={`state state-${position.source.quality.toLowerCase()}`}>
          {position.source.quality}
        </span>
      </td>
      <td>
        <details className="source-details">
          <summary>{copy.inspectSource}</summary>
          <dl>
            <dt>{copy.network}</dt>
            <dd>
              {position.source.network} · chain {position.source.chainId}
            </dd>
            <dt>{copy.observedLabel}</dt>
            <dd>{position.source.observedAt}</dd>
            <dt>{copy.received}</dt>
            <dd>{position.source.receivedAt}</dd>
            <dt>{copy.sequence}</dt>
            <dd>{position.source.sequence ?? statusLabel('UNKNOWN', copy)}</dd>
            <dt>{copy.contentHash}</dt>
            <dd>
              <code>{position.source.contentHash}</code>
            </dd>
          </dl>
        </details>
      </td>
    </tr>
  );
}

function PositionsCard({
  model,
  copy,
}: {
  readonly model: DashboardModel;
  readonly copy: DashboardCopy;
}) {
  if (model.positions.length === 0) {
    const empty = model.riskStatus === 'NO_POSITION' ? copy.noPositions : copy.noObservation;
    return (
      <section className="dashboard-card market-card">
        <h2>{copy.positions}</h2>
        <p>{empty}</p>
      </section>
    );
  }

  return (
    <section className="dashboard-card market-card">
      <h2>{copy.positions}</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{copy.symbol}</th>
              <th>{copy.side}</th>
              <th>{copy.size}</th>
              <th>{copy.entry}</th>
              <th>{copy.mark}</th>
              <th>{copy.notional}</th>
              <th>{copy.adverseMove}</th>
              <th>{copy.sourceQuality}</th>
              <th>{copy.inspectSource}</th>
            </tr>
          </thead>
          <tbody>
            {model.positions.map((position) => (
              <PositionRow
                key={position.snapshotId}
                position={position}
                model={model}
                copy={copy}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly lang?: string | string[] }>;
}) {
  const locale = resolveLocale((await searchParams).lang);
  const copy = dashboardCopy[locale];
  const model = await loadDashboardReadModel();

  return (
    <main className="dashboard-shell" lang={locale}>
      <ExperienceHeader locale={locale} active="dashboard" />
      <section className="dashboard-heading">
        <p className="eyebrow">NERVA · M02</p>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
        <div className="readonly-badge">{copy.readOnly}</div>
      </section>
      <section className="dashboard-grid" aria-label={copy.riskSummary}>
        <RiskSummaryCard model={model} locale={locale} copy={copy} />
        <ProviderHealthCard model={model} copy={copy} />
      </section>
      {model.risk ? <RiskProvenanceCard model={model.risk} copy={copy} /> : null}
      <MarketCard model={model} copy={copy} />
      <PositionsCard model={model} copy={copy} />
      <section className="api-links" aria-label={copy.apiLinks}>
        <span>{copy.apiLinks}</span>
        <Link href="/api/risk/portfolio">{copy.riskSummary}</Link>
        <Link href="/api/integrations/health">{copy.health}</Link>
        <Link href="/api/market/context">{copy.markets}</Link>
      </section>
      <footer className="dashboard-footer">
        {copy.readOnly} · <Link href="/api/health/live">Service health</Link>
      </footer>
    </main>
  );
}
