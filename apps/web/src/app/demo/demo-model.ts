export const DEMO_FIXTURE_VERSION = 'nerva-m05-demo-v1' as const;
export const GUIDED_DEMO_DURATION_SECONDS = 84 as const;
export const GUIDED_DEMO_PHASE_SECONDS = 12 as const;

export type DemoScenarioId =
  | 'protection-story'
  | 'stale-source'
  | 'permission-revoked'
  | 'delegate-changed'
  | 'provider-degraded';

export type DemoOutcome = 'NOT_STARTED' | 'SIMULATED_OUTCOME' | 'REFUSED';

export interface DemoScenario {
  readonly id: DemoScenarioId;
  readonly source: 'FRESH_SYNTHETIC' | 'STALE_SYNTHETIC';
  readonly grant: 'ACTIVE_SYNTHETIC' | 'REVOKED_SYNTHETIC';
  readonly delegation: 'MATCHED_SYNTHETIC' | 'CHANGED_SYNTHETIC';
  readonly provider: 'HEALTHY_SYNTHETIC' | 'DEGRADED_SYNTHETIC';
  readonly outcome: Exclude<DemoOutcome, 'NOT_STARTED'>;
  readonly refusalReason?: 'STALE' | 'GRANT_REVOKED' | 'DELEGATE_CHANGED' | 'PROVIDER_DEGRADED';
}

export interface DemoState {
  readonly fixtureVersion: typeof DEMO_FIXTURE_VERSION;
  readonly scenarioId: DemoScenarioId;
  readonly phase: number;
  readonly elapsedSeconds: number;
  readonly playing: boolean;
  readonly outcome: DemoOutcome;
}

function defineScenario(
  id: DemoScenarioId,
  source: DemoScenario['source'],
  grant: DemoScenario['grant'],
  delegation: DemoScenario['delegation'],
  provider: DemoScenario['provider'],
  outcome: DemoScenario['outcome'],
  refusalReason?: DemoScenario['refusalReason'],
): DemoScenario {
  return Object.freeze({ id, source, grant, delegation, provider, outcome, refusalReason });
}

export const DEMO_SCENARIOS: readonly DemoScenario[] = Object.freeze([
  defineScenario(
    'protection-story',
    'FRESH_SYNTHETIC',
    'ACTIVE_SYNTHETIC',
    'MATCHED_SYNTHETIC',
    'HEALTHY_SYNTHETIC',
    'SIMULATED_OUTCOME',
  ),
  defineScenario(
    'stale-source',
    'STALE_SYNTHETIC',
    'ACTIVE_SYNTHETIC',
    'MATCHED_SYNTHETIC',
    'HEALTHY_SYNTHETIC',
    'REFUSED',
    'STALE',
  ),
  defineScenario(
    'permission-revoked',
    'FRESH_SYNTHETIC',
    'REVOKED_SYNTHETIC',
    'MATCHED_SYNTHETIC',
    'HEALTHY_SYNTHETIC',
    'REFUSED',
    'GRANT_REVOKED',
  ),
  defineScenario(
    'delegate-changed',
    'FRESH_SYNTHETIC',
    'ACTIVE_SYNTHETIC',
    'CHANGED_SYNTHETIC',
    'HEALTHY_SYNTHETIC',
    'REFUSED',
    'DELEGATE_CHANGED',
  ),
  defineScenario(
    'provider-degraded',
    'FRESH_SYNTHETIC',
    'ACTIVE_SYNTHETIC',
    'MATCHED_SYNTHETIC',
    'DEGRADED_SYNTHETIC',
    'REFUSED',
    'PROVIDER_DEGRADED',
  ),
]);

export const GUIDED_PHASES = Object.freeze([
  'context',
  'risk',
  'policy',
  'deterioration',
  'safety',
  'outcome',
  'evidence',
  'closeout',
] as const);

export function createInitialDemoState(): DemoState {
  return Object.freeze({
    fixtureVersion: DEMO_FIXTURE_VERSION,
    scenarioId: 'protection-story',
    phase: 0,
    elapsedSeconds: 0,
    playing: false,
    outcome: 'NOT_STARTED',
  });
}

export function getDemoScenario(id: DemoScenarioId): DemoScenario {
  const scenario = DEMO_SCENARIOS.find((candidate) => candidate.id === id);
  if (!scenario) throw new TypeError('UNKNOWN_DEMO_SCENARIO');
  return scenario;
}

export function selectDemoScenario(id: DemoScenarioId): DemoState {
  const scenario = getDemoScenario(id);
  return Object.freeze({
    fixtureVersion: DEMO_FIXTURE_VERSION,
    scenarioId: scenario.id,
    phase: scenario.outcome === 'REFUSED' ? 4 : 0,
    elapsedSeconds: scenario.outcome === 'REFUSED' ? 48 : 0,
    playing: false,
    outcome: scenario.outcome === 'REFUSED' ? 'REFUSED' : 'NOT_STARTED',
  });
}

export function advanceGuidedDemo(state: DemoState): DemoState {
  const scenario = getDemoScenario(state.scenarioId);
  const phase = Math.min(state.phase + 1, GUIDED_PHASES.length - 1);
  const isComplete = phase === GUIDED_PHASES.length - 1;
  return Object.freeze({
    ...state,
    phase,
    elapsedSeconds: phase * GUIDED_DEMO_PHASE_SECONDS,
    playing: state.playing && !isComplete,
    outcome: isComplete ? scenario.outcome : state.outcome,
  });
}

export function startGuidedDemo(state: DemoState): DemoState {
  if (state.scenarioId !== 'protection-story') return state;
  if (state.phase >= GUIDED_PHASES.length - 1) return createInitialDemoStateWithPlayback();
  return Object.freeze({ ...state, playing: true });
}

function createInitialDemoStateWithPlayback(): DemoState {
  return Object.freeze({ ...createInitialDemoState(), playing: true });
}

export function resetGuidedDemo(): DemoState {
  return createInitialDemoState();
}

export type DemoAnalyticsEvent =
  | 'screen_viewed'
  | 'guided_demo_started'
  | 'guided_demo_phase'
  | 'demo_reset'
  | 'scenario_selected'
  | 'refusal_category';

/** Deliberately local/no-op: event names are allowlisted and no payload is accepted. */
export function recordDemoAnalytics(event: DemoAnalyticsEvent): void {
  switch (event) {
    case 'screen_viewed':
    case 'guided_demo_started':
    case 'guided_demo_phase':
    case 'demo_reset':
    case 'scenario_selected':
    case 'refusal_category':
      return;
    default:
      throw new Error('DEMO_ANALYTICS_EVENT_NOT_ALLOWLISTED');
  }
}
