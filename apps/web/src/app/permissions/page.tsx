import { resolveLocale } from '../i18n.ts';
import PermissionsReadView from './permissions-read-view.tsx';

export const dynamic = 'force-dynamic';

export default async function PermissionsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    readonly lang?: string | string[];
    readonly accountId?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <PermissionsReadView
      locale={resolveLocale(params.lang)}
      initialAccountId={params.accountId ?? ''}
    />
  );
}
