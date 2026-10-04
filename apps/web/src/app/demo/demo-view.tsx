'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { locales, type Locale } from '../i18n.ts';
import {
  DEMO_FIXTURE_VERSION,
  DEMO_SCENARIOS,
  GUIDED_DEMO_DURATION_SECONDS,
  GUIDED_DEMO_PHASE_SECONDS,
  GUIDED_PHASES,
  advanceGuidedDemo,
  createInitialDemoState,
  getDemoScenario,
  recordDemoAnalytics,
  resetGuidedDemo,
  selectDemoScenario,
  startGuidedDemo,
  type DemoScenarioId,
  type DemoState,
} from './demo-model.ts';

const copy = {
  en: {
    label: 'DEMO ONLY · SYNTHETIC DATA',
    title: 'Protection you can inspect.',
    intro: 'A deterministic walkthrough of risk, bounded authority, refusal and evidence.',
    warning: 'Nothing here is connected to a wallet, provider, database or financial effect.',
    guided: '84-second guided demo',
    start: 'Start guided demo',
    next: 'Advance one phase',
    reset: 'Reset demo',
    phase: 'Phase',
    elapsed: 'Scripted time',
    seconds: 'seconds',
    scenarios: 'Safety scenarios',
    protection: 'Protection story',
    stale: 'Stale source',
    revoked: 'Permission revoked',
    delegate: 'Delegate changed',
    degraded: 'Provider degraded',
    context: 'Monad Testnet · Perpl perpetuals',
    risk: 'Risk is deterministic and sourced. Unproven liquidation distance stays unavailable.',
    policy: 'Policy preview · REDUCE_POSITION only · 10% maximum · NO_ACTION fallback',
    deterioration: 'Synthetic adverse move crosses the example trigger. Fixture only.',
    safety:
      'Preflight checks freshness, provider health, permission and delegation before any path.',
    outcome: 'SIMULATED OUTCOME · DRY_RUN_ONLY · no provider receipt or transaction exists.',
    evidence: 'Local synthetic trace · not cryptographic evidence and not stored.',
    closeout:
      'End state · effects remain blocked, the demo can be reset, and M06 is not part of this walkthrough.',
    refusal: 'REFUSED · no action is proposed because a required safety condition failed.',
    staleReason: 'Source is stale. Current data cannot authorize a decision.',
    revokedReason: 'The parent permission is revoked. Derived authority is invalid.',
    delegateReason: 'Delegation changed. Authority bound to the prior observation is invalid.',
    degradedReason: 'Provider health is degraded. The path is non-actionable.',
    source: 'Source snapshot',
    riskEvidence: 'Deterministic risk',
    policyVersion: 'Policy version',
    trigger: 'Trigger evaluation',
    plan: 'Bounded plan',
    simulation: 'Simulation / preflight',
    permission: 'Permission check',
    decision: 'Decision / outcome',
    freshness: 'FRESH · SYNTHETIC FIXTURE',
    active: 'ACTIVE · SYNTHETIC GRANT',
    matched: 'MATCHED · SYNTHETIC DELEGATION',
    healthy: 'HEALTHY · SYNTHETIC PROVIDER',
    monitor: 'Protection monitor',
    mode: 'Mode',
    local: 'Local-only deterministic state',
    riskLabel: 'Risk context',
    exposure: 'Example exposure',
    exposureValue: '$12,400 synthetic',
    unproven: 'LIQUIDATION_DISTANCE · UNAVAILABLE_UNPROVEN',
    permissionSummary: 'Authority summary',
    authority: 'Bounded example · expires in 20 minutes · revocation wins',
    policyBuilder: 'Policy builder preview',
    policyHint:
      'Templates and natural-language text stay untrusted until the existing review path confirms them.',
    emergency: 'Emergency and safety',
    emergencyState: 'Mainnet effect: HARD_BLOCKED · Live Perpl writes: BLOCKED',
    killSwitch: 'SYNTHETIC KILL SWITCH · ON · demo cannot change controls',
    recorder: 'Flight Recorder lineage',
    traceState: 'DEMO TRACE · synthetic and local; not provider evidence.',
    nonAuthoritative: 'STALE, UNKNOWN and unproven metrics never become authority.',
    home: 'Home',
    dashboard: 'Risk dashboard',
    policies: 'Policies',
    permissions: 'Permissions',
    flightRecorder: 'Flight Recorder',
    liveLabel: 'Live product views are separately labeled LIVE READ ONLY.',
  },
  'pt-BR': {
    label: 'SOMENTE DEMO · DADOS SINTÉTICOS',
    title: 'Proteção que você pode inspecionar.',
    intro: 'Um percurso determinístico por risco, autoridade limitada, recusa e evidências.',
    warning: 'Nada aqui se conecta a carteira, provedor, banco de dados ou efeito financeiro.',
    guided: 'Demo guiada de 84 segundos',
    start: 'Iniciar demo guiada',
    next: 'Avançar uma etapa',
    reset: 'Reiniciar demo',
    phase: 'Etapa',
    elapsed: 'Tempo roteirizado',
    seconds: 'segundos',
    scenarios: 'Cenários de segurança',
    protection: 'História de proteção',
    stale: 'Fonte desatualizada',
    revoked: 'Permissão revogada',
    delegate: 'Delegado alterado',
    degraded: 'Provedor degradado',
    context: 'Monad Testnet · Perpétuos Perpl',
    risk: 'O risco é determinístico e tem origem explícita. Distância de liquidação não comprovada continua indisponível.',
    policy: 'Prévia de política · somente REDUCE_POSITION · máximo 10% · fallback NO_ACTION',
    deterioration: 'Movimento adverso sintético cruza o gatilho de exemplo. Apenas fixture.',
    safety:
      'O preflight verifica atualidade, saúde do provedor, permissão e delegação antes de qualquer caminho.',
    outcome: 'RESULTADO SIMULADO · DRY_RUN_ONLY · não existe recibo de provedor nem transação.',
    evidence: 'Trilha sintética local · não é evidência criptográfica e não foi persistida.',
    closeout:
      'Estado final · efeitos continuam bloqueados, a demo pode ser reiniciada e M06 não faz parte deste percurso.',
    refusal: 'RECUSADO · nenhuma ação é proposta porque uma condição de segurança falhou.',
    staleReason: 'A fonte está desatualizada. Dados atuais não podem autorizar uma decisão.',
    revokedReason: 'A permissão principal foi revogada. A autoridade derivada é inválida.',
    delegateReason: 'A delegação mudou. A autoridade vinculada à observação anterior é inválida.',
    degradedReason: 'A saúde do provedor está degradada. O caminho não permite ação.',
    source: 'Snapshot de origem',
    riskEvidence: 'Risco determinístico',
    policyVersion: 'Versão da política',
    trigger: 'Avaliação do gatilho',
    plan: 'Plano limitado',
    simulation: 'Simulação / preflight',
    permission: 'Verificação de permissão',
    decision: 'Decisão / resultado',
    freshness: 'FRESH · FIXTURE SINTÉTICA',
    active: 'ATIVA · CONCESSÃO SINTÉTICA',
    matched: 'CORRESPONDENTE · DELEGAÇÃO SINTÉTICA',
    healthy: 'SAUDÁVEL · PROVEDOR SINTÉTICO',
    monitor: 'Monitor de proteção',
    mode: 'Modo',
    local: 'Estado determinístico somente local',
    riskLabel: 'Contexto de risco',
    exposure: 'Exposição de exemplo',
    exposureValue: 'US$ 12.400 sintéticos',
    unproven: 'LIQUIDATION_DISTANCE · UNAVAILABLE_UNPROVEN',
    permissionSummary: 'Resumo de autoridade',
    authority: 'Exemplo limitado · expira em 20 minutos · revogação prevalece',
    policyBuilder: 'Prévia do construtor de políticas',
    policyHint:
      'Modelos e texto em linguagem natural permanecem não confiáveis até confirmação pelo fluxo de revisão existente.',
    emergency: 'Emergência e segurança',
    emergencyState: 'Efeito em mainnet: HARD_BLOCKED · Escritas Perpl ao vivo: BLOCKED',
    killSwitch: 'KILL SWITCH SINTÉTICO · ON · a demo não altera controles',
    recorder: 'Linhagem do Flight Recorder',
    traceState: 'TRILHA DEMO · sintética e local; não é evidência de provedor.',
    nonAuthoritative: 'STALE, UNKNOWN e métricas não comprovadas nunca se tornam autoridade.',
    home: 'Início',
    dashboard: 'Painel de risco',
    policies: 'Políticas',
    permissions: 'Permissões',
    flightRecorder: 'Flight Recorder',
    liveLabel: 'As telas do produto ao vivo têm o rótulo separado LIVE READ ONLY.',
  },
  es: {
    label: 'SOLO DEMO · DATOS SINTÉTICOS',
    title: 'Protección que puedes inspeccionar.',
    intro: 'Un recorrido determinista por riesgo, autoridad limitada, rechazo y evidencia.',
    warning: 'Nada aquí se conecta a una cartera, proveedor, base de datos o efecto financiero.',
    guided: 'Demo guiada de 84 segundos',
    start: 'Iniciar demo guiada',
    next: 'Avanzar una fase',
    reset: 'Reiniciar demo',
    phase: 'Fase',
    elapsed: 'Tiempo guionizado',
    seconds: 'segundos',
    scenarios: 'Escenarios de seguridad',
    protection: 'Historia de protección',
    stale: 'Fuente desactualizada',
    revoked: 'Permiso revocado',
    delegate: 'Delegado cambiado',
    degraded: 'Proveedor degradado',
    context: 'Monad Testnet · Perpetuos de Perpl',
    risk: 'El riesgo es determinista y tiene origen explícito. La distancia de liquidación no probada sigue no disponible.',
    policy: 'Vista previa de política · solo REDUCE_POSITION · máximo 10% · fallback NO_ACTION',
    deterioration: 'Movimiento adverso sintético supera el disparador de ejemplo. Solo fixture.',
    safety:
      'El preflight comprueba vigencia, salud del proveedor, permiso y delegación antes de cualquier ruta.',
    outcome: 'RESULTADO SIMULADO · DRY_RUN_ONLY · no existe recibo del proveedor ni transacción.',
    evidence: 'Traza sintética local · no es evidencia criptográfica y no se almacenó.',
    closeout:
      'Estado final · los efectos siguen bloqueados, la demo se puede reiniciar y M06 no forma parte de este recorrido.',
    refusal: 'RECHAZADO · no se propone ninguna acción porque falló una condición de seguridad.',
    staleReason:
      'La fuente está desactualizada. Los datos actuales no pueden autorizar una decisión.',
    revokedReason: 'El permiso principal fue revocado. La autoridad derivada no es válida.',
    delegateReason:
      'La delegación cambió. La autoridad vinculada a la observación anterior no es válida.',
    degradedReason: 'La salud del proveedor está degradada. La ruta no permite acciones.',
    source: 'Snapshot de origen',
    riskEvidence: 'Riesgo determinista',
    policyVersion: 'Versión de política',
    trigger: 'Evaluación del disparador',
    plan: 'Plan limitado',
    simulation: 'Simulación / preflight',
    permission: 'Comprobación de permiso',
    decision: 'Decisión / resultado',
    freshness: 'FRESH · FIXTURE SINTÉTICA',
    active: 'ACTIVA · CONCESIÓN SINTÉTICA',
    matched: 'COINCIDE · DELEGACIÓN SINTÉTICA',
    healthy: 'SALUDABLE · PROVEEDOR SINTÉTICO',
    monitor: 'Monitor de protección',
    mode: 'Modo',
    local: 'Estado determinista solo local',
    riskLabel: 'Contexto de riesgo',
    exposure: 'Exposición de ejemplo',
    exposureValue: '12.400 USD sintéticos',
    unproven: 'LIQUIDATION_DISTANCE · UNAVAILABLE_UNPROVEN',
    permissionSummary: 'Resumen de autoridad',
    authority: 'Ejemplo limitado · vence en 20 minutos · prevalece la revocación',
    policyBuilder: 'Vista previa del constructor de políticas',
    policyHint:
      'Las plantillas y el texto natural siguen sin confianza hasta la confirmación por el flujo de revisión existente.',
    emergency: 'Emergencia y seguridad',
    emergencyState: 'Efecto en mainnet: HARD_BLOCKED · Escrituras Perpl en vivo: BLOCKED',
    killSwitch: 'KILL SWITCH SINTÉTICO · ON · la demo no cambia controles',
    recorder: 'Linaje de Flight Recorder',
    traceState: 'TRAZA DEMO · sintética y local; no es evidencia del proveedor.',
    nonAuthoritative: 'STALE, UNKNOWN y las métricas no probadas nunca se convierten en autoridad.',
    home: 'Inicio',
    dashboard: 'Panel de riesgo',
    policies: 'Políticas',
    permissions: 'Permisos',
    flightRecorder: 'Flight Recorder',
    liveLabel: 'Las vistas del producto en vivo tienen la etiqueta separada LIVE READ ONLY.',
  },
} as const;

