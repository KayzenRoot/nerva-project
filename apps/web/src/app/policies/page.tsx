import { createDatabase, listM03PolicyReadModels } from '@nerva/db';
import { loadServerConfig } from '@nerva/config';
import { resolveLocale } from '../i18n.ts';
import { M03ReadOnlyView } from '../m03-readonly-view.tsx';
import { PolicyWorkbench } from './policy-workbench.tsx';

export const dynamic = 'force-dynamic';

function records(values: readonly unknown[]): readonly Record<string, unknown>[] {
  return values.filter(
    (value): value is Record<string, unknown> =>
      value !== null && typeof value === 'object' && !Array.isArray(value),
  );
}

export default async function PoliciesPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly lang?: string | string[] }>;
}) {
  const locale = resolveLocale((await searchParams).lang);
  const config = loadServerConfig();
  if (!config.databaseUrl)
    return (
      <M03ReadOnlyView
        locale={locale}
        view="policies"
        records={[]}
        available={false}
        beforeContent={<PolicyWorkbench locale={locale} />}
      />
    );
  const { pool } = createDatabase(config);
  try {
    const values = await listM03PolicyReadModels(pool);
    return (
      <M03ReadOnlyView
        locale={locale}
        view="policies"
        records={records(values)}
        available
        beforeContent={<PolicyWorkbench locale={locale} />}
      />
    );
  } catch {
    return (
      <M03ReadOnlyView
        locale={locale}
        view="policies"
        records={[]}
        available={false}
        beforeContent={<PolicyWorkbench locale={locale} />}
      />
    );
  } finally {
    await pool.end();
  }
}
