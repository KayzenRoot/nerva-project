import Link from 'next/link';
import type { Locale } from '../../i18n.ts';
import { demoCopy } from '../demo-copy.ts';
import { NervaBrand } from '../../nerva-brand.tsx';
import { createDemoRecordingFixture, type RecordingSurface } from './recording-model.ts';
import { recordingCopy } from './recording-copy.ts';

const surfaces: readonly RecordingSurface[] = ['risk', 'policy', 'flight-recorder'];
const localeLabels: Record<Locale, string> = { en: 'EN', 'pt-BR': 'PT', es: 'ES' };

function surfaceLabel(surface: RecordingSurface, locale: Locale): string {
  const copy = recordingCopy[locale];
  if (surface === 'risk') return copy.risk;
  if (surface === 'policy') return copy.policy;
  return copy.recorder;
}

export function RecordingDemoView({
  locale,
  surface,
}: {
  readonly locale: Locale;
  readonly surface: RecordingSurface;
}) {
  const labels = recordingCopy[locale];
  const guided = demoCopy[locale];
  const fixture = createDemoRecordingFixture(locale);
  const title =
    surface === 'risk'
      ? labels.riskTitle
      : surface === 'policy'
        ? labels.policyTitle
        : labels.recorderTitle;
  const intro =
    surface === 'risk'
      ? labels.riskIntro
      : surface === 'policy'
        ? labels.policyIntro
        : labels.recorderIntro;

  return (
    <main className="recording-demo-shell" lang={locale} data-testid="recording-demo">
      <a className="skip-link" href="#recording-content">
        {guided.skipContent}
      </a>
      <header className="recording-demo-header">
        <Link
          className="recording-demo-brand"
          href={`/demo?lang=${locale}`}
          aria-label={`NERVA · ${labels.home}`}
        >
          <NervaBrand />
        </Link>
        <nav className="recording-demo-nav" aria-label={labels.nav}>
          {surfaces.map((item) => (
            <Link
              key={item}
              aria-current={surface === item ? 'page' : undefined}
              href={`/demo/recording/${item}?lang=${locale}`}
            >
              {surfaceLabel(item, locale)}
            </Link>
          ))}
        </nav>
        <nav className="recording-language-switcher" aria-label={guided.languageLabel}>
          {(['en', 'pt-BR', 'es'] as const).map((option) => (
            <Link
              key={option}
              aria-current={locale === option ? 'page' : undefined}
              href={`/demo/recording/${surface}?lang=${option}`}
            >
              {localeLabels[option]}
            </Link>
          ))}
        </nav>
      </header>
      <div className="recording-demo-ribbon" role="note" data-testid="demo-only-label">
        <span aria-hidden="true">◆</span>
        <strong>{fixture.label}</strong>
        <span>{fixture.fixtureVersion}</span>
      </div>
      <div className="recording-demo-content" id="recording-content">
        <section className="recording-demo-heading">
          <p className="eyebrow">{labels.eyebrow}</p>
          <h1>{title}</h1>
          <p>{intro}</p>
          <p className="recording-demo-intro">{labels.intro}</p>
        </section>
        <div className="recording-demo-tabs" aria-label={labels.nav}>
          {surfaces.map((item) => (
            <Link
              key={item}
              className={surface === item ? 'active' : ''}
              aria-current={surface === item ? 'page' : undefined}
              href={`/demo/recording/${item}?lang=${locale}`}
            >
              {surfaceLabel(item, locale)}
            </Link>
          ))}
          <Link href={`/dashboard?lang=${locale}`}>{labels.live}</Link>
        </div>

        {surface === 'risk' ? (
          <section
            className="recording-surface"
            aria-labelledby="recording-risk-title"
            data-testid="recording-risk"
          >
            <div className="recording-surface-heading">
              <div>
                <p className="eyebrow">{labels.fixture}</p>
                <h2 id="recording-risk-title">{labels.risk}</h2>
              </div>
              <span className="recording-state">{fixture.risk.freshness}</span>
            </div>
            <div className="recording-risk-grid">
              <article className="recording-stat-card recording-exposure-card">
                <p className="eyebrow">{labels.exposure}</p>
                <strong>{fixture.risk.exposure}</strong>
                <span>{fixture.risk.triggerState}</span>
              </article>
              <article className="recording-stat-card">
                <p className="eyebrow">{labels.market}</p>
                <strong>{fixture.risk.market}</strong>
                <span>{fixture.risk.positionId}</span>
              </article>
              <article className="recording-stat-card">
                <p className="eyebrow">{labels.account}</p>
                <strong>{fixture.risk.accountId}</strong>
                <span>{fixture.risk.scenarioId}</span>
              </article>
            </div>
            <div className="recording-provenance" data-testid="recording-provenance">
              <div>
                <span>{labels.source}</span>
                <strong>{fixture.risk.snapshotId}</strong>
              </div>
              <div>
                <span>{labels.quality}</span>
                <strong>{fixture.risk.freshness}</strong>
              </div>
              <p>
                {guided.risk} {guided.evidence}
              </p>
            </div>
            <div className="recording-unproven-grid">
              {fixture.risk.unprovenMetrics.map((metric) => (
                <div key={metric}>
                  <span>{metric.split(' · ')[0]}</span>
                  <strong>{labels.unavailable}</strong>
                  <code>UNAVAILABLE_UNPROVEN</code>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {surface === 'policy' ? (
          <section
            className="recording-surface"
            aria-labelledby="recording-policy-title"
            data-testid="recording-policy"
          >
            <div className="recording-surface-heading">
              <div>
                <p className="eyebrow">{labels.policySummary}</p>
                <h2 id="recording-policy-title">{labels.policy}</h2>
              </div>
              <span className="recording-state">DISPLAY ONLY · NO AUTHORITY</span>
            </div>
            <dl className="recording-policy-grid">
              {(
                [
                  [labels.trigger, fixture.policy.trigger],
                  [labels.action, fixture.policy.action],
                  [labels.fraction, fixture.policy.maxActionFraction],
                  [labels.notional, fixture.policy.maxNotional],
                  [labels.slippage, fixture.policy.maxSlippage],
                  [labels.marketPosition, fixture.policy.marketPosition],
                  [labels.cooldown, fixture.policy.cooldown],
                  [labels.expiry, fixture.policy.expiry],
                  [labels.refusal, fixture.policy.refusalBehavior],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="recording-confirmation" data-testid="recording-confirmation">
              <span className="recording-confirmation-mark" aria-hidden="true">
                ✓
              </span>
              <div>
                <strong>{labels.confirmation}</strong>
                <p>{fixture.policy.confirmation}</p>
              </div>
            </div>
            <details className="recording-json-details" data-testid="recording-json">
              <summary>{labels.json}</summary>
              <p>{labels.jsonNote}</p>
              <pre>
                <code>{JSON.stringify(fixture.displaySpec, null, 2)}</code>
              </pre>
            </details>
          </section>
        ) : null}

        {surface === 'flight-recorder' ? (
          <section
            className="recording-surface"
            aria-labelledby="recording-lineage-title"
            data-testid="recording-flight-recorder"
          >
            <div className="recording-surface-heading">
              <div>
                <p className="eyebrow">{labels.fixture}</p>
                <h2 id="recording-lineage-title">{labels.recorder}</h2>
              </div>
              <span className="recording-state">SYNTHETIC · NOT PERSISTED</span>
            </div>
            <p className="recording-lineage-intro">{labels.recorderIntro}</p>
            <ol className="recording-lineage-grid" aria-label={labels.lineage}>
              {fixture.lineage.map((stage, index) => (
                <li key={stage.key} data-testid="recording-lineage-stage">
                  <span className="recording-lineage-index">0{index + 1}</span>
                  <strong>{stage.label}</strong>
                  <span className="recording-lineage-status">{stage.status}</span>
                  <p>{stage.description}</p>
                </li>
              ))}
            </ol>
            <p className="recording-explicit-boundary">{labels.explicit}</p>
          </section>
        ) : null}

        <footer className="recording-demo-footer">
          <p>{labels.boundaries}</p>
          <span>TESTNET_DEMO · DEMO_ONLY</span>
        </footer>
      </div>
    </main>
  );
}
