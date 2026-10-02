import pg from 'pg';

const expectedTables = [
  'audit_events',
  'integration_health_samples',
  'market_snapshots',
  'policies',
  'policy_versions',
  'portfolio_snapshots',
  'position_snapshots',
  'provider_checkpoints',
  'risk_metrics',
  'risk_snapshots',
  'runtime_controls',
].sort();
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
try {
  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '__drizzle_migrations' ORDER BY table_name",
  );
  const names = tables.rows.map((row) => row.table_name);
  if (JSON.stringify(names) !== JSON.stringify(expectedTables))
    throw new Error(`Unexpected M01/M02 table set: ${names.join(',')}`);
  const triggers = await pool.query(
    'SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname',
  );
  const triggerNames = triggers.rows.map((row) => row.tgname);
  for (const required of [
    'policy_versions_immutable',
    'audit_events_append_only',
    'runtime_controls_audit',
    'market_snapshots_append_only',
    'position_snapshots_append_only',
    'portfolio_snapshots_append_only',
    'risk_snapshots_append_only',
    'risk_metrics_append_only',
  ]) {
    if (!triggerNames.includes(required)) throw new Error(`Missing integrity trigger ${required}`);
  }
  const forbiddenColumns = await pool.query(
    "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND column_name ~* '(api.?key|secret|signature|private|mnemonic|seed)' ORDER BY table_name,column_name",
  );
  if (forbiddenColumns.rows.length > 0)
    throw new Error('Credential-shaped database columns are forbidden');
  const writeTables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name ~* '(order|execution|wallet_key)'",
  );
  if (writeTables.rows.length > 0)
    throw new Error(
      `M02 write-path tables are forbidden: ${writeTables.rows.map((row) => row.table_name).join(',')}`,
    );
  const control = await pool.query(
    "SELECT enabled, reason FROM runtime_controls WHERE control_key = 'GLOBAL_EXECUTION_DISABLED'",
  );
  if (control.rows.length !== 1 || control.rows[0].enabled !== true)
    throw new Error('Global execution control is missing or not disabled by default');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "INSERT INTO policies (policy_id, environment, state) VALUES ('m01-integrity-probe', 'LOCAL', 'DRAFT')",
    );
    await client.query(
      "INSERT INTO policy_versions (policy_version_id, policy_id, version, payload, content_hash) VALUES ('m01-integrity-probe-v1', 'm01-integrity-probe', 1, '{}'::jsonb, $1)",
      ['a'.repeat(64)],
    );
    await client.query('SAVEPOINT policy_version_check');
    let policyVersionImmutable = false;
    try {
      await client.query(
        "UPDATE policy_versions SET payload = '{\"changed\":true}'::jsonb WHERE policy_version_id = 'm01-integrity-probe-v1'",
      );
    } catch {
      policyVersionImmutable = true;
    }
    if (!policyVersionImmutable)
      throw new Error('Immutable policy-version trigger did not reject mutation');
    await client.query('ROLLBACK TO SAVEPOINT policy_version_check');
    await client.query('SAVEPOINT unique_policy_version_check');
    let duplicateIdentityRejected = false;
    try {
      await client.query(
        "INSERT INTO policy_versions (policy_version_id, policy_id, version, payload, content_hash) VALUES ('m01-integrity-probe-v1-duplicate', 'm01-integrity-probe', 1, '{}'::jsonb, $1)",
        ['b'.repeat(64)],
      );
    } catch {
      duplicateIdentityRejected = true;
    }
    if (!duplicateIdentityRejected)
      throw new Error('Policy-version identity uniqueness is not enforced');
    await client.query('ROLLBACK TO SAVEPOINT unique_policy_version_check');
    await client.query(
      "INSERT INTO audit_events (event_id, event_type, actor, reason, correlation_id, payload) VALUES ('m01-integrity-probe', 'INTEGRITY_PROBE', 'test', 'rollback probe', 'm01-integrity-probe', '{}'::jsonb)",
    );
    await client.query('SAVEPOINT append_only_check');
    let immutable = false;
    try {
      await client.query(
        "UPDATE audit_events SET reason = 'changed' WHERE event_id = 'm01-integrity-probe'",
      );
    } catch {
      immutable = true;
    }
    if (!immutable) throw new Error('Append-only audit trigger did not reject mutation');
    await client.query('ROLLBACK TO SAVEPOINT append_only_check');
    await client.query(
      "INSERT INTO risk_snapshots (snapshot_id,generated_at,quality,actionable,content_hash,correlation_id,source_snapshot_hashes,payload) VALUES ('m02-integrity-probe',now(),'FRESH',false,$1,'m02-integrity-probe',ARRAY[$1],'{\"schemaVersion\":\"0.1\"}'::jsonb)",
      ['c'.repeat(64)],
    );
    await client.query(
      "INSERT INTO risk_metrics (metric_id,snapshot_id,name,quality,observed_at,payload) VALUES ('m02-integrity-probe:0','m02-integrity-probe','LIQUIDATION_DISTANCE_BPS','UNKNOWN',now(),'{\"quality\":\"UNKNOWN\"}'::jsonb)",
    );
    await client.query('SAVEPOINT m02_append_only_check');
    let riskSnapshotImmutable = false;
    try {
      await client.query(
        "UPDATE risk_snapshots SET quality='FRESH' WHERE snapshot_id='m02-integrity-probe'",
      );
    } catch {
      riskSnapshotImmutable = true;
    }
    if (!riskSnapshotImmutable)
      throw new Error('Risk snapshot append-only trigger did not reject mutation');
    await client.query('ROLLBACK TO SAVEPOINT m02_append_only_check');
    await client.query('SAVEPOINT runtime_control_audit_check');
    await client.query(
      "UPDATE runtime_controls SET reason = reason, actor = 'm01-integrity-probe', source = 'test', correlation_id = 'm01-integrity-probe' WHERE control_key = 'GLOBAL_EXECUTION_DISABLED'",
    );
    const controlAudit = await client.query(
      "SELECT event_id FROM audit_events WHERE event_type = 'RUNTIME_CONTROL_CHANGED' AND correlation_id = 'm01-integrity-probe'",
    );
    if (controlAudit.rows.length !== 1)
      throw new Error('Runtime-control updates did not append an audit event');
    await client.query('ROLLBACK TO SAVEPOINT runtime_control_audit_check');
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
  console.log(
    JSON.stringify({
      ok: true,
      tables: names,
      integrityTriggers: triggerNames,
      executionDisabledByDefault: true,
      policyVersionsImmutable: true,
      auditEventsAppendOnly: true,
      runtimeControlChangesAudited: true,
      m02EvidenceAppendOnly: true,
      credentialColumns: 0,
      writePathTables: 0,
    }),
  );
} finally {
  await pool.end();
}
