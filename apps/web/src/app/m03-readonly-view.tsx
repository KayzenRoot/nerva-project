import Link from 'next/link';
import { locales, type Locale } from './i18n.ts';

const copyKeys = [
  'policies',
  'recorder',
  'readOnly',
  'summary',
  'unavailable',
  'empty',
  'policiesSafety',
  'providerBlock',
  'policy',
  'version',
  'environment',
  'state',
  'hash',
  'event',
  'reason',
  'correlation',
  'time',
  'health',
  'latestDecision',
  'decisionReason',
  'evaluations',
  'simulations',
  'outcome',
  'sourceSnapshot',
  'plan',
  'authority',
  'permissionEvidence',
  'permissionIntegrity',
] as const;

type Copy = Record<(typeof copyKeys)[number], string>;

const translations: Record<Locale, readonly string[]> = {
  en: [
    'Policy status',
    'Execution and recovery record',
    'Read-only status · no financial execution',
    'Policy versions, deterministic decisions and durable refusal/recovery records.',
    'The database read model is unavailable.',
    'No records have been stored yet.',
    'Only REDUCE_POSITION, CLOSE_POSITION and NO_ACTION are admitted. Mainnet effects are hard-blocked.',
    'Perpl currently documents only broad trade scope for writes. Protective-only testnet effects remain blocked.',
    'Policy',
    'Version',
    'Environment',
    'State',
    'Version hash',
    'Event',
    'Reason',
    'Correlation',
    'Time',
    'Integration health',
    'Latest decision',
    'Decision reason',
    'Trigger evaluations',
    'Simulation and preflight',
    'Outcome',
    'Source snapshot',
    'Plan digest',
    'Authority',
    'M04 permission evidence',
    'Permission chain integrity',
  ],
  'pt-BR': [
    'Estado das políticas',
    'Registro de execução e recuperação',
    'Estado somente leitura · sem execução financeira',
    'Versões de políticas, decisões determinísticas e registros duráveis de recusa/recuperação.',
    'A consulta ao banco de dados está indisponível.',
    'Ainda não há registros armazenados.',
    'Somente REDUCE_POSITION, CLOSE_POSITION e NO_ACTION são aceitos. Efeitos em mainnet são bloqueados.',
    'A Perpl documenta atualmente apenas o escopo amplo trade para escrita. Efeitos testnet somente protetivos continuam bloqueados.',
    'Política',
    'Versão',
    'Ambiente',
    'Estado',
    'Hash da versão',
    'Evento',
    'Motivo',
    'Correlação',
    'Horário',
    'Saúde da integração',
    'Decisão mais recente',
    'Motivo da decisão',
    'Avaliações de gatilho',
    'Simulação e preflight',
    'Resultado',
    'Snapshot de origem',
    'Digest do plano',
    'Autoridade',
    'Evidências de permissão M04',
    'Integridade da cadeia de permissões',
  ],
  es: [
    'Estado de políticas',
    'Registro de ejecución y recuperación',
    'Estado de solo lectura · sin ejecución financiera',
    'Versiones de políticas, decisiones determinísticas y registros duraderos de rechazo/recuperación.',
    'La consulta a la base de datos no está disponible.',
    'Todavía no hay registros almacenados.',
    'Solo se admiten REDUCE_POSITION, CLOSE_POSITION y NO_ACTION. Los efectos en mainnet están bloqueados.',
    'Perpl actualmente documenta solo el alcance amplio trade para escrituras. Los efectos testnet exclusivamente protectores siguen bloqueados.',
    'Política',
    'Versión',
    'Entorno',
    'Estado',
    'Hash de versión',
    'Evento',
    'Motivo',
    'Correlación',
    'Hora',
    'Salud de integración',
    'Decisión más reciente',
    'Motivo de la decisión',
    'Evaluaciones de activación',
    'Simulación y preflight',
    'Resultado',
    'Snapshot de origen',
    'Digest del plan',
    'Autoridad',
    'Evidencia de permisos M04',
    'Integridad de la cadena de permisos',
  ],
};

function localizedCopy(locale: Locale): Copy {
  const values = translations[locale];
  if (values.length !== copyKeys.length) throw new Error('M03 locale copy is incomplete');
  return Object.fromEntries(copyKeys.map((key, index) => [key, values[index]!])) as Copy;
}

const copy = Object.fromEntries(locales.map((locale) => [locale, localizedCopy(locale)])) as Record<
  Locale,
  Copy
>;

function field(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : 'UNKNOWN';
}

interface DisplayField {
  readonly label: string;
  readonly key: string;
  readonly code?: boolean;
  readonly appendKey?: string;
}

function RecordEntries({
  records,
  keyFields,
  fields,
}: {
  readonly records: readonly Record<string, unknown>[];
  readonly keyFields: readonly string[];
  readonly fields: readonly DisplayField[];
}) {
  return records.map((record, index) => (
    <article
      className="dashboard-card"
      key={`${keyFields.map((key) => field(record, key)).join('-')}-${index}`}
    >
      <dl className="metric-list">
        {fields.map((item) => {
          const value = item.appendKey
            ? `${field(record, item.key)} · ${field(record, item.appendKey)}`
            : field(record, item.key);
          return (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.code ? <code>{value}</code> : value}</dd>
            </div>
          );
        })}
      </dl>
    </article>
  ));
}

