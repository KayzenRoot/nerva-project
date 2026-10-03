import Link from 'next/link';
import { locales, type Locale } from './i18n.ts';

const copy = {
  en: {
    policies: 'Policy status',
    recorder: 'Execution and recovery record',
    readOnly: 'Read-only status · no financial execution',
    summary: 'Policy versions, deterministic decisions and durable refusal/recovery records.',
    unavailable: 'The database read model is unavailable.',
    empty: 'No records have been stored yet.',
    policiesSafety:
      'Only REDUCE_POSITION, CLOSE_POSITION and NO_ACTION are admitted. Mainnet effects are hard-blocked.',
    providerBlock:
      'Perpl currently documents only broad trade scope for writes. Protective-only testnet effects remain blocked.',
    policy: 'Policy',
    version: 'Version',
    environment: 'Environment',
    state: 'State',
    hash: 'Version hash',
    event: 'Event',
    reason: 'Reason',
    correlation: 'Correlation',
    time: 'Time',
    health: 'Integration health',
    latestDecision: 'Latest decision',
    decisionReason: 'Decision reason',
    evaluations: 'Trigger evaluations',
    simulations: 'Simulation and preflight',
    outcome: 'Outcome',
    sourceSnapshot: 'Source snapshot',
    plan: 'Plan digest',
    authority: 'Authority',
  },
  'pt-BR': {
    policies: 'Estado das políticas',
    recorder: 'Registro de execução e recuperação',
    readOnly: 'Estado somente leitura · sem execução financeira',
    summary:
      'Versões de políticas, decisões determinísticas e registros duráveis de recusa/recuperação.',
    unavailable: 'A consulta ao banco de dados está indisponível.',
    empty: 'Ainda não há registros armazenados.',
    policiesSafety:
      'Somente REDUCE_POSITION, CLOSE_POSITION e NO_ACTION são aceitos. Efeitos em mainnet são bloqueados.',
    providerBlock:
      'A Perpl documenta atualmente apenas o escopo amplo trade para escrita. Efeitos testnet somente protetivos continuam bloqueados.',
    policy: 'Política',
    version: 'Versão',
    environment: 'Ambiente',
    state: 'Estado',
    hash: 'Hash da versão',
    event: 'Evento',
    reason: 'Motivo',
    correlation: 'Correlação',
    time: 'Horário',
    health: 'Saúde da integração',
    latestDecision: 'Decisão mais recente',
    decisionReason: 'Motivo da decisão',
    evaluations: 'Avaliações de gatilho',
    simulations: 'Simulação e preflight',
    outcome: 'Resultado',
    sourceSnapshot: 'Snapshot de origem',
    plan: 'Digest do plano',
    authority: 'Autoridade',
  },
  es: {
    policies: 'Estado de políticas',
    recorder: 'Registro de ejecución y recuperación',
    readOnly: 'Estado de solo lectura · sin ejecución financiera',
    summary:
      'Versiones de políticas, decisiones deterministas y registros duraderos de rechazo/recuperación.',
    unavailable: 'La consulta a la base de datos no está disponible.',
    empty: 'Todavía no hay registros almacenados.',
    policiesSafety:
      'Solo se admiten REDUCE_POSITION, CLOSE_POSITION y NO_ACTION. Los efectos en mainnet están bloqueados.',
    providerBlock:
      'Perpl actualmente documenta solo el alcance amplio trade para escrituras. Los efectos testnet exclusivamente protectores siguen bloqueados.',
    policy: 'Política',
    version: 'Versión',
    environment: 'Entorno',
    state: 'Estado',
    hash: 'Hash de versión',
    event: 'Evento',
    reason: 'Motivo',
    correlation: 'Correlación',
    time: 'Hora',
    health: 'Salud de integración',
    latestDecision: 'Decisión más reciente',
    decisionReason: 'Motivo de la decisión',
    evaluations: 'Evaluaciones de activación',
    simulations: 'Simulación y preflight',
    outcome: 'Resultado',
    sourceSnapshot: 'Snapshot de origen',
    plan: 'Digest del plan',
    authority: 'Autoridad',
  },
} as const;

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
  available,
}: {
  readonly locale: Locale;
  readonly view: 'policies' | 'recorder';
  readonly records: readonly Record<string, unknown>[];
  readonly evaluations?: readonly Record<string, unknown>[];
  readonly simulations?: readonly Record<string, unknown>[];
  readonly integrations?: readonly Record<string, unknown>[];
  readonly available: boolean;
}) {
  const labels = copy[locale];
  const title = view === 'policies' ? labels.policies : labels.recorder;
  const hasRecords =
    records.length + evaluations.length + simulations.length + integrations.length > 0;
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
        </>
      )}
    </main>
  );
}
