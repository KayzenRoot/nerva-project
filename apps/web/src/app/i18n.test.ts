import { describe, expect, it } from 'vitest';
import { messages, resolveLocale } from './i18n.ts';

describe('locale resolution', () => {
  it('defaults to English and accepts the supported locale aliases', () => {
    expect(resolveLocale(undefined)).toBe('en');
    expect(resolveLocale('unsupported')).toBe('en');
    expect(resolveLocale('pt')).toBe('pt-BR');
    expect(resolveLocale('pt-br')).toBe('pt-BR');
    expect(resolveLocale('ES')).toBe('es');
  });

  it('provides localized document metadata for each supported locale', () => {
    expect(messages.en.documentTitle).toContain('Safety');
    expect(messages['pt-BR'].documentTitle).toContain('segurança');
    expect(messages.es.documentTitle).toContain('seguridad');
  });
});
