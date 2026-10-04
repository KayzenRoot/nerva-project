import { localizeRows } from './localized-rows.ts';

const keys = [
  'startDemo',
  'visualLabel',
  'observedRisk',
  'freshness',
  'proofRiskHeading',
  'proofRisk',
  'proofAuthorityHeading',
  'proofAuthority',
  'proofEvidenceHeading',
  'proofEvidence',
] as const;

export const homeCopy = localizeRows(keys, {
  en: [
    'Start guided demo',
    'Synthetic risk flow visualization',
    'RISK · OBSERVED',
    'FRESHNESS',
    'Deterministic risk',
    'Source, freshness and limits in view.',
    'Bounded authority',
    'Verifiable, revocable permissions.',
    'Verifiable evidence',
    'Every decision keeps its context.',
  ],
  'pt-BR': [
    'Iniciar demo guiada',
    'Visualização sintética de fluxo de risco',
    'RISCO · OBSERVADO',
    'ATUALIDADE',
    'Risco determinístico',
    'Fonte, atualidade e limites visíveis.',
    'Autoridade limitada',
    'Permissões verificáveis e revogáveis.',
    'Trilha verificável',
    'Cada decisão tem contexto rastreável.',
  ],
  es: [
    'Iniciar demo guiada',
    'Visualización sintética de flujo de riesgo',
    'RIESGO · OBSERVADO',
    'VIGENCIA',
    'Riesgo determinista',
    'Origen, vigencia y límites visibles.',
    'Autoridad acotada',
    'Permisos verificables y revocables.',
    'Evidencia verificable',
    'Cada decisión conserva contexto.',
  ],
});
