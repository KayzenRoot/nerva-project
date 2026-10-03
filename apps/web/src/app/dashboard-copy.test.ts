import { describe, expect, it } from 'vitest';
import { dashboardCopy } from './dashboard-copy.js';
import { resolveLocale } from './i18n.js';

describe('M02 dashboard language defaults', () => {
  it('uses English by default and carries matching Brazilian Portuguese and Spanish copy', () => {
    expect(dashboardCopy[resolveLocale(undefined)].title).toBe('Risk and market observation');
    expect(dashboardCopy['pt-BR'].title).toBe('Observação de risco e mercado');
    expect(dashboardCopy.es.title).toBe('Observación de riesgo y mercado');
  });
});
