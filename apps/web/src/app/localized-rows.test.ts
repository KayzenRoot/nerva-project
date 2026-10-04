import { describe, expect, it } from 'vitest';
import { demoCopy, phaseLabels, scenarioNames, scenarioReasons } from './demo/demo-copy.ts';
import { localizeRows } from './localized-rows.ts';

describe('localizeRows', () => {
  it('maps each locale tuple to the same named fields', () => {
    const copy = localizeRows(['title', 'status'] as const, {
      en: ['Risk', 'Fresh'],
      'pt-BR': ['Risco', 'Atual'],
      es: ['Riesgo', 'Actual'],
    });
    expect(copy['pt-BR']).toEqual({ title: 'Risco', status: 'Atual' });
    expect(copy.es).toEqual({ title: 'Riesgo', status: 'Actual' });
  });

  it('rejects a locale tuple with missing fields', () => {
    expect(() =>
      localizeRows(['title', 'status'] as const, {
        en: ['Risk', 'Fresh'],
        'pt-BR': ['Risco'],
        es: ['Riesgo', 'Actual'],
      }),
    ).toThrow('LOCALIZED_ROW_LENGTH_MISMATCH:pt-BR');
  });

  it('provides complete localized demo labels, phases and refusal reasons', () => {
    for (const locale of ['en', 'pt-BR', 'es'] as const) {
      expect(demoCopy[locale].scenarioRefused.length).toBeGreaterThan(0);
      expect(demoCopy[locale].policyFinePrint.length).toBeGreaterThan(0);
      expect(Object.keys(phaseLabels[locale])).toHaveLength(8);
      expect(Object.keys(scenarioNames[locale])).toHaveLength(5);
      expect(Object.keys(scenarioReasons[locale])).toHaveLength(4);
    }
  });
});