type DemoCopy = Readonly<{ [Key in keyof (typeof copy)['en']]: string }>;

const phaseLabels: Record<Locale, readonly string[]> = {
  en: ['Context', 'Risk', 'Policy', 'Deterioration', 'Safety', 'Outcome', 'Evidence', 'Closeout'],
  'pt-BR': [
    'Contexto',
    'Risco',
    'Política',
    'Deterioração',
    'Segurança',
    'Resultado',
    'Evidência',
    'Encerramento',
  ],
  es: [
    'Contexto',
    'Riesgo',
    'Política',
    'Deterioro',
    'Seguridad',
    'Resultado',
    'Evidencia',
    'Cierre',
  ],
};

const scenarioNames: Record<Locale, Readonly<Record<DemoScenarioId, string>>> = {
  en: {
    'protection-story': 'Protection story',
    'stale-source': 'Stale source',
    'permission-revoked': 'Permission revoked',
    'delegate-changed': 'Delegate changed',
    'provider-degraded': 'Provider degraded',
  },
  'pt-BR': {
    'protection-story': 'História de proteção',
    'stale-source': 'Fonte desatualizada',
    'permission-revoked': 'Permissão revogada',
    'delegate-changed': 'Delegado alterado',
    'provider-degraded': 'Provedor degradado',
  },
  es: {
    'protection-story': 'Historia de protección',
    'stale-source': 'Fuente desactualizada',
    'permission-revoked': 'Permiso revocado',
    'delegate-changed': 'Delegado cambiado',
    'provider-degraded': 'Proveedor degradado',
  },
};

