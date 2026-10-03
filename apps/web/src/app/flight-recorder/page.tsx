import {
  createDatabase,
  latestIntegrationHealth,
  listM03EvaluationReadModels,
  listM03SimulationReadModels,
  readM03ExecutionReadModel,
  listM04PermissionEvidence,
  verifyM04PermissionEvidence,
} from '@nerva/db';
import { loadServerConfig } from '@nerva/config';
import { resolveLocale } from '../i18n.ts';
import { M03ReadOnlyView } from '../m03-readonly-view.tsx';

export const dynamic = 'force-dynamic';

function records(values: readonly unknown[]): readonly Record<string, unknown>[] {
  return values.filter(
    (value): value is Record<string, unknown> =>
      value !== null && typeof value === 'object' && !Array.isArray(value),
  );
}

export default async function FlightRecorderPage({
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
        view="recorder"
        records={[]}
        evaluations={[]}
        simulations={[]}
        integrations={[]}
        available={false}
      />
    );
  const { pool } = createDatabase(config);
  try {
    const [events, evaluations, simulations, integrations, permissionEvents, permissionIntegrity] =
      await Promise.all([
        readM03ExecutionReadModel(pool),
        listM03EvaluationReadModels(pool),
        listM03SimulationReadModels(pool),
        latestIntegrationHealth(pool),
        listM04PermissionEvidence(pool),
        verifyM04PermissionEvidence(pool),
      ]);
    return (
      <M03ReadOnlyView
        locale={locale}
        view="recorder"
        records={records(events)}
        evaluations={records(evaluations)}
        simulations={records(simulations)}
        integrations={records(integrations)}
        permissionEvents={records(permissionEvents)}
        permissionEvidenceIntegrity={permissionIntegrity.verified ? 'VERIFIED' : 'FAILED'}
        available
      />
    );
  } catch {
    return (
      <M03ReadOnlyView
        locale={locale}
        view="recorder"
        records={[]}
        evaluations={[]}
        simulations={[]}
        integrations={[]}
        permissionEvents={[]}
        permissionEvidenceIntegrity="UNKNOWN"
        available={false}
      />
    );
  } finally {
    await pool.end();
  }
}
