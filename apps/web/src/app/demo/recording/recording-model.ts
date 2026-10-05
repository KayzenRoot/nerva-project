import type { Locale } from '../../i18n.ts';
import { demoCopy } from '../demo-copy.ts';
import { DEMO_FIXTURE_VERSION, getDemoScenario } from '../demo-model.ts';

export type RecordingSurface = 'risk' | 'policy' | 'flight-recorder';

const stageLabels: Record<Locale, readonly string[]> = {
  en: [
    'Source',
    'Risk evidence',
    'Policy',
    'Trigger',
    'Plan / simulation',
    'Permission',
    'Decision / outcome',
  ],
  'pt-BR': [
    'Origem',
    'Evidência de risco',
    'Política',
    'Gatilho',
    'Plano / simulação',
    'Permissão',
    'Decisão / resultado',
  ],
  es: [
    'Fuente',
    'Evidencia de riesgo',
    'Política',
    'Disparador',
    'Plan / simulación',
    'Permiso',
    'Decisión / resultado',
  ],
};

export function createDemoRecordingFixture(locale: Locale) {
  const copy = demoCopy[locale];
  const scenario = getDemoScenario('protection-story');
  const risk = Object.freeze({
    snapshotId: 'DEMO-SNAPSHOT-01',
    fixtureVersion: DEMO_FIXTURE_VERSION,
    scenarioId: scenario.id,
    freshness: scenario.source,
    market: 'ETH-PERP',
    accountId: 'DEMO-ACCOUNT-01',
    positionId: 'DEMO-ETH-PERP-01',
    exposure: copy.exposureValue,
    triggerState: 'SYNTHETIC_THRESHOLD_CROSSED',
    unprovenMetrics: Object.freeze([
      'LIQUIDATION_DISTANCE · UNAVAILABLE_UNPROVEN',
      'MAINTENANCE_MARGIN · UNAVAILABLE_UNPROVEN',
      'FUNDING_DIRECTION · UNAVAILABLE_UNPROVEN',
    ]),
  });
  const policy = Object.freeze({
    trigger: copy.policyTrigger,
    action: 'REDUCE_POSITION' as const,
    maxActionFraction: copy.policyMaxFraction,
    maxNotional: copy.policyMaxNotional,
    maxSlippage: copy.policySlippage,
    marketPosition: copy.policyMarketPosition,
    cooldown: copy.policyCooldown,
    expiry: copy.policyExpiry,
    refusalBehavior: copy.policyRefusal,
    confirmation: copy.confirmationRepresentation,
  });
  const descriptions = [
    `${risk.snapshotId} · local fixture only; no provider is queried.`,
    `${risk.exposure} · synthetic risk values; no live account or position.`,
    `${policy.action} · display-only policy preview; not compiled or active.`,
    `${policy.trigger} · deterministic scenario state only.`,
    'DRY_RUN_ONLY · no provider request, transaction, receipt or financial effect.',
    'ACTIVE_SYNTHETIC · no cryptographic grant, stored approval or authority.',
    `${copy.outcome} ${copy.evidence}`,
  ];
  const lineage = stageLabels[locale].map((label, index) => ({
    key: ['source', 'risk', 'policy', 'trigger', 'simulation', 'permission', 'outcome'][index]!,
    label,
    status: [
      'OBSERVED · SYNTHETIC',
      'COMPUTED · SYNTHETIC',
      'DISPLAY ONLY · NO AUTHORITY',
      'CROSSED · FIXTURE ONLY',
      'DRY_RUN_ONLY',
      'ACTIVE_SYNTHETIC · NO GRANT',
      'SIMULATED OUTCOME · NOT PERSISTED',
    ][index]!,
    description: descriptions[index]!,
  }));

  return Object.freeze({
    mode: 'DEMO_ONLY' as const,
    label: 'DEMO_ONLY · SYNTHETIC DATA · NOT PERSISTED' as const,
    fixtureVersion: DEMO_FIXTURE_VERSION,
    scenario,
    risk,
    policy,
    lineage: Object.freeze(lineage),
    displaySpec: Object.freeze({
      kind: 'LOCAL_DEMO_DISPLAY_FIXTURE',
      fixtureVersion: DEMO_FIXTURE_VERSION,
      scenarioId: scenario.id,
      persistence: 'NOT_PERSISTED',
      authority: 'NONE',
      executionEnabled: false,
      risk: {
        snapshotId: risk.snapshotId,
        source: risk.freshness,
        market: risk.market,
        accountId: risk.accountId,
        positionId: risk.positionId,
        exposure: risk.exposure,
        unprovenMetrics: risk.unprovenMetrics,
      },
      policyPreview: {
        trigger: policy.trigger,
        action: policy.action,
        maxActionFraction: policy.maxActionFraction,
        maxNotional: policy.maxNotional,
        maxSlippage: policy.maxSlippage,
        marketPosition: policy.marketPosition,
        cooldown: policy.cooldown,
        expiry: policy.expiry,
        refusalBehavior: policy.refusalBehavior,
        confirmation: policy.confirmation,
      },
    }),
  });
}