const scenarioReasons: Record<
  Locale,
  Readonly<Record<'STALE' | 'GRANT_REVOKED' | 'DELEGATE_CHANGED' | 'PROVIDER_DEGRADED', string>>
> = {
  en: {
    STALE: copy.en.staleReason,
    GRANT_REVOKED: copy.en.revokedReason,
    DELEGATE_CHANGED: copy.en.delegateReason,
    PROVIDER_DEGRADED: copy.en.degradedReason,
  },
  'pt-BR': {
    STALE: copy['pt-BR'].staleReason,
    GRANT_REVOKED: copy['pt-BR'].revokedReason,
    DELEGATE_CHANGED: copy['pt-BR'].delegateReason,
    PROVIDER_DEGRADED: copy['pt-BR'].degradedReason,
  },
  es: {
    STALE: copy.es.staleReason,
    GRANT_REVOKED: copy.es.revokedReason,
    DELEGATE_CHANGED: copy.es.delegateReason,
    PROVIDER_DEGRADED: copy.es.degradedReason,
  },
};

const phaseDescriptions: Record<
  Locale,
  Readonly<Record<(typeof GUIDED_PHASES)[number], string>>
> = {
  en: {
    context: copy.en.context,
    risk: copy.en.risk,
    policy: copy.en.policy,
    deterioration: copy.en.deterioration,
    safety: copy.en.safety,
    outcome: copy.en.outcome,
    evidence: copy.en.evidence,
    closeout: copy.en.closeout,
  },
  'pt-BR': {
    context: copy['pt-BR'].context,
    risk: copy['pt-BR'].risk,
    policy: copy['pt-BR'].policy,
    deterioration: copy['pt-BR'].deterioration,
    safety: copy['pt-BR'].safety,
    outcome: copy['pt-BR'].outcome,
    evidence: copy['pt-BR'].evidence,
    closeout: copy['pt-BR'].closeout,
  },
  es: {
    context: copy.es.context,
    risk: copy.es.risk,
    policy: copy.es.policy,
    deterioration: copy.es.deterioration,
    safety: copy.es.safety,
    outcome: copy.es.outcome,
    evidence: copy.es.evidence,
    closeout: copy.es.closeout,
  },
};

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
  const phase = GUIDED_PHASES[state.phase] ?? 'context';
  const scenario = useMemo(() => getDemoScenario(state.scenarioId), [state.scenarioId]);

  useEffect(() => {
    if (!state.playing) return;
    const timer = window.setInterval(() => {
      setState((current) => advanceGuidedDemo(current));
    }, GUIDED_DEMO_PHASE_SECONDS * 1000);
    return () => window.clearInterval(timer);
  }, [state.playing]);

  const phaseIndex = state.phase;
  const refusalReason = scenario.refusalReason
    ? scenarioReasons[locale][scenario.refusalReason]
    : undefined;
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
    setState((current) => advanceGuidedDemo(current));
    recordDemoAnalytics('guided_demo_phase');
  }

  function start() {
    setState((current) => startGuidedDemo(current));
    recordDemoAnalytics('guided_demo_started');
  }

  return (
    <main className="app-shell demo-app" lang={locale}>
      <a className="skip-link" href="#main-content">
        {locale === 'pt-BR'
          ? 'Pular para o conteúdo'
          : locale === 'es'
            ? 'Saltar al contenido'
            : 'Skip to content'}
      </a>
      <aside className="sidebar" aria-label="NERVA">
        <Link className="brand" href={`/?lang=${locale}`} aria-label="NERVA">
          NERVA<span className="brand-mark">●</span>
        </Link>
        <nav
          className="primary-nav"
          aria-label={
            locale === 'pt-BR'
              ? 'Navegação principal'
              : locale === 'es'
                ? 'Navegación principal'
                : 'Primary navigation'
          }
        >
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
          <nav
            className="language-switcher"
            aria-label={locale === 'pt-BR' ? 'Idioma' : locale === 'es' ? 'Idioma' : 'Language'}
          >
            {locales.map((option) => (
              <Link
                key={option}
                href={`/demo?lang=${option}`}
                aria-current={locale === option ? 'page' : undefined}
              >
                {option === 'en' ? 'EN' : option === 'pt-BR' ? 'PT' : 'ES'}
              </Link>
            ))}
          </nav>
        </header>
        <div className="demo-ribbon" role="note">
          <span aria-hidden="true">◆</span> {text.label}
          <span className="demo-version">{DEMO_FIXTURE_VERSION}</span>
        </div>
        <div id="main-content" className="page-content">
          <section className="page-heading demo-heading">
            <div>
              <p className="eyebrow">M05 · EXPERIENCE PREVIEW</p>
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
                  <p className="eyebrow">GUIDED WALKTHROUGH</p>
                  <h2 id="guided-title">{text.guided}</h2>
                </div>
                <span className="state-tag">
                  {state.elapsedSeconds}/{GUIDED_DEMO_DURATION_SECONDS}s
                </span>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-label={text.guided}
                aria-valuemin={0}
                aria-valuemax={GUIDED_DEMO_DURATION_SECONDS}
                aria-valuenow={state.elapsedSeconds}
              >
                <span
                  style={{
                    width: `${Math.min(100, (state.elapsedSeconds / GUIDED_DEMO_DURATION_SECONDS) * 100)}%`,
                  }}
                />
              </div>
              <div className="phase-summary" aria-live="polite">
                <span className="phase-number">{phaseIndex + 1}</span>
                <div>
                  <p className="eyebrow">
                    {text.phase} {phaseIndex + 1} / {GUIDED_PHASES.length} ·{' '}
                    {phaseLabels[locale][phaseIndex]}
                  </p>
                  <p>{phaseDescriptions[locale][phase]}</p>
                </div>
              </div>
              {refusalReason ? (
                <p className="decision-banner decision-refused" role="status">
                  <strong>{text.refusal}</strong>
                  <span>{refusalReason}</span>
                </p>
              ) : state.outcome === 'SIMULATED_OUTCOME' ? (
                <p className="decision-banner decision-simulated" role="status">
                  <strong>SIMULATED OUTCOME</strong>
                  <span>{text.outcome}</span>
                </p>
              ) : null}
              <div className="button-row">
                <button
                  className="button button-primary"
                  type="button"
                  onClick={start}
                  disabled={state.playing}
                >
                  {state.playing
                    ? locale === 'pt-BR'
                      ? 'Demo em andamento…'
                      : locale === 'es'
                        ? 'Demo en curso…'
                        : 'Demo in progress…'
                    : text.start}
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
                  <p className="eyebrow">FAIL-CLOSED BY DESIGN</p>
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
                          ? 'REFUSED · NO ACTION'
                          : 'SYNTHETIC · DRY RUN'}
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
                <p className="eyebrow">READ-ONLY TRUST VIEW</p>
                <h2 id="monitor-title">{text.monitor}</h2>
              </div>
              <span className="live-state">DEMO ONLY</span>
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
                  <p className="eyebrow">NO AUTHORITY CREATED</p>
                  <h2 id="builder-title">{text.policyBuilder}</h2>
                </div>
                <span className="state-tag">DRAFT ONLY</span>
              </div>
              <p>{text.policyHint}</p>
              <label className="field-label" htmlFor="demo-policy-text">
                {locale === 'pt-BR'
                  ? 'Rascunho de solicitação não confiável'
                  : locale === 'es'
                    ? 'Borrador de solicitud no confiable'
                    : 'Untrusted request draft'}
              </label>
              <textarea
                id="demo-policy-text"
                value={policyDraft}
                onChange={(event) => setPolicyDraft(event.target.value)}
                placeholder={
                  locale === 'pt-BR'
                    ? 'Ex.: reduza a posição se a perda diária exceder o limite…'
                    : locale === 'es'
                      ? 'Ej.: reduce la posición si la pérdida diaria supera el límite…'
                      : 'Example: reduce the position if daily drawdown crosses a limit…'
                }
              />
              <p className="fine-print">
                {locale === 'pt-BR'
                  ? 'Texto não enviado nem interpretado por LLM. Use /policies para validar um modelo estruturado.'
                  : locale === 'es'
                    ? 'Texto no enviado ni interpretado por un LLM. Usa /policies para validar una plantilla estructurada.'
                    : 'Text is not sent or interpreted by an LLM. Use /policies to validate a structured template.'}
              </p>
            </section>
            <section className="panel" aria-labelledby="recorder-title">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">LOCAL FIXTURE LINEAGE</p>
                  <h2 id="recorder-title">{text.recorder}</h2>
                </div>
                <span className="integrity-tag">DEMO TRACE · LOCAL</span>
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
                    <small>
                      {index === 7
                        ? scenario.outcome
                        : index <= phaseIndex
                          ? 'OBSERVED · SYNTHETIC'
                          : 'PENDING'}
                    </small>
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
