import { describe, expect, it } from 'vitest';
import { M05_POLICY_TEMPLATES } from './policy-templates.ts';

describe('M05 policy templates', () => {
  it('stay within admitted actions, scope and fail-closed behavior', () => {
    expect(M05_POLICY_TEMPLATES.boundedReduce.actionIntent).toEqual({
      family: 'REDUCE_POSITION',
      maxActionFractionBps: 1000,
    });
    expect(M05_POLICY_TEMPLATES.closeOnDrawdown.actionIntent.family).toBe('CLOSE_POSITION');
    for (const policy of Object.values(M05_POLICY_TEMPLATES)) {
      expect(policy.scope.protocolCapability).toBe('perpl-protective-v0');
      expect(policy.constraints.fallbackAction).toBe('NO_ACTION');
      expect(policy.safetyBehavior).toBe('REFUSE');
      expect(policy.environment).not.toBe('MAINNET_EXECUTION');
    }
  });
});
