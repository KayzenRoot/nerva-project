import { locales, type Locale } from './i18n.ts';

export function localizeRows<const Keys extends readonly string[]>(
  keys: Keys,
  rows: Readonly<Record<Locale, readonly string[]>>,
): Record<Locale, Readonly<Record<Keys[number], string>>> {
  const localized = Object.fromEntries(
    locales.map((locale) => {
      const values = rows[locale];
      if (values.length !== keys.length) {
        throw new RangeError(`LOCALIZED_ROW_LENGTH_MISMATCH:${locale}`);
      }
      return [locale, Object.fromEntries(keys.map((key, index) => [key, values[index]!]))] as const;
    }),
  );
  return localized as Record<Locale, Readonly<Record<Keys[number], string>>>;
}
