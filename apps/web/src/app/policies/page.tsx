import { PlaceholderScreen } from '../placeholder-screen.tsx';
import { resolveLocale } from '../i18n.ts';

export default async function PoliciesPlaceholder({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly lang?: string | string[] }>;
}) {
  const locale = resolveLocale((await searchParams).lang);
  return <PlaceholderScreen locale={locale} route="policies" title="policiesTitle" />;
}
