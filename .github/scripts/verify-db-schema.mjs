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
  'm04_agent_identities',
  'm04_authority_states',
  'm04_authorization_refs',
  'm04_capability_grants',
  'm04_delegation_observations',
  'm04_nonce_ledger',
  'm04_permission_evidence',
  'm04_permission_evidence_head',
  'm04_revocations',
  'm04_session_revocations',
  'm04_sessions',
  'm04_wallet_bindings',
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
    throw new Error(`Unexpected M01-M04 table set: ${names.join(',')}`);
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
    'm04_wallet_bindings_append_only',
    'm04_agent_identities_append_only',
    'm04_capability_grants_append_only',
    'm04_sessions_append_only',
    'm04_session_revocations_append_only',
    'm04_nonce_ledger_append_only',
    'm04_authorization_refs_append_only',
    'm04_delegation_observations_append_only',
    'm04_revocations_append_only',
    'm04_permission_evidence_append_only',
    'm04_authority_states_monotonic',
    'm04_permission_evidence_head_monotonic',
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
  const expectedWriteTables = writeTables.rows.filter((row) => row.table_name.startsWith('m03_'));
  if (writeTables.rows.length !== expectedWriteTables.length)
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
    const probeWallet = `0x${'1'.repeat(40)}`;
    await client.query(
      `INSERT INTO m04_wallet_bindings
       (binding_id,account_id,chain_id,network,wallet_address,provider_id,event_type,generation,provenance_hash,occurred_at)
       VALUES ('m04-integrity-wallet','m04-probe',10143,'monad-testnet',$1,'eip712-compatible-wallet','BOUND',1,$2,now())`,
      [probeWallet, 'a'.repeat(64)],
    );
    await client.query(
      `INSERT INTO m04_agent_identities
       (agent_identity_id,agent_id,version,issuer_id,provenance_hash,chain_id,wallet_address,verified_at)
       VALUES ('m04-integrity-agent','m04-agent',1,'m04-issuer',$1,10143,$2,now())`,
      ['b'.repeat(64), probeWallet],
    );
    await client.query(
      `INSERT INTO m04_capability_grants
       (grant_id,grant_hash,account_id,wallet_address,agent_id,agent_version,chain_id,policy_hash,scope,actions,limits,grant_document,nonce_domain_hash,delegation_observation_hash,grant_approval_ref_hash,created_at,expires_at)
       VALUES ('m04-integrity-grant',$1,'m04-probe',$2,'m04-agent',1,10143,$3,'{"positionId":"21","marketSelector":"ETH-PERP"}'::jsonb,
       '["REDUCE_POSITION"]'::jsonb,'{"maxActionFractionBps":1000}'::jsonb,'{}'::jsonb,$4,$5,$6,now(),now()+interval '1 hour')`,
      ['c'.repeat(64), probeWallet, 'd'.repeat(64), 'e'.repeat(64), 'f'.repeat(64), '1'.repeat(64)],
    );
    await client.query(
      `INSERT INTO m04_authority_states (grant_id,generation,revoked) VALUES ('m04-integrity-grant',0,false)`,
    );
    await client.query(
      `INSERT INTO m04_sessions
       (session_id,grant_id,session_hash,nonce_domain_hash,actions,limits,created_at,expires_at)
       VALUES ('m04-integrity-session','m04-integrity-grant',$1,$2,'["REDUCE_POSITION"]'::jsonb,'{}'::jsonb,now(),now()+interval '10 minutes')`,
      ['2'.repeat(64), '3'.repeat(64)],
    );
    await client.query(
      `INSERT INTO m04_session_revocations
       (session_id,generation,actor_ref,proof_ref_hash,nonce_hash,occurred_at)
       VALUES ('m04-integrity-session',1,'m04-probe',$1,$2,now())`,
      ['8'.repeat(64), '9'.repeat(64)],
    );
    await client.query(
      `INSERT INTO m04_nonce_ledger
       (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
       VALUES ($1,10143,'m04-probe',$2,'m04-agent',NULL,'WALLET_BINDING',$3,now())`,
      ['4'.repeat(64), probeWallet, '5'.repeat(64)],
    );
    await client.query(
      `INSERT INTO m04_nonce_ledger
       (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
       VALUES ($1,10143,'m04-probe',$2,'wallet-read',NULL,'READ_ACCESS',$3,now())`,
      ['6'.repeat(64), probeWallet, '7'.repeat(64)],
    );
    await client.query('SAVEPOINT m04_wallet_generation_check');
    let walletGenerationConflictRejected = false;
    try {
      await client.query(
        `INSERT INTO m04_wallet_bindings
         (binding_id,account_id,chain_id,network,wallet_address,provider_id,event_type,generation,provenance_hash,occurred_at)
         VALUES ('m04-integrity-wallet-conflict','m04-probe',10143,'monad-testnet',$1,'eip712-compatible-wallet','BOUND',1,$2,now())`,
        [`0x${'3'.repeat(40)}`, '8'.repeat(64)],
      );
    } catch {
      walletGenerationConflictRejected = true;
    }
    await client.query('ROLLBACK TO SAVEPOINT m04_wallet_generation_check');
    if (!walletGenerationConflictRejected)
      throw new Error('M04 accepted concurrent active wallet generations for one account');
    await client.query(
      `INSERT INTO m04_authorization_refs
       (authorization_ref,grant_id,proof_ref_hash,typed_data_digest,plan_digest,action,verified_signer,revocation_generation,delegation_observation_hash,verified_at,expires_at)
       VALUES ($1,'m04-integrity-grant',$2,$1,$3,'REDUCE_POSITION',$4,0,$5,now(),now()+interval '1 minute')`,
      ['6'.repeat(64), '7'.repeat(64), '8'.repeat(64), probeWallet, '9'.repeat(64)],
    );
    await client.query(
      `INSERT INTO m04_delegation_observations
       (observation_id,account_id,wallet_address,chain_id,status,observation_hash,observed_at)
       VALUES ('m04-integrity-delegation','m04-probe',$1,10143,'ABSENT',$2,now())`,
      [probeWallet, 'a'.repeat(64)],
    );
    await client.query(
      `INSERT INTO m04_revocations
       (revocation_id,grant_id,generation,actor_ref,reason_code,proof_ref_hash,occurred_at)
       VALUES ('m04-integrity-revocation','m04-integrity-grant',1,'m04-probe','USER_REVOKED',$1,now())`,
      ['b'.repeat(64)],
    );
    await client.query(
      `INSERT INTO m04_permission_evidence
       (sequence,event_id,previous_hash,entry_hash,event,occurred_at)
       VALUES (1,'m04:integrity-probe',$1,$2,'{"kind":"GRANT_COMPILED"}'::jsonb,now())`,
      ['0'.repeat(64), 'c'.repeat(64)],
    );
    await client.query(
      `INSERT INTO m04_permission_evidence_head (singleton,last_sequence,last_hash) VALUES (true,0,$1)`,
      ['0'.repeat(64)],
    );
    const m04AppendOnlyRows = [
      ['m04_wallet_bindings', 'binding_id', 'm04-integrity-wallet'],
      ['m04_agent_identities', 'agent_identity_id', 'm04-integrity-agent'],
      ['m04_capability_grants', 'grant_id', 'm04-integrity-grant'],
      ['m04_sessions', 'session_id', 'm04-integrity-session'],
      ['m04_session_revocations', 'session_id', 'm04-integrity-session'],
      ['m04_nonce_ledger', 'nonce_hash', '4'.repeat(64)],
      ['m04_authorization_refs', 'authorization_ref', '6'.repeat(64)],
      ['m04_delegation_observations', 'observation_id', 'm04-integrity-delegation'],
      ['m04_revocations', 'revocation_id', 'm04-integrity-revocation'],
      ['m04_permission_evidence', 'event_id', 'm04:integrity-probe'],
    ];
    for (const [index, [table, keyColumn, key]] of m04AppendOnlyRows.entries()) {
      const savepoint = `m04_append_only_${index}`;
      await client.query(`SAVEPOINT ${savepoint}`);
      let appendOnly = false;
      try {
        await client.query(`UPDATE ${table} SET ${keyColumn}=${keyColumn} WHERE ${keyColumn}=$1`, [
          key,
        ]);
      } catch {
        appendOnly = true;
      }
      await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      if (!appendOnly) throw new Error(`M04 append-only trigger did not reject ${table} mutation`);
    }
    await client.query('SAVEPOINT m04_nonce_replay_check');
    let m04NonceReplayRejected = false;
    try {
      await client.query(
        `INSERT INTO m04_nonce_ledger
         (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
         VALUES ($1,10143,'m04-probe',$2,'m04-agent',NULL,'WALLET_BINDING',$3,now())`,
        ['4'.repeat(64), probeWallet, '5'.repeat(64)],
      );
    } catch {
      m04NonceReplayRejected = true;
    }
    await client.query('ROLLBACK TO SAVEPOINT m04_nonce_replay_check');
    if (!m04NonceReplayRejected) throw new Error('M04 durable nonce ledger accepted replay');
    await client.query('SAVEPOINT m04_authority_generation_check');
    let generationJumpRejected = false;
    try {
      await client.query(
        "UPDATE m04_authority_states SET generation=2 WHERE grant_id='m04-integrity-grant'",
      );
    } catch {
      generationJumpRejected = true;
    }
    await client.query('ROLLBACK TO SAVEPOINT m04_authority_generation_check');
    if (!generationJumpRejected) throw new Error('M04 authority state accepted a generation jump');
    await client.query(
      'UPDATE m04_permission_evidence_head SET last_sequence=1,last_hash=$1 WHERE singleton=true',
      ['c'.repeat(64)],
    );
    await client.query('SAVEPOINT m04_evidence_head_monotonic_check');
    let evidenceHeadJumpRejected = false;
    try {
      await client.query(
        'UPDATE m04_permission_evidence_head SET last_sequence=3 WHERE singleton=true',
      );
    } catch {
      evidenceHeadJumpRejected = true;
    }
    await client.query('ROLLBACK TO SAVEPOINT m04_evidence_head_monotonic_check');
    if (!evidenceHeadJumpRejected) throw new Error('M04 evidence head accepted a sequence jump');
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
      m04AppendOnlyEvidence: true,
      m04NonceReplayLedger: true,
      m04AuthorityGenerationMonotonic: true,
      m03NonceReplayLedger: true,
      credentialColumns: 0,
      writePathTables: 0,
    }),
  );
} finally {
  await pool.end();
}
