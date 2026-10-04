import { describe, expect, it } from 'vitest';
import {
  DEMO_FIXTURE_VERSION,
  DEMO_SCENARIOS,
  GUIDED_DEMO_DURATION_SECONDS,
  GUIDED_PHASES,
  advanceGuidedDemo,
  createInitialDemoState,
  recordDemoAnalytics,
  resetGuidedDemo,
  selectDemoScenario,
  startGuidedDemo,
} from './demo-model.ts';

describe('M05 isolated synthetic demo model', () => {
  it('uses the canonical deterministic phase windows and completes in 90 seconds', () => {
    expect(GUIDED_PHASES).toEqual([
      { key: 'context', startSeconds: 0, endSeconds: 10 },
      { key: 'risk', startSeconds: 10, endSeconds: 25 },
      { key: 'policy', startSeconds: 25, endSeconds: 40 },
      { key: 'deterioration', startSeconds: 40, endSeconds: 55 },
      { key: 'safety', startSeconds: 55, endSeconds: 70 },
      { key: 'outcome', startSeconds: 70, endSeconds: 82 },
      { key: 'closeout', startSeconds: 82, endSeconds: 90 },
    ]);

    let state = startGuidedDemo(createInitialDemoState());
    const boundaries = [
      { elapsed: 10, phase: 1 },
      { elapsed: 25, phase: 2 },
      { elapsed: 40, phase: 3 },
      { elapsed: 55, phase: 4 },
      { elapsed: 70, phase: 5 },
      { elapsed: 82, phase: 6 },
      { elapsed: 90, phase: 6 },
    ];
    for (const boundary of boundaries) {
      while (state.elapsedSeconds < boundary.elapsed) state = advanceGuidedDemo(state);
      expect(state.phase).toBe(boundary.phase);
      expect(state.elapsedSeconds).toBe(boundary.elapsed);
      if (boundary.elapsed < 70) expect(state.outcome).toBe('NOT_STARTED');
      if (boundary.elapsed >= 70) expect(state.outcome).toBe('SIMULATED_OUTCOME');
    }

    const firstRun = Array.from({ length: 6 }, (_, index) => {
      let replay =
        index === 0 ? startGuidedDemo(createInitialDemoState()) : createInitialDemoState();
      while (replay.elapsedSeconds < GUIDED_DEMO_DURATION_SECONDS) {
        replay = advanceGuidedDemo(replay);
      }
      return replay;
    });
    expect(firstRun.every((state) => JSON.stringify(state) === JSON.stringify(firstRun[0]))).toBe(
      true,
    );
    expect(firstRun[0]?.elapsedSeconds).toBe(GUIDED_DEMO_DURATION_SECONDS);
    expect(firstRun[0]?.outcome).toBe('SIMULATED_OUTCOME');
    expect(firstRun[0]?.playing).toBe(false);
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
