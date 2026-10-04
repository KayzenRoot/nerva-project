import { describe, expect, it } from 'vitest';
import { dashboardCopy } from './dashboard-copy.ts';
import { demoCopy, phaseLabels, scenarioNames, scenarioReasons } from './demo/demo-copy.ts';
import { homeCopy } from './home-copy.ts';

describe('localized M05 product copy', () => {
  it('provides complete English, Portuguese and Spanish views', () => {
    for (const locale of ['en', 'pt-BR', 'es'] as const) {
      expect(homeCopy[locale].startDemo.length).toBeGreaterThan(0);
      expect(dashboardCopy[locale].title.length).toBeGreaterThan(0);
      expect(demoCopy[locale].scenarioRefused.length).toBeGreaterThan(0);
      expect(demoCopy[locale].policyFinePrint.length).toBeGreaterThan(0);
      expect(demoCopy[locale].policyMaxNotional.length).toBeGreaterThan(0);
      expect(demoCopy[locale].confirmationRepresentation.length).toBeGreaterThan(0);
      expect(demoCopy[locale].closeoutLineage.length).toBeGreaterThan(0);
      expect(demoCopy[locale].closeout.length).toBeGreaterThan(0);
      expect(Object.keys(phaseLabels[locale])).toHaveLength(7);
      expect(Object.keys(scenarioNames[locale])).toHaveLength(5);
      expect(Object.keys(scenarioReasons[locale])).toHaveLength(4);
      expect(Object.keys(dashboardCopy[locale].status)).toHaveLength(8);
    }
  });
});
