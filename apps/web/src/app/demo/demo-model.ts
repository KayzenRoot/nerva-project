export const DEMO_FIXTURE_VERSION = 'nerva-m05-demo-v1' as const;
export const GUIDED_DEMO_DURATION_SECONDS = 90 as const;

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
  { key: 'context', startSeconds: 0, endSeconds: 10 },
  { key: 'risk', startSeconds: 10, endSeconds: 25 },
  { key: 'policy', startSeconds: 25, endSeconds: 40 },
  { key: 'deterioration', startSeconds: 40, endSeconds: 55 },
  { key: 'safety', startSeconds: 55, endSeconds: 70 },
  { key: 'outcome', startSeconds: 70, endSeconds: 82 },
  { key: 'closeout', startSeconds: 82, endSeconds: 90 },
] as const);

export type GuidedPhaseKey = (typeof GUIDED_PHASES)[number]['key'];

function phaseIndexAt(elapsedSeconds: number): number {
  const index = GUIDED_PHASES.findIndex(({ endSeconds }) => elapsedSeconds < endSeconds);
  return index === -1 ? GUIDED_PHASES.length - 1 : index;
}

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
    elapsedSeconds: scenario.outcome === 'REFUSED' ? 55 : 0,
    playing: false,
    outcome: scenario.outcome === 'REFUSED' ? 'REFUSED' : 'NOT_STARTED',
  });
}

export function advanceGuidedDemo(state: DemoState, seconds = 1): DemoState {
  const scenario = getDemoScenario(state.scenarioId);
  const elapsedSeconds = Math.min(
    GUIDED_DEMO_DURATION_SECONDS,
    state.elapsedSeconds + Math.max(0, Math.trunc(seconds)),
  );
  const phase = phaseIndexAt(elapsedSeconds);
  const isComplete = elapsedSeconds === GUIDED_DEMO_DURATION_SECONDS;
  return Object.freeze({
    ...state,
    phase,
    elapsedSeconds,
    playing: state.playing && !isComplete,
    outcome: elapsedSeconds >= 70 ? scenario.outcome : state.outcome,
  });
}

export function startGuidedDemo(state: DemoState): DemoState {
  if (state.scenarioId !== 'protection-story') return state;
  if (state.elapsedSeconds >= GUIDED_DEMO_DURATION_SECONDS)
    return createInitialDemoStateWithPlayback();
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
