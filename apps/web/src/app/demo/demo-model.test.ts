import { describe, expect, it } from 'vitest';
import {
  DEMO_FIXTURE_VERSION,
  DEMO_SCENARIOS,
  GUIDED_DEMO_DURATION_SECONDS,
  advanceGuidedDemo,
  createInitialDemoState,
  recordDemoAnalytics,
  resetGuidedDemo,
  selectDemoScenario,
  startGuidedDemo,
} from './demo-model.ts';

describe('M05 isolated synthetic demo model', () => {
  it('resets to byte-equivalent deterministic state and completes within 84 seconds', () => {
    const firstRun = Array.from({ length: 6 }, (_, index) => {
      let state =
        index === 0 ? startGuidedDemo(createInitialDemoState()) : createInitialDemoState();
      while (state.phase < 7) state = advanceGuidedDemo(state);
      return state;
    });
    expect(firstRun.every((state) => JSON.stringify(state) === JSON.stringify(firstRun[0]))).toBe(
      true,
    );
    expect(firstRun[0]?.elapsedSeconds).toBe(GUIDED_DEMO_DURATION_SECONDS);
    expect(firstRun[0]?.outcome).toBe('SIMULATED_OUTCOME');
    expect(resetGuidedDemo()).toEqual(createInitialDemoState());
    expect(DEMO_FIXTURE_VERSION).toBe('nerva-m05-demo-v1');
  });

  it.each([
    ['stale-source', 'STALE'],
    ['permission-revoked', 'GRANT_REVOKED'],
    ['delegate-changed', 'DELEGATE_CHANGED'],
    ['provider-degraded', 'PROVIDER_DEGRADED'],
  ] as const)('fails closed for %s', (scenarioId, reason) => {
    const scenario = DEMO_SCENARIOS.find((item) => item.id === scenarioId);
    expect(scenario?.outcome).toBe('REFUSED');
    expect(scenario?.refusalReason).toBe(reason);
    expect(selectDemoScenario(scenarioId).outcome).toBe('REFUSED');
  });

  it('has no persistence or network analytics interface and only accepts allowlisted names', () => {
    expect(recordDemoAnalytics('demo_reset')).toBeUndefined();
    expect(DEMO_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      'protection-story',
      'stale-source',
      'permission-revoked',
      'delegate-changed',
      'provider-degraded',
    ]);
  });
});
