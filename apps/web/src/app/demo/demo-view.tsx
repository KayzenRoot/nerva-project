'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { locales, type Locale } from '../i18n.ts';
import { demoCopy, phaseLabels, scenarioNames, scenarioReasons } from './demo-copy.ts';
import { NervaBrand } from '../nerva-brand.tsx';
import {
  DEMO_FIXTURE_VERSION,
  DEMO_SCENARIOS,
  GUIDED_DEMO_DURATION_SECONDS,
  GUIDED_PHASES,
  advanceGuidedDemo,
  createInitialDemoState,
  getDemoScenario,
  recordDemoAnalytics,
  resetGuidedDemo,
  selectDemoScenario,
  startGuidedDemo,
  type DemoScenario,
  type DemoScenarioId,
  type DemoState,
} from './demo-model.ts';

const copy = demoCopy;
type DemoCopy = (typeof demoCopy)['en'];
const localeLabels: Record<Locale, string> = { en: 'EN', 'pt-BR': 'PT', es: 'ES' };
const recordingPathLabels: Record<Locale, string> = {
  en: 'Open video recording path',
  'pt-BR': 'Abrir percurso para gravação',
  es: 'Abrir recorrido para grabación',
};
const journeyLabels: Record<Locale, readonly string[]> = {
  en: ['Context', 'Risk', 'Policy', 'Shock', 'Protection', 'Outcome', 'Flight Recorder'],
  'pt-BR': ['Contexto', 'Risco', 'Política', 'Choque', 'Proteção', 'Resultado', 'Flight Recorder'],
  es: ['Contexto', 'Riesgo', 'Política', 'Impacto', 'Protección', 'Resultado', 'Flight Recorder'],
};

function decisionNotice(
  refusalReason: string | undefined,
  outcome: DemoState['outcome'],
  text: DemoCopy,
) {
  if (refusalReason) {
    return { tone: 'refused', heading: text.refusal, detail: refusalReason } as const;
  }
  if (outcome === 'SIMULATED_OUTCOME') {
    return { tone: 'simulated', heading: text.simulatedOutcome, detail: text.outcome } as const;
  }
  return undefined;
}

function evidenceStatus(
  index: number,
  phaseIndex: number,
  outcome: DemoScenario['outcome'],
  text: DemoCopy,
): string {
  if (index === 7) return outcome;
  if (index <= phaseIndex) return text.observedSynthetic;
  return text.pending;
}

function links(locale: Locale, text: DemoCopy) {
  return [
    [`/?lang=${locale}`, text.home],
    [`/dashboard?lang=${locale}`, text.dashboard],
    [`/demo?lang=${locale}`, text.guided],
    [`/policies?lang=${locale}`, text.policies],
    [`/permissions?lang=${locale}`, text.permissions],
    [`/flight-recorder?lang=${locale}`, text.flightRecorder],
  ] as const;
}

