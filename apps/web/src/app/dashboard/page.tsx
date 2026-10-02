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
import { locales, resolveLocale } from '../i18n.ts';

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

export default async function DashboardPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly lang?: string | string[] }>;
}) {
  const locale = resolveLocale((await searchParams).lang);
  const copy = dashboardCopy[locale];
  const model = await loadDashboardReadModel();
  const metric = (name: string) => model.risk?.metrics.find((item) => item.name === name);
  const statusLabel = (value: string) =>
    copy.status[value as keyof typeof copy.status] ?? copy.status.UNKNOWN;

  return (
    <main className="dashboard-shell" lang={locale}>
      <header className="dashboard-topbar">
        <Link className="brand" href={`/?lang=${locale}`} aria-label="NERVA">
          NERVA
        </Link>
        <nav className="language-switcher" aria-label={copy.languageLabel}>
          {locales.map((option) => (
            <Link
              key={option}
              href={`/dashboard?lang=${option}`}
              aria-current={locale === option ? 'page' : undefined}
            >
              {option === 'en' ? 'EN' : option === 'pt-BR' ? 'PT' : 'ES'}
            </Link>
          ))}
        </nav>
      </header>
      {process.env.NERVA_DEMO_SIMULATION_ENABLED === 'true' ? (
        <p className="demo-banner">{copy.fixtureNotice}</p>
      ) : null}
      <section className="dashboard-heading">
        <p className="eyebrow">NERVA · M02</p>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
        <div className="readonly-badge">{copy.readOnly}</div>
      </section>
      <section className="dashboard-grid" aria-label={copy.riskSummary}>
        <article className="dashboard-card">
          <h2>{copy.riskSummary}</h2>
          <span className={`state state-${model.riskStatus.toLowerCase()}`}>
            {statusLabel(model.riskStatus)}
          </span>
          {model.risk ? (
            <>
              <p>
                {model.risk.quality} · {new Date(model.risk.generatedAt).toLocaleString(locale)}
              </p>
              <dl className="metric-list">
                <div>
                  <dt>{copy.portfolioDrawdown}</dt>
                  <dd>
                    {metric('PORTFOLIO_DRAWDOWN_BPS')?.valueBps === undefined
                      ? statusLabel('UNKNOWN')
                      : `${metric('PORTFOLIO_DRAWDOWN_BPS')?.valueBps} bps`}
                  </dd>
                </div>
                <div>
                  <dt>{copy.liquidationDistance}</dt>
                  <dd>{statusLabel('UNAVAILABLE')} · UNAVAILABLE_UNPROVEN</dd>
                </div>
              </dl>
            </>
          ) : (
            <p>{copy.noObservation}</p>
          )}
        </article>
        <article className="dashboard-card">
          <h2>{copy.health}</h2>
          {model.providers.length > 0 ? (
            <ul className="health-list">
              {model.providers.map((provider) => (
                <li key={provider.integration}>
                  <span>{provider.integration}</span>
                  <strong className={`state state-${provider.status.toLowerCase()}`}>
                    {statusLabel(provider.status)}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>{copy.noObservation}</p>
          )}
        </article>
      </section>
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
                  <th>Quality</th>
                  <th>Observed</th>
                </tr>
              </thead>
              <tbody>
                {model.markets.map((market) => (
                  <tr key={market.marketId}>
                    <td>{market.symbol}</td>
                    <td>
                      {formatScaled(market.markPriceScaled, market.priceDecimals)}{' '}
                      {market.quoteToken}
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
      <section className="dashboard-card market-card">
        <h2>{copy.positions}</h2>
        {model.positions.length > 0 ? (
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
                </tr>
              </thead>
              <tbody>
                {model.positions.map((position) => {
                  const metrics =
                    model.risk?.metrics.filter(
                      (item) => item.metadata?.positionId === position.positionId,
                    ) ?? [];
                  const notional = metrics.find(
                    (item) => item.name === 'POSITION_NOTIONAL_MICROS',
                  )?.value;
                  const adverse = metrics.find((item) => item.name === 'POSITION_ADVERSE_MOVE_BPS');
                  const adverseValue = adverse?.valueBps ?? adverse?.value;
                  return (
                    <tr key={position.snapshotId}>
                      <td>{position.symbol}</td>
                      <td>{position.side}</td>
                      <td>{formatScaled(position.sizeScaled, position.sizeDecimals)}</td>
                      <td>
                        {formatScaled(position.entryPriceScaled, position.entryPriceDecimals)}
                      </td>
                      <td>
                        {position.markPriceScaled && position.markPriceDecimals !== undefined
                          ? formatScaled(position.markPriceScaled, position.markPriceDecimals)
                          : statusLabel('UNKNOWN')}
                      </td>
                      <td>
                        {notional ? formatScaled(notional, 6) : statusLabel('UNKNOWN')}{' '}
                        {position.quoteToken}
                      </td>
                      <td>
                        {adverseValue === undefined
                          ? statusLabel('UNKNOWN')
                          : `${adverseValue} bps`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p>{model.riskStatus === 'NO_POSITION' ? copy.noPositions : copy.noObservation}</p>
        )}
      </section>
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
