import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { revokeM04Session, verifyM04PermissionEvidence } from '@nerva/db';

if (process.env.NERVA_ALLOW_DISPOSABLE_DATABASE !== 'true')
  throw new Error(
    'Set NERVA_ALLOW_DISPOSABLE_DATABASE=true only for a disposable CI PostgreSQL instance',
  );
const sourceUrl = new URL(process.env.DATABASE_URL ?? '');
if (!['postgres:', 'postgresql:'].includes(sourceUrl.protocol))
  throw new Error('DATABASE_URL must be PostgreSQL');
const databaseName = `nerva_m04_upgrade_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = '/postgres';
const targetUrl = new URL(sourceUrl);
targetUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({
  connectionString: adminUrl.toString(),
  connectionTimeoutMillis: 5_000,
});
let created = false;
let sessionRevocationCount;
let sessionRevocationNonceCount;
let sessionRevocationEvidenceVerified;
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  const target = new pg.Client({
    connectionString: targetUrl.toString(),
    connectionTimeoutMillis: 5_000,
  });
  try {
    await target.connect();
    const root = process.cwd();
    for (const file of [
      'packages/db/migrations/0000_elite_tempest.sql',
      'packages/db/migrations/0001_useful_hobgoblin.sql',
      'packages/db/migrations/0002_certain_dragon_lord.sql',
      'packages/db/migrations/0003_curved_smasher.sql',
      'packages/db/migrations/0004_brave_husk.sql',
      'packages/db/migrations/0005_cloudy_dagger.sql',
      'packages/db/migrations/0006_spooky_starfox.sql',
      'packages/db/migrations/0007_lush_hairball.sql',
      'packages/db/migrations/0008_purple_anita_blake.sql',
    ]) {
      const sql = fs.readFileSync(path.join(root, file), 'utf8');
      await target.query(sql);
    }
    const tables = await target.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
    );
    const evidence = await target.query(
      "SELECT to_regclass('public.market_snapshots') IS NOT NULL AS market, to_regclass('public.risk_snapshots') IS NOT NULL AS risk, to_regclass('public.provider_checkpoints') IS NOT NULL AS checkpoint, to_regclass('public.m03_execution_plans') IS NOT NULL AS plans, to_regclass('public.m03_nonce_ledger') IS NOT NULL AS nonce_ledger, to_regclass('public.m04_wallet_bindings') IS NOT NULL AS wallets, to_regclass('public.m04_capability_grants') IS NOT NULL AS grants, to_regclass('public.m04_authorization_refs') IS NOT NULL AS authorizations, to_regclass('public.m04_session_revocations') IS NOT NULL AS session_revocations, to_regclass('public.m04_permission_evidence') IS NOT NULL AS permission_evidence",
    );
    const triggerCount = await target.query(
      "SELECT count(*)::int AS n FROM pg_trigger WHERE NOT tgisinternal AND (tgname IN ('market_snapshots_append_only','position_snapshots_append_only','portfolio_snapshots_append_only','risk_snapshots_append_only','risk_metrics_append_only') OR tgname LIKE 'm03_%_append_only' OR tgname LIKE 'm04_%')",
    );
    if (
      tables.rows[0]?.n !== 34 ||
      !evidence.rows[0]?.market ||
      !evidence.rows[0]?.risk ||
      !evidence.rows[0]?.checkpoint ||
      !evidence.rows[0]?.plans ||
      !evidence.rows[0]?.nonce_ledger ||
      !evidence.rows[0]?.wallets ||
      !evidence.rows[0]?.grants ||
      !evidence.rows[0]?.authorizations ||
      !evidence.rows[0]?.session_revocations ||
      !evidence.rows[0]?.permission_evidence ||
      triggerCount.rows[0]?.n !== 28
    )
      throw new Error(
        'The clean M01-to-M04 migration did not produce the expected tables and integrity triggers',
      );
    const address = `0x${'a'.repeat(40)}`;
    await target.query(
      `INSERT INTO m04_wallet_bindings
       (binding_id,account_id,chain_id,network,wallet_address,provider_id,event_type,generation,provenance_hash,occurred_at)
       VALUES ('m04-race-wallet','m04-race-account',10143,'monad-testnet',$1,'eip712-compatible-wallet','BOUND',1,$2,now())`,
      [address, '1'.repeat(64)],
    );
    let accountGenerationConflictRejected = false;
    try {
      await target.query(
        `INSERT INTO m04_wallet_bindings
         (binding_id,account_id,chain_id,network,wallet_address,provider_id,event_type,generation,provenance_hash,occurred_at)
         VALUES ('m04-race-wallet-conflict','m04-race-account',10143,'monad-testnet',$1,'eip712-compatible-wallet','BOUND',1,$2,now())`,
        [`0x${'b'.repeat(40)}`, 'a'.repeat(64)],
      );
    } catch {
      accountGenerationConflictRejected = true;
    }
    if (!accountGenerationConflictRejected)
      throw new Error('The database allowed two wallet identities at one account generation');
    await target.query(
      `INSERT INTO m04_capability_grants
       (grant_id,grant_hash,account_id,wallet_address,agent_id,agent_version,chain_id,policy_hash,scope,actions,limits,grant_document,nonce_domain_hash,delegation_observation_hash,grant_approval_ref_hash,created_at,expires_at)
       VALUES ('m04-race-grant',$1,'m04-race-account',$2,'m04-race-agent',1,10143,$3,
       '{"positionId":"21","marketSelector":"ETH-PERP"}'::jsonb,'["REDUCE_POSITION"]'::jsonb,
       '{"maxActionFractionBps":1000}'::jsonb,
       '{"delegation":{"status":"ABSENT"}}'::jsonb,$4,$5,$6,now(),now()+interval '1 hour')`,
      ['2'.repeat(64), address, '3'.repeat(64), '4'.repeat(64), '5'.repeat(64), '6'.repeat(64)],
    );
    await target.query(
      "INSERT INTO m04_authority_states (grant_id,generation,revoked) VALUES ('m04-race-grant',0,false)",
    );
    await target.query(
      `INSERT INTO m04_delegation_observations
       (observation_id,account_id,wallet_address,chain_id,status,observation_hash,observed_at)
       VALUES ('m04-race-delegation','m04-race-account',$1,10143,'ABSENT',$2,now())`,
      [address, '7'.repeat(64)],
    );
    await target.query(
      `INSERT INTO m04_sessions
       (session_id,grant_id,session_hash,nonce_domain_hash,actions,limits,created_at,expires_at)
       VALUES ('m04-race-session','m04-race-grant',$1,$2,'["REDUCE_POSITION"]'::jsonb,'{}'::jsonb,now(),now()+interval '10 minutes')`,
      ['e'.repeat(64), 'f'.repeat(64)],
    );
    const writerA = new pg.Client({
      connectionString: targetUrl.toString(),
      connectionTimeoutMillis: 5_000,
    });
    const writerB = new pg.Client({
      connectionString: targetUrl.toString(),
      connectionTimeoutMillis: 5_000,
    });
    try {
      await Promise.all([writerA.connect(), writerB.connect()]);
      const servicePool = new pg.Pool({ connectionString: targetUrl.toString() });
      try {
        const occurredAt = new Date().toISOString();
        const revocations = await Promise.allSettled(
          ['1'.repeat(64), '2'.repeat(64)].map((nonceHash, index) =>
            revokeM04Session(servicePool, {
              sessionId: 'm04-race-session',
              sessionHash: 'e'.repeat(64),
              expectedGeneration: 0,
              grantGeneration: 0,
              nonceHash,
              domainHash: index === 0 ? '3'.repeat(64) : '4'.repeat(64),
              proofRefHash: index === 0 ? '5'.repeat(64) : '6'.repeat(64),
              occurredAt,
            }),
          ),
        );
        if (!revocations.some((result) => result.status === 'fulfilled' && result.value === 1))
          throw new Error('Concurrent session revocation failed to commit an authority change');
        const persisted = await servicePool.query(
          "SELECT session_id FROM m04_session_revocations WHERE session_id='m04-race-session'",
        );
        const persistedNonces = await servicePool.query(
          `SELECT nonce_hash FROM m04_nonce_ledger
           WHERE grant_id='m04-race-grant' AND operation='REVOCATION'`,
        );
        const evidence = await verifyM04PermissionEvidence(servicePool);
        sessionRevocationCount = persisted.rowCount ?? 0;
        sessionRevocationNonceCount = persistedNonces.rowCount ?? 0;
        sessionRevocationEvidenceVerified = evidence.verified;
        if (
          sessionRevocationCount !== 1 ||
          sessionRevocationNonceCount !== 1 ||
          !sessionRevocationEvidenceVerified
        )
          throw new Error(
            'Individual session revocation was not singular, replay-protected and evidence-linked',
          );
      } finally {
        await servicePool.end();
      }
      await writerA.query('BEGIN');
      await writerA.query(
        "SELECT generation FROM m04_authority_states WHERE grant_id='m04-race-grant' FOR UPDATE",
      );
      await writerA.query(
        `INSERT INTO m04_authorization_refs
         (authorization_ref,grant_id,proof_ref_hash,typed_data_digest,plan_digest,action,verified_signer,revocation_generation,delegation_observation_hash,verified_at,expires_at)
         VALUES ($1,'m04-race-grant',$2,$1,$3,'REDUCE_POSITION',$4,0,$5,now(),now()+interval '1 minute')`,
        ['8'.repeat(64), '9'.repeat(64), 'a'.repeat(64), address, 'b'.repeat(64)],
      );
      const revocation = writerB.query(
        "UPDATE m04_authority_states SET generation=1,revoked=true,updated_at=now() WHERE grant_id='m04-race-grant'",
      );
      await writerA.query('COMMIT');
      await revocation;
      const authority = await writerA.query(
        `SELECT 1 FROM m04_authorization_refs r JOIN m04_authority_states s USING(grant_id)
         JOIN m04_capability_grants g USING(grant_id)
         JOIN m04_delegation_observations o ON o.wallet_address=g.wallet_address AND o.chain_id=g.chain_id
         WHERE r.authorization_ref=$1 AND r.revocation_generation=s.generation AND s.revoked=false LIMIT 1`,
        ['8'.repeat(64)],
      );
      if (authority.rowCount !== 0)
        throw new Error(
          'Concurrent revocation failed to invalidate a pending authorization reference',
        );
      await writerA.query('BEGIN');
      await writerA.query(
        `INSERT INTO m04_nonce_ledger
         (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
         VALUES ($1,10143,'m04-race-account',$2,'m04-race-agent',NULL,'WALLET_BINDING',$3,now())`,
        ['c'.repeat(64), address, 'd'.repeat(64)],
      );
      const concurrentReplay = writerB.query(
        `INSERT INTO m04_nonce_ledger
         (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
         VALUES ($1,10143,'m04-race-account',$2,'m04-race-agent',NULL,'WALLET_BINDING',$3,now())
         ON CONFLICT (nonce_hash) DO NOTHING RETURNING nonce_hash`,
        ['c'.repeat(64), address, 'd'.repeat(64)],
      );
      await writerA.query('COMMIT');
      const replayResult = await concurrentReplay;
      if (replayResult.rowCount !== 0)
        throw new Error('Concurrent M04 nonce replay was not rejected');
      const durableNonce = await writerB.query(
        'SELECT nonce_hash FROM m04_nonce_ledger WHERE nonce_hash=$1',
        ['c'.repeat(64)],
      );
      if (durableNonce.rowCount !== 1)
        throw new Error('M04 nonce consumption did not survive a new database session');
    } finally {
      await Promise.all([writerA.end(), writerB.end()]);
    }
    console.log(
      JSON.stringify({
        ok: true,
        migrationPath: [
          'M01 0000_elite_tempest.sql',
          'M02 0001_useful_hobgoblin.sql',
          'M03 0002_certain_dragon_lord.sql',
          'M04 0003_curved_smasher.sql',
          'M04 hardening 0004_brave_husk.sql',
          'M04 account-generation 0005_cloudy_dagger.sql',
          'M04 read-access nonce 0006_spooky_starfox.sql',
          'M04 read-access grant-null allowance 0007_lush_hairball.sql',
          'M04 session revocation 0008_purple_anita_blake.sql',
        ],
        tables: tables.rows[0].n,
        m04IntegrityTriggers: triggerCount.rows[0].n,
        m04SessionRevocation: 'PERSISTED_APPEND_ONLY',
        m04SessionRevocationConcurrentCalls: 'ONE_DURABLE_REVOCATION',
        m04SessionRevocationNonces: sessionRevocationNonceCount,
        m04SessionRevocationEvidence: sessionRevocationEvidenceVerified,
        m04NonceConcurrentReplay: 'REJECTED',
        m04RevocationAgainstPendingAuthorization: 'REVOKED_BEFORE_USE',
        m04NonceProcessSessionRestart: 'DURABLE',
      }),
    );
  } finally {
    await target.end();
  }
} finally {
  if (created) {
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  }
  await admin.end();
}
