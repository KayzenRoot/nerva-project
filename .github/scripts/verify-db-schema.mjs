import pg from 'pg';

const expectedTables = [
  'audit_events',
  'integration_health_samples',
  'market_snapshots',
  'm03_authorization_refs',
  'm03_execution_attempt_events',
  'm03_execution_idempotency',
  'm03_execution_plans',
  'm03_execution_receipts',
  'm03_nonce_ledger',
  'm03_policy_confirmations',
  'm03_policy_lifecycle_events',
  'm03_provider_enrollment_refs',
  'm03_simulation_results',
  'm03_trigger_evaluations',
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
    throw new Error(`Unexpected M01/M02/M03 table set: ${names.join(',')}`);
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
    'm03_policy_confirmations_append_only',
    'm03_policy_lifecycle_events_append_only',
    'm03_trigger_evaluations_append_only',
    'm03_execution_plans_append_only',
    'm03_simulation_results_append_only',
    'm03_authorization_refs_append_only',
    'm03_provider_enrollment_refs_append_only',
    'm03_nonce_ledger_append_only',
    'm03_execution_idempotency_append_only',
    'm03_execution_attempt_events_append_only',
    'm03_execution_receipts_append_only',
  ]) {
    if (!triggerNames.includes(required)) throw new Error(`Missing integrity trigger ${required}`);
  }
  const forbiddenColumns = await pool.query(
    "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND column_name ~* '(api.?key|secret|signature|private|mnemonic|seed)' ORDER BY table_name,column_name",
  );
  if (forbiddenColumns.rows.length > 0)
    throw new Error('Credential-shaped database columns are forbidden');
  const writeTables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name ~* '(order|execution|wallet_key)' AND table_name NOT LIKE 'm03_%'",
  );
  if (writeTables.rows.length > 0)
    throw new Error(
      `Unexpected non-M03 write-path tables: ${writeTables.rows.map((row) => row.table_name).join(',')}`,
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
    const m03Rows = [
      {
        table: 'm03_policy_confirmations',
        keyColumn: 'policy_version_id',
        key: 'm01-integrity-probe-v1',
        insert: `INSERT INTO m03_policy_confirmations (policy_version_id,canonical_hash,actor_ref,issuer_ref,proof_ref_hash,confirmed_at) VALUES ('m01-integrity-probe-v1',$1,'actor:test','issuer:test',$2,now())`,
        values: ['a'.repeat(64), 'd'.repeat(64)],
      },
      {
        table: 'm03_policy_lifecycle_events',
        keyColumn: 'event_id',
        key: 'm03-integrity-probe-lifecycle',
        insert: `INSERT INTO m03_policy_lifecycle_events (event_id,policy_version_id,event_type,actor_ref,issuer_ref,proof_ref_hash,correlation_id,occurred_at,payload) VALUES ('m03-integrity-probe-lifecycle','m01-integrity-probe-v1','CONFIRMED','actor:test','issuer:test',$1,'m03-integrity-probe',now(),'{}'::jsonb)`,
        values: ['d'.repeat(64)],
      },
      {
        table: 'm03_trigger_evaluations',
        keyColumn: 'evaluation_id',
        key: 'b'.repeat(64),
        insert: `INSERT INTO m03_trigger_evaluations (evaluation_id,policy_version_id,policy_version_hash,snapshot_id,snapshot_hash,result,reason,correlation_id,evaluated_at,payload) VALUES ($1,'m01-integrity-probe-v1',$2,'m02-integrity-probe',$3,'MATCH','integrity probe','m03-integrity-probe',now(),'{}'::jsonb)`,
        values: ['b'.repeat(64), 'a'.repeat(64), 'c'.repeat(64)],
      },
      {
        table: 'm03_execution_plans',
        keyColumn: 'plan_id',
        key: 'm03-integrity-probe-plan',
        insert: `INSERT INTO m03_execution_plans (plan_id,digest,idempotency_key,policy_version_id,policy_version_hash,snapshot_id,snapshot_hash,account_id,position_id,market_selector,action,quantity_scaled,notional_micros,slippage_bps,environment,network,chain_id,created_at,expires_at,correlation_id,external_effect,payload) VALUES ('m03-integrity-probe-plan',$1,$2,'m01-integrity-probe-v1',$3,'m02-integrity-probe',$4,'42','21','ETH-PERP','NO_ACTION','0','0',0,'LOCAL','local',0,now(),now()+interval '1 minute','m03-integrity-probe',false,'{}'::jsonb)`,
        values: ['e'.repeat(64), 'f'.repeat(64), 'a'.repeat(64), 'c'.repeat(64)],
      },
      {
        table: 'm03_simulation_results',
        keyColumn: 'simulation_id',
        key: 'm03-integrity-probe-simulation',
        insert: `INSERT INTO m03_simulation_results (simulation_id,plan_digest,kind,authority,status,simulator_version,checked_at,expires_at,payload) VALUES ('m03-integrity-probe-simulation',$1,'DETERMINISTIC_DRY_RUN','DRY_RUN_ONLY','UNKNOWN','integrity-probe',now(),now()+interval '1 minute','{}'::jsonb)`,
        values: ['e'.repeat(64)],
      },
      {
        table: 'm03_authorization_refs',
        keyColumn: 'authorization_ref',
        key: 'm03-integrity-probe-authorization',
        insert: `INSERT INTO m03_authorization_refs (authorization_ref,plan_digest,policy_version_hash,actor_ref,issuer_ref,scope,proof_ref_hash,verified_at,expires_at) VALUES ('m03-integrity-probe-authorization',$1,$2,'actor:test','issuer:test','NO_ACTION',$3,now(),now()+interval '1 minute')`,
        values: ['e'.repeat(64), 'a'.repeat(64), 'd'.repeat(64)],
      },
      {
        table: 'm03_provider_enrollment_refs',
        keyColumn: 'enrollment_ref',
        key: 'm03-integrity-probe-enrollment',
        insert: `INSERT INTO m03_provider_enrollment_refs (enrollment_ref,provider,account_id,network,chain_id,capability_ref,capability_evidence_hash,verified_at,expires_at) VALUES ('m03-integrity-probe-enrollment','perpl','42','monad-testnet',10143,'probe',$1,now(),now()+interval '1 minute')`,
        values: ['d'.repeat(64)],
      },
      {
        table: 'm03_nonce_ledger',
        keyColumn: 'nonce_hash',
        key: '1'.repeat(64),
        insert: `INSERT INTO m03_nonce_ledger (nonce_hash,issuer_ref,purpose) VALUES ($1,'issuer:test','execution-authorization')`,
        values: ['1'.repeat(64)],
      },
      {
        table: 'm03_execution_idempotency',
        keyColumn: 'idempotency_key',
        key: 'f'.repeat(64),
        insert: `INSERT INTO m03_execution_idempotency (idempotency_key,provider,network,chain_id,account_id,plan_digest) VALUES ($1,'perpl','monad-testnet',10143,'42',$2)`,
        values: ['f'.repeat(64), 'e'.repeat(64)],
      },
      {
        table: 'm03_execution_attempt_events',
        keyColumn: 'event_id',
        key: '2'.repeat(64),
        insert: `INSERT INTO m03_execution_attempt_events (event_id,idempotency_key,plan_digest,state,reason,correlation_id,occurred_at,payload) VALUES ($1,$2,$3,'REFUSED','integrity probe','m03-integrity-probe',now(),'{}'::jsonb)`,
        values: ['2'.repeat(64), 'f'.repeat(64), 'e'.repeat(64)],
      },
      {
        table: 'm03_execution_receipts',
        keyColumn: 'receipt_id',
        key: '3'.repeat(64),
        insert: `INSERT INTO m03_execution_receipts (receipt_id,idempotency_key,plan_digest,outcome,reason,correlation_id,created_at,payload) VALUES ($1,$2,$3,'REFUSED','integrity probe','m03-integrity-probe',now(),'{}'::jsonb)`,
        values: ['3'.repeat(64), 'f'.repeat(64), 'e'.repeat(64)],
      },
    ];
    for (const row of m03Rows) await client.query(row.insert, row.values);
    await client.query('SAVEPOINT m03_nonce_replay_check');
    let nonceReplayRejected = false;
    try {
      await client.query(
        "INSERT INTO m03_nonce_ledger (nonce_hash,issuer_ref,purpose) VALUES ($1,'issuer:test','execution-authorization')",
        ['1'.repeat(64)],
      );
    } catch {
      nonceReplayRejected = true;
    }
    await client.query('ROLLBACK TO SAVEPOINT m03_nonce_replay_check');
    if (!nonceReplayRejected) throw new Error('M03 durable nonce ledger accepted a replay');
    await client.query('SAVEPOINT m03_idempotency_check');
    let duplicateEffectRejected = false;
    try {
      await client.query(
        "INSERT INTO m03_execution_idempotency (idempotency_key,provider,network,chain_id,account_id,plan_digest) VALUES ($1,'perpl','monad-testnet',10143,'42',$2)",
        ['f'.repeat(64), 'd'.repeat(64)],
      );
    } catch {
      duplicateEffectRejected = true;
    }
    await client.query('ROLLBACK TO SAVEPOINT m03_idempotency_check');
    if (!duplicateEffectRejected)
      throw new Error('M03 durable idempotency accepted a duplicate effect');
    for (const [index, row] of m03Rows.entries()) {
      const savepoint = `m03_append_only_${index}`;
      await client.query(`SAVEPOINT ${savepoint}`);
      let appendOnly = false;
      try {
        await client.query(
          `UPDATE ${row.table} SET ${row.keyColumn}=${row.keyColumn} WHERE ${row.keyColumn}=$1`,
          [row.key],
        );
      } catch {
        appendOnly = true;
      }
      await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      if (!appendOnly)
        throw new Error(`M03 append-only integrity trigger did not reject ${row.table} mutation`);
    }
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
      m03EvidenceAppendOnly: true,
      m03NonceReplayLedger: true,
      credentialColumns: 0,
      writePathTables: 0,
    }),
  );
} finally {
  await pool.end();
}