export function DemoView({ locale }: { readonly locale: Locale }) {
  const text = copy[locale];
  const [state, setState] = useState<DemoState>(() => createInitialDemoState());
  const [policyDraft, setPolicyDraft] = useState('');
  const phaseWindow = GUIDED_PHASES[state.phase] ?? GUIDED_PHASES[0];
  const phase = phaseWindow.key;
  const scenario = useMemo(() => getDemoScenario(state.scenarioId), [state.scenarioId]);

  useEffect(() => {
    if (!state.playing) return;
    const timer = window.setInterval(() => {
      setState((current) => advanceGuidedDemo(current));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.playing]);

  const phaseIndex = state.phase;
  const refusalReason = scenario.refusalReason
    ? scenarioReasons[locale][scenario.refusalReason]
    : undefined;
  const notice = decisionNotice(refusalReason, state.outcome, text);
  function chooseScenario(id: DemoScenarioId) {
    setState(selectDemoScenario(id));
    recordDemoAnalytics('scenario_selected');
    if (id !== 'protection-story') recordDemoAnalytics('refusal_category');
  }

  function reset() {
    setState(resetGuidedDemo());
    setPolicyDraft('');
    recordDemoAnalytics('demo_reset');
  }

  function nextPhase() {
    setState((current) =>
      advanceGuidedDemo(current, phaseWindow.endSeconds - current.elapsedSeconds),
    );
    recordDemoAnalytics('guided_demo_phase');
  }

  function start() {
    setState((current) => startGuidedDemo(current));
    recordDemoAnalytics('guided_demo_started');
  }

  return (
    <main className="app-shell demo-app" lang={locale}>
      <a className="skip-link" href="#main-content">
        {text.skipContent}
      </a>
      <aside className="sidebar" aria-label="NERVA">
        <Link className="brand" href={`/?lang=${locale}`} aria-label="NERVA">
          <NervaBrand />
        </Link>
        <nav className="primary-nav" aria-label={text.primaryNav}>
          {links(locale, text).map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={href.startsWith('/demo') ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-status">
          <span className="signal signal-amber" aria-hidden="true" />
          {text.local}
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div className="breadcrumb">
            NERVA <span>/</span> {text.guided}
          </div>
          <nav className="language-switcher" aria-label={text.languageLabel}>
            {locales.map((option) => (
              <Link
                key={option}
                href={`/demo?lang=${option}`}
                aria-current={locale === option ? 'page' : undefined}
              >
                {localeLabels[option]}
              </Link>
            ))}
          </nav>
        </header>
        <div className="demo-ribbon" role="note">
          <span aria-hidden="true">◆</span> {text.label}
          <span className="demo-version">{DEMO_FIXTURE_VERSION}</span>
          <Link
            className="demo-recording-link"
            data-testid="recording-path-link"
            href={`/demo/recording/risk?lang=${locale}`}
          >
            {recordingPathLabels[locale]}
          </Link>
        </div>
        <div id="main-content" className="page-content">
          <section className="page-heading demo-heading">
            <div>
              <p className="eyebrow">{text.experienceEyebrow}</p>
              <h1>{text.title}</h1>
              <p>{text.intro}</p>
            </div>
            <div className="mode-stack">
              <span className="mode-chip mode-demo">{text.label}</span>
              <span className="mode-caption">{text.liveLabel}</span>
            </div>
          </section>
          <section className="trust-notice" aria-label={text.mode}>
            <span className="notice-icon" aria-hidden="true">
              !
            </span>
            <div>
              <strong>{text.warning}</strong>
              <p>{text.nonAuthoritative}</p>
            </div>
          </section>
          <div className="demo-grid">
            <section className="panel demo-guide" aria-labelledby="guided-title">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{text.walkthroughEyebrow}</p>
                  <h2 id="guided-title">{text.guided}</h2>
                </div>
                <span className="state-tag">
                  {state.elapsedSeconds}/{GUIDED_DEMO_DURATION_SECONDS}s
                </span>
              </div>
              <progress
                className="progress-track"
                aria-label={text.guided}
                max={GUIDED_DEMO_DURATION_SECONDS}
                value={state.elapsedSeconds}
              />
              <ol className="guided-steps" aria-label={text.guided} tabIndex={0}>
                {journeyLabels[locale].map((label, index) => {
                  const stepState =
                    index < phaseIndex ? 'complete' : index === phaseIndex ? 'current' : 'pending';
                  return (
                    <li
                      key={label}
                      data-step-state={stepState}
                      aria-current={stepState === 'current' ? 'step' : undefined}
                    >
                      <span className="guided-step-number">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span>{label}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="phase-summary" aria-live="polite">
                <span className="phase-number">{phaseIndex + 1}</span>
                <div>
                  <p className="eyebrow">
                    {text.phase} {phaseIndex + 1} / {GUIDED_PHASES.length} ·{' '}
                    {phaseLabels[locale][phase]} · {phaseWindow.startSeconds}–
                    {phaseWindow.endSeconds}s
                  </p>
                  <p>{text[phase]}</p>
                </div>
              </div>
              {phase === 'policy' ? (
                <section
                  className="policy-constraints"
                  aria-label={text.policyConstraintsTitle}
                  data-testid="demo-policy-constraints"
                >
                  <h3>{text.policyConstraintsTitle}</h3>
                  <dl>
                    {[
                      [text.policyTriggerLabel, text.policyTrigger],
                      [text.policyActionLabel, text.policyAction],
                      [text.policyMaxFractionLabel, text.policyMaxFraction],
                      [text.policyMaxNotionalLabel, text.policyMaxNotional],
                      [text.policySlippageLabel, text.policySlippage],
                      [text.policyMarketPositionLabel, text.policyMarketPosition],
                      [text.policyCooldownLabel, text.policyCooldown],
                      [text.policyExpiryLabel, text.policyExpiry],
                      [text.policyRefusalLabel, text.policyRefusal],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="confirmation-representation">{text.confirmationRepresentation}</p>
                </section>
              ) : null}
              {notice ? (
                <output className={`decision-banner decision-${notice.tone}`} aria-live="polite">
                  <strong>{notice.heading}</strong>
                  <span>{notice.detail}</span>
                </output>
              ) : null}
              {phase === 'closeout' ? (
                <section
                  className="guided-closeout"
                  aria-label={text.recorder}
                  data-testid="guided-closeout"
                >
                  <p>{text.closeoutLineage}</p>
                  <p>{text.closeout}</p>
                </section>
              ) : null}
              <div className="button-row">
                <button
                  className="button button-primary"
                  type="button"
                  onClick={start}
                  disabled={state.playing}
                >
                  {state.playing ? text.inProgress : text.start}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={nextPhase}
                  disabled={state.playing || phaseIndex === GUIDED_PHASES.length - 1}
                >
                  {text.next}
                </button>
                <button className="button button-quiet" type="button" onClick={reset}>
                  {text.reset}
                </button>
              </div>
              <p className="fine-print">
                {text.elapsed}: {state.elapsedSeconds} {text.seconds} · {text.mode}: {text.local}
              </p>
            </section>
            <section className="panel scenario-panel" aria-labelledby="scenario-title">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{text.safetyEyebrow}</p>
                  <h2 id="scenario-title">{text.scenarios}</h2>
                </div>
                <span className="status-label">
                  {scenario.outcome === 'REFUSED' ? 'REFUSED' : scenario.source}
                </span>
              </div>
              <div className="scenario-list">
                {DEMO_SCENARIOS.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className={`scenario-button ${candidate.id === state.scenarioId ? 'selected' : ''}`}
                    aria-pressed={candidate.id === state.scenarioId}
                    onClick={() => chooseScenario(candidate.id)}
                  >
                    <span className="scenario-icon" aria-hidden="true">
                      {candidate.outcome === 'REFUSED' ? '!' : '↗'}
                    </span>
                    <span>
                      <strong>{scenarioNames[locale][candidate.id]}</strong>
                      <small>
                        {candidate.outcome === 'REFUSED'
                          ? text.scenarioRefused
                          : text.scenarioSynthetic}
                      </small>
                    </span>
                    <span className="scenario-arrow" aria-hidden="true">
                      ›
                    </span>
                  </button>
                ))}
              </div>
              <div className="scenario-facts">
                <span>{scenario.source}</span>
                <span>{scenario.grant}</span>
                <span>{scenario.delegation}</span>
                <span>{scenario.provider}</span>
              </div>
            </section>
          </div>
          <section className="monitor-section" aria-labelledby="monitor-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{text.trustViewEyebrow}</p>
                <h2 id="monitor-title">{text.monitor}</h2>
              </div>
              <span className="live-state">{text.demoOnlyTag}</span>
            </div>
            <div className="monitor-grid">
              <article className="panel monitor-card">
                <div className="card-icon" aria-hidden="true">
                  ◈
                </div>
                <p className="eyebrow">{text.riskLabel}</p>
                <h3>{scenario.source === 'STALE_SYNTHETIC' ? 'STALE' : 'OBSERVED · SYNTHETIC'}</h3>
                <p>
                  {text.exposure}: <strong>{text.exposureValue}</strong>
                </p>
                <p className="unproven-metric">{text.unproven}</p>
              </article>
              <article className="panel monitor-card">
                <div className="card-icon" aria-hidden="true">
                  ⌑
                </div>
                <p className="eyebrow">{text.permissionSummary}</p>
                <h3>{scenario.grant}</h3>
                <p>{text.authority}</p>
                <p className="sub-state">{scenario.delegation}</p>
              </article>
              <article className="panel monitor-card">
                <div className="card-icon" aria-hidden="true">
                  ⟲
                </div>
                <p className="eyebrow">{text.emergency}</p>
                <h3>{scenario.provider}</h3>
                <p>{text.emergencyState}</p>
                <p className="sub-state">{text.killSwitch}</p>
              </article>
            </div>
          </section>
          <div className="demo-grid secondary-grid">
            <section className="panel" aria-labelledby="builder-title">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{text.noAuthorityTag}</p>
                  <h2 id="builder-title">{text.policyBuilder}</h2>
                </div>
                <span className="state-tag">{text.draftOnlyTag}</span>
              </div>
              <p>{text.policyHint}</p>
              <label className="field-label" htmlFor="demo-policy-text">
                {text.untrustedRequest}
              </label>
              <textarea
                id="demo-policy-text"
                value={policyDraft}
                onChange={(event) => setPolicyDraft(event.target.value)}
                placeholder={text.policyPlaceholder}
              />
              <p className="fine-print">{text.policyFinePrint}</p>
            </section>
            <section className="panel" aria-labelledby="recorder-title">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{text.localFixtureEyebrow}</p>
                  <h2 id="recorder-title">{text.recorder}</h2>
                </div>
                <span className="integrity-tag">{text.demoTraceLocal}</span>
              </div>
              <ol className="evidence-list">
                {[
                  text.source,
                  text.riskEvidence,
                  text.policyVersion,
                  text.trigger,
                  text.plan,
                  text.simulation,
                  text.permission,
                  text.decision,
                ].map((item, index) => (
                  <li key={item} className={index <= phaseIndex ? 'evidence-current' : ''}>
                    <span className="evidence-dot" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                    <small>{evidenceStatus(index, phaseIndex, scenario.outcome, text)}</small>
                  </li>
                ))}
              </ol>
              <p className="fine-print">{text.traceState}</p>
            </section>
          </div>
          <footer className="app-footer">
            <span>
              {text.label} · {DEMO_FIXTURE_VERSION}
            </span>
            <span>{text.emergencyState}</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