export function M03ReadOnlyView({
  locale,
  view,
  records,
  evaluations = [],
  simulations = [],
  integrations = [],
  permissionEvents = [],
  permissionEvidenceIntegrity = 'UNKNOWN',
  available,
}: {
  readonly locale: Locale;
  readonly view: 'policies' | 'recorder';
  readonly records: readonly Record<string, unknown>[];
  readonly evaluations?: readonly Record<string, unknown>[];
  readonly simulations?: readonly Record<string, unknown>[];
  readonly integrations?: readonly Record<string, unknown>[];
  readonly permissionEvents?: readonly Record<string, unknown>[];
  readonly permissionEvidenceIntegrity?: 'VERIFIED' | 'FAILED' | 'UNKNOWN';
  readonly available: boolean;
}) {
  const labels = copy[locale];
  const title = view === 'policies' ? labels.policies : labels.recorder;
  const hasRecords =
    records.length +
      evaluations.length +
      simulations.length +
      integrations.length +
      permissionEvents.length >
    0;
  return (
    <main className="dashboard-shell" lang={locale}>
      <header className="dashboard-topbar">
        <Link className="brand" href={`/?lang=${locale}`} aria-label="NERVA">
          NERVA
        </Link>
        <nav className="language-switcher" aria-label="Language">
          {locales.map((option) => (
            <Link
              key={option}
              href={`/${view === 'policies' ? 'policies' : 'flight-recorder'}?lang=${option}`}
              aria-current={locale === option ? 'page' : undefined}
            >
              {option === 'en' ? 'EN' : option === 'pt-BR' ? 'PT' : 'ES'}
            </Link>
          ))}
        </nav>
      </header>
      <section className="dashboard-heading">
        <p className="eyebrow">NERVA · M03</p>
        <h1>{title}</h1>
        <p>{labels.summary}</p>
        <div className="readonly-badge">{labels.readOnly}</div>
      </section>
      {!available ? (
        <section className="dashboard-card">
          <p>{labels.unavailable}</p>
        </section>
      ) : null}
      {available && !hasRecords ? (
        <section className="dashboard-card">
          <p>{labels.empty}</p>
        </section>
      ) : null}
      {view === 'policies' ? (
        <section className="dashboard-card market-card">
          <h2>{labels.policiesSafety}</h2>
          <p>{labels.providerBlock}</p>
          <RecordEntries
            records={records}
            keyFields={['policy_id', 'version']}
            fields={[
              { label: labels.policy, key: 'policy_id' },
              { label: labels.version, key: 'version' },
              { label: labels.environment, key: 'environment' },
              { label: labels.state, key: 'state' },
              { label: labels.hash, key: 'content_hash', code: true },
              { label: labels.latestDecision, key: 'latest_evaluation' },
              { label: labels.decisionReason, key: 'latest_evaluation_reason' },
            ]}
          />
        </section>
      ) : (
        <>
          <section className="dashboard-card market-card">
            <h2>{labels.evaluations}</h2>
            <RecordEntries
              records={evaluations}
              keyFields={['evaluation_id']}
              fields={[
                { label: labels.outcome, key: 'result' },
                { label: labels.reason, key: 'reason' },
                { label: labels.sourceSnapshot, key: 'snapshot_hash', code: true },
                { label: labels.correlation, key: 'correlation_id', code: true },
                { label: labels.time, key: 'evaluated_at' },
              ]}
            />
          </section>
          <section className="dashboard-card market-card">
            <h2>{labels.simulations}</h2>
            <RecordEntries
              records={simulations}
              keyFields={['simulation_id']}
              fields={[
                { label: labels.outcome, key: 'status' },
                { label: labels.authority, key: 'authority' },
                { label: labels.plan, key: 'plan_digest', code: true },
                { label: labels.reason, key: 'kind', appendKey: 'simulator_version' },
                { label: labels.time, key: 'checked_at' },
              ]}
            />
          </section>
          <section className="dashboard-card market-card">
            <h2>{labels.providerBlock}</h2>
            <RecordEntries
              records={records}
              keyFields={['event_id']}
              fields={[
                { label: labels.event, key: 'state' },
                { label: labels.reason, key: 'reason' },
                { label: labels.correlation, key: 'correlation_id', code: true },
                { label: labels.time, key: 'occurred_at' },
              ]}
            />
          </section>
          <section className="dashboard-card market-card">
            <h2>{labels.health}</h2>
            {integrations.map((record, index) => (
              <p key={`${field(record, 'integration')}-${index}`}>
                {field(record, 'integration')} · {field(record, 'status')} ·{' '}
                {field(record, 'reason')}
              </p>
            ))}
          </section>
          <section className="dashboard-card market-card">
            <h2>{labels.permissionEvidence}</h2>
            <p>
              {labels.permissionIntegrity}: {permissionEvidenceIntegrity}
            </p>
            <RecordEntries
              records={permissionEvents}
              keyFields={['sequence']}
              fields={[
                { label: labels.event, key: 'kind' },
                { label: labels.outcome, key: 'result' },
                { label: labels.reason, key: 'reason_code' },
                { label: labels.plan, key: 'subject_ref_hash', code: true },
                { label: labels.correlation, key: 'correlation_id', code: true },
                { label: labels.time, key: 'occurred_at' },
                { label: labels.hash, key: 'entry_hash', code: true },
              ]}
            />
          </section>
        </>
      )}
    </main>
  );
}
