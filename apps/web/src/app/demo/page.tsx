import { resolveLocale } from '../i18n.ts';
import { DemoView } from './demo-view.tsx';

export const dynamic = 'force-dynamic';

export default async function DemoPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly lang?: string | string[] }>;
}) {
  const locale = resolveLocale((await searchParams).lang);
  return <DemoView locale={locale} />;
}
