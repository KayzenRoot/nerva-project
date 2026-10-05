import { describe, expect, it } from 'vitest';
import { demoCopy } from '../demo-copy.ts';
import { DEMO_FIXTURE_VERSION } from '../demo-model.ts';
import { createDemoRecordingFixture } from './recording-model.ts';

describe('DEMO_ONLY video recording fixture', () => {
  it('reuses the accepted M05 scenario and remains local, synthetic and non-persisted', () => {
    const fixture = createDemoRecordingFixture('en');

    expect(fixture.fixtureVersion).toBe(DEMO_FIXTURE_VERSION);
    expect(fixture.scenario.id).toBe('protection-story');
    expect(fixture.risk.snapshotId).toBe('DEMO-SNAPSHOT-01');
    expect(fixture.risk.accountId).toBe('DEMO-ACCOUNT-01');
    expect(fixture.risk.positionId).toBe('DEMO-ETH-PERP-01');
    expect(fixture.label).toBe('DEMO_ONLY · SYNTHETIC DATA · NOT PERSISTED');
    expect(fixture.displaySpec.persistence).toBe('NOT_PERSISTED');
    expect(fixture.displaySpec.authority).toBe('NONE');
    expect(fixture.displaySpec.executionEnabled).toBe(false);
    expect(JSON.stringify(fixture.displaySpec)).not.toMatch(/private.?key|seed.?phrase|mnemonic/i);
  });

  it('keeps the policy summary values aligned with the accepted Guided Demo copy', () => {
    for (const locale of ['en', 'pt-BR', 'es'] as const) {
      const fixture = createDemoRecordingFixture(locale);
      const copy = demoCopy[locale];

      expect(fixture.policy.trigger).toBe(copy.policyTrigger);
      expect(fixture.policy.action).toBe('REDUCE_POSITION');
      expect(fixture.policy.maxActionFraction).toBe(copy.policyMaxFraction);
      expect(fixture.policy.maxNotional).toBe(copy.policyMaxNotional);
      expect(fixture.policy.maxSlippage).toBe(copy.policySlippage);
      expect(fixture.policy.marketPosition).toBe(copy.policyMarketPosition);
      expect(fixture.policy.cooldown).toBe(copy.policyCooldown);
      expect(fixture.policy.expiry).toBe(copy.policyExpiry);
      expect(fixture.policy.refusalBehavior).toBe(copy.policyRefusal);
      expect(fixture.policy.confirmation).toBe(copy.confirmationRepresentation);
    }
  });

  it('keeps all unproven metrics non-authoritative and records a seven-stage synthetic trace', () => {
    const fixture = createDemoRecordingFixture('en');

    expect(fixture.risk.unprovenMetrics).toEqual([
      'LIQUIDATION_DISTANCE · UNAVAILABLE_UNPROVEN',
      'MAINTENANCE_MARGIN · UNAVAILABLE_UNPROVEN',
      'FUNDING_DIRECTION · UNAVAILABLE_UNPROVEN',
    ]);
    expect(fixture.lineage).toHaveLength(7);
    expect(fixture.lineage[4]?.status).toBe('DRY_RUN_ONLY');
    expect(fixture.lineage[5]?.status).toContain('NO GRANT');
    expect(fixture.lineage[6]?.status).toContain('NOT PERSISTED');
  });
});
