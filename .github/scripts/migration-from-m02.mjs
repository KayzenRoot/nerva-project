import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import {
  persistM04Authorization,
  persistM04Session,
  revokeM04Session,
  validateM04AuthorizationRef,
  verifyM04PermissionEvidence,
} from '@nerva/db';

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
let concurrentSessionAuthorizationResult;
let sessionAuthorizationBlockedAfterRevoke;
let sessionRejectedAfterDelegationChange;
let sessionRejectedAfterParentGrantRevocation;
let sessionRejectedAfterWalletUnbind;
let sessionRevokedAuthorizationRefBlocked;
let sessionExpiryEnforced;
let sessionActionSubsetEnforced;
let sessionFractionBoundEnforced;
let sessionNotionalBoundEnforced;
let sessionSlippageBoundEnforced;
let m04SessionNonceReplayRejected;
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
      'packages/db/migrations/0009_natural_oracle.sql',
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
       '{"maxActionFractionBps":5000,"maxNotionalMicros":"1000000","maxSlippageBps":100}'::jsonb,
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
       (session_id,grant_id,session_hash,nonce_domain_hash,actions,limits,issuance_proof_ref_hash,
        issuance_typed_data_digest,issuance_nonce_hash,revocation_generation,delegation_observation_hash,created_at,expires_at)
       VALUES ('m04-race-session','m04-race-grant',$1,$2,'["REDUCE_POSITION"]'::jsonb,
        '{"maxActionFractionBps":2000,"maxNotionalMicros":"500000","maxSlippageBps":50}'::jsonb,
        $3,$4,$5,0,$6,now(),now()+interval '10 minutes')`,
      [
        'e'.repeat(64),
        'f'.repeat(64),
        '1'.repeat(64),
        '2'.repeat(64),
        '9'.repeat(64),
        '5'.repeat(64),
      ],
    );
    await target.query(
      `INSERT INTO m04_nonce_ledger
       (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
       VALUES ($1,10143,'m04-race-account',$2,'m04-race-agent','m04-race-grant','SESSION',$3,now())`,
      ['9'.repeat(64), address, 'f'.repeat(64)],
    );
    await target.query(
      `INSERT INTO m04_sessions
       (session_id,grant_id,session_hash,nonce_domain_hash,actions,limits,issuance_proof_ref_hash,
        issuance_typed_data_digest,issuance_nonce_hash,revocation_generation,delegation_observation_hash,created_at,expires_at)
       VALUES ('m04-auth-race-session','m04-race-grant',$1,$2,'["REDUCE_POSITION"]'::jsonb,
        '{"maxActionFractionBps":2000,"maxNotionalMicros":"500000","maxSlippageBps":50}'::jsonb,
        $3,$4,$5,0,$6,now(),now()+interval '10 minutes')`,
      [
        '5'.repeat(64),
        '6'.repeat(64),
        '1'.repeat(64),
        '2'.repeat(64),
        'd'.repeat(64),
        '5'.repeat(64),
      ],
    );
    await target.query(
      `INSERT INTO m04_nonce_ledger
       (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
       VALUES ($1,10143,'m04-race-account',$2,'m04-race-agent','m04-race-grant','SESSION',$3,now())`,
      ['d'.repeat(64), address, '6'.repeat(64)],
    );
    await target.query(
      `INSERT INTO policies (policy_id,environment,state)
       VALUES ('m04-race-policy','TESTNET','ACTIVE')`,
    );
    await target.query(
      `INSERT INTO policy_versions (policy_version_id,policy_id,version,payload,content_hash,confirmed_at)
       VALUES ('m04-race-policy:v1','m04-race-policy',1,'{"createdByActorRef":"m04-race-agent"}'::jsonb,$1,now())`,
      ['3'.repeat(64)],
    );
    await target.query(
      `INSERT INTO risk_snapshots
       (snapshot_id,generated_at,quality,actionable,content_hash,correlation_id,source_snapshot_hashes,payload)
       VALUES ('m04-race-risk',now(),'FRESH',false,$1,'m04-race-risk',ARRAY[$2],'{"schemaVersion":"0.1"}'::jsonb)`,
      ['f'.repeat(64), 'c'.repeat(64)],
    );
    await target.query(
      `INSERT INTO position_snapshots
       (snapshot_id,position_id,market_id,observed_at,received_at,quality,content_hash,correlation_id,payload)
       VALUES ('m04-race-position','21','ETH-PERP',now(),now(),'FRESH',$1,'m04-race-position',
        '{"sizeScaled":"10000"}'::jsonb)`,
      ['c'.repeat(64)],
    );
    await target.query(
      `INSERT INTO m03_execution_plans
       (plan_id,digest,idempotency_key,policy_version_id,policy_version_hash,snapshot_id,snapshot_hash,
        account_id,position_id,market_selector,action,quantity_scaled,notional_micros,slippage_bps,
        environment,network,chain_id,created_at,expires_at,correlation_id,external_effect,payload)
       VALUES ('m04-race-plan',$1,$2,'m04-race-policy:v1',$3,'m04-race-risk',$4,'m04-race-account',
        '21','ETH-PERP','REDUCE_POSITION','1000','100000',20,'TESTNET','monad-testnet',10143,now(),
        now()+interval '5 minutes','m04-race-plan',true,'{}'::jsonb)`,
      ['a'.repeat(64), 'b'.repeat(64), '3'.repeat(64), 'f'.repeat(64)],
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
        const authorizationTypedDigest = 'c'.repeat(64);
        const verifiedAt = new Date().toISOString();
        const authorizationConsumption = persistM04Authorization(servicePool, {
          grantId: 'm04-race-grant',
          generation: 0,
          verified: {
            signer: address,
            proofRefHash: '7'.repeat(64),
            typedDataDigest: authorizationTypedDigest,
            grantHash: '2'.repeat(64),
            planDigest: 'a'.repeat(64),
            action: 'REDUCE_POSITION',
            expiresAt: new Date(Date.parse(verifiedAt) + 120_000).toISOString(),
            nonceHash: '4'.repeat(64),
            sessionId: 'm04-auth-race-session',
            sessionHash: '5'.repeat(64),
          },
          domainHash: authorizationTypedDigest,
          correlationId: 'm04-auth-race',
          verifiedAt,
        });
        const sessionRevocation = revokeM04Session(servicePool, {
          sessionId: 'm04-auth-race-session',
          sessionHash: '5'.repeat(64),
          expectedGeneration: 0,
          grantGeneration: 0,
          nonceHash: '6'.repeat(64),
          domainHash: '7'.repeat(64),
          proofRefHash: '8'.repeat(64),
          occurredAt,
        });
        const concurrentResults = await Promise.allSettled([
          authorizationConsumption,
          sessionRevocation,
        ]);
        const authorizationOutcome = concurrentResults[0];
        const revocationOutcome = concurrentResults[1];
        if (
          authorizationOutcome?.status !== 'fulfilled' ||
          revocationOutcome?.status !== 'fulfilled' ||
          revocationOutcome.value !== 1
        )
          throw new Error(
            `Session revoke vs authorization consumption did not serialize safely: ${JSON.stringify(
              {
                authorizationOutcome:
                  authorizationOutcome?.status === 'rejected'
                    ? {
                        status: 'rejected',
                        message: authorizationOutcome.reason?.message,
                        code: authorizationOutcome.reason?.code,
                      }
                    : authorizationOutcome,
                revocationOutcome:
                  revocationOutcome?.status === 'rejected'
                    ? {
                        status: 'rejected',
                        message: revocationOutcome.reason?.message,
                        code: revocationOutcome.reason?.code,
                      }
                    : revocationOutcome,
              },
            )}`,
          );
        concurrentSessionAuthorizationResult = authorizationOutcome.value;
        sessionAuthorizationBlockedAfterRevoke = !(await validateM04AuthorizationRef(servicePool, {
          authorizationRef: authorizationTypedDigest,
          planDigest: 'a'.repeat(64),
          action: 'REDUCE_POSITION',
          now: new Date().toISOString(),
          agentId: 'm04-race-agent',
        }));
        if (!sessionAuthorizationBlockedAfterRevoke)
          throw new Error(
            'M03 boundary accepted a session authorization after confirmed revocation',
          );

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
          `SELECT n.nonce_hash FROM m04_session_revocations r
           JOIN m04_nonce_ledger n ON n.nonce_hash=r.nonce_hash
           WHERE r.session_id='m04-race-session' AND n.operation='REVOCATION'`,
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
      const postRacePool = new pg.Pool({ connectionString: targetUrl.toString() });
      try {
        const randomHash = () => createHash('sha256').update(randomUUID()).digest('hex');
        const createAuthorizedSessionFixture = async (
          label,
          {
            actions = ['REDUCE_POSITION'],
            limits = {
              maxActionFractionBps: 2_000,
              maxNotionalMicros: '500000',
              maxSlippageBps: 50,
            },
            expectAuthorization = true,
          } = {},
        ) => {
          const grantId = `m04-${label}-grant`;
          const sessionId = `m04-${label}-session`;
          const issuedAt = new Date().toISOString();
          const grantHash = randomHash();
          const sessionHash = randomHash();
          const sessionNonceHash = randomHash();
          const authorizationRef = randomHash();
          await target.query(
            `INSERT INTO m04_capability_grants
           (grant_id,grant_hash,account_id,wallet_address,agent_id,agent_version,chain_id,policy_hash,scope,actions,limits,grant_document,nonce_domain_hash,delegation_observation_hash,grant_approval_ref_hash,created_at,expires_at)
           VALUES ($1,$2,'m04-race-account',$3,'m04-race-agent',1,10143,$4,
             '{"positionId":"21","marketSelector":"ETH-PERP"}'::jsonb,'["REDUCE_POSITION","NO_ACTION"]'::jsonb,
             '{"maxActionFractionBps":5000,"maxNotionalMicros":"1000000","maxSlippageBps":100}'::jsonb,
             '{"delegation":{"status":"ABSENT"}}'::jsonb,$5,$6,$7,now(),now()+interval '1 hour')`,
            [
              grantId,
              grantHash,
              address,
              '3'.repeat(64),
              randomHash(),
              '5'.repeat(64),
              randomHash(),
            ],
          );
          await target.query(
            'INSERT INTO m04_authority_states (grant_id,generation,revoked) VALUES ($1,0,false)',
            [grantId],
          );
          await target.query(
            `INSERT INTO m04_sessions
           (session_id,grant_id,session_hash,nonce_domain_hash,actions,limits,issuance_proof_ref_hash,
            issuance_typed_data_digest,issuance_nonce_hash,revocation_generation,delegation_observation_hash,created_at,expires_at)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,0,$10,$11,$11::timestamptz+interval '10 minutes')`,
            [
              sessionId,
              grantId,
              sessionHash,
              randomHash(),
              JSON.stringify(actions),
              JSON.stringify(limits),
              randomHash(),
              randomHash(),
              sessionNonceHash,
              '5'.repeat(64),
              issuedAt,
            ],
          );
          await target.query(
            `INSERT INTO m04_nonce_ledger
           (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
           VALUES ($1,10143,'m04-race-account',$2,'m04-race-agent',$3,'SESSION',$4,$5)`,
            [sessionNonceHash, address, grantId, randomHash(), issuedAt],
          );
          const verifiedAt = new Date().toISOString();
          const authorizationNonceHash = randomHash();
          const persisted = await persistM04Authorization(postRacePool, {
            grantId,
            generation: 0,
            verified: {
              signer: address,
              proofRefHash: randomHash(),
              typedDataDigest: authorizationRef,
              grantHash,
              planDigest: 'a'.repeat(64),
              action: 'REDUCE_POSITION',
              expiresAt: new Date(Date.parse(verifiedAt) + 120_000).toISOString(),
              nonceHash: authorizationNonceHash,
              sessionId,
              sessionHash,
            },
            domainHash: authorizationRef,
            correlationId: `m04-${label}-authorization`,
            verifiedAt,
          });
          if (Boolean(persisted) !== expectAuthorization)
            throw new Error(`M04 ${label} session authorization result was unexpected`);
          if (!expectAuthorization) {
            const authorizationWrites = await target.query(
              `SELECT
                (SELECT count(*)::int FROM m04_nonce_ledger WHERE nonce_hash=$1) AS nonce_count,
                (SELECT count(*)::int FROM m04_authorization_refs WHERE authorization_ref=$2) AS reference_count`,
              [authorizationNonceHash, authorizationRef],
            );
            const counts = authorizationWrites.rows[0];
            if (counts?.nonce_count !== 0 || counts.reference_count !== 0)
              throw new Error(`M04 ${label} denied authorization left durable state`);
            return { grantId, sessionId, sessionHash, authorizationRef, authorizationDenied: true };
          }
          const valid = await validateM04AuthorizationRef(postRacePool, {
            authorizationRef,
            planDigest: 'a'.repeat(64),
            action: 'REDUCE_POSITION',
            now: new Date().toISOString(),
            agentId: 'm04-race-agent',
          });
          if (!valid)
            throw new Error(`M04 ${label} session authorization failed its valid baseline`);
          return { grantId, sessionId, sessionHash, authorizationRef, authorizationDenied: false };
        };

        const delegationFixture = await createAuthorizedSessionFixture('delegate-change');
        await target.query(
          `INSERT INTO m04_delegation_observations
         (observation_id,account_id,wallet_address,chain_id,status,delegate_address,delegate_code_hash,observation_hash,observed_at)
         VALUES ('m04-race-delegation-changed','m04-race-account',$1,10143,'ACTIVE',$2,$3,$4,now())`,
          [address, `0x${'9'.repeat(40)}`, 'e'.repeat(64), randomHash()],
        );
        sessionRejectedAfterDelegationChange = !(await validateM04AuthorizationRef(postRacePool, {
          authorizationRef: delegationFixture.authorizationRef,
          planDigest: 'a'.repeat(64),
          action: 'REDUCE_POSITION',
          now: new Date().toISOString(),
          agentId: 'm04-race-agent',
        }));
        if (!sessionRejectedAfterDelegationChange)
          throw new Error('M03 boundary accepted a session after EIP-7702 delegate/code changed');
        await target.query(
          `INSERT INTO m04_delegation_observations
         (observation_id,account_id,wallet_address,chain_id,status,observation_hash,observed_at)
         VALUES ('m04-race-delegation-restored','m04-race-account',$1,10143,'ABSENT',$2,now())`,
          [address, randomHash()],
        );

        sessionActionSubsetEnforced = (
          await createAuthorizedSessionFixture('session-action-outside', {
            actions: ['NO_ACTION'],
            expectAuthorization: false,
          })
        ).authorizationDenied;
        sessionFractionBoundEnforced = (
          await createAuthorizedSessionFixture('session-fraction-outside', {
            limits: {
              maxActionFractionBps: 500,
              maxNotionalMicros: '500000',
              maxSlippageBps: 50,
            },
            expectAuthorization: false,
          })
        ).authorizationDenied;
        sessionNotionalBoundEnforced = (
          await createAuthorizedSessionFixture('session-notional-outside', {
            limits: {
              maxActionFractionBps: 2_000,
              maxNotionalMicros: '50000',
              maxSlippageBps: 50,
            },
            expectAuthorization: false,
          })
        ).authorizationDenied;
        sessionSlippageBoundEnforced = (
          await createAuthorizedSessionFixture('session-slippage-outside', {
            limits: {
              maxActionFractionBps: 2_000,
              maxNotionalMicros: '500000',
              maxSlippageBps: 10,
            },
            expectAuthorization: false,
          })
        ).authorizationDenied;
        if (
          !sessionActionSubsetEnforced ||
          !sessionFractionBoundEnforced ||
          !sessionNotionalBoundEnforced ||
          !sessionSlippageBoundEnforced
        )
          throw new Error('M04 accepted a plan outside the session action or quantitative subset');

        const expiredGrantId = 'm04-session-expired-grant';
        const expiredSessionId = 'm04-session-expired-session';
        const expiredSessionHash = randomHash();
        const expiredSessionNonceHash = randomHash();
        const expiredAuthorizationRef = randomHash();
        const expiredAuthorizationNonceHash = randomHash();
        await target.query(
          `INSERT INTO m04_capability_grants
           (grant_id,grant_hash,account_id,wallet_address,agent_id,agent_version,chain_id,policy_hash,scope,actions,limits,grant_document,nonce_domain_hash,delegation_observation_hash,grant_approval_ref_hash,created_at,expires_at)
           VALUES ($1,$2,'m04-race-account',$3,'m04-race-agent',1,10143,$4,
             '{"positionId":"21","marketSelector":"ETH-PERP"}'::jsonb,'["REDUCE_POSITION"]'::jsonb,
             '{"maxActionFractionBps":5000,"maxNotionalMicros":"1000000","maxSlippageBps":100}'::jsonb,
             '{"delegation":{"status":"ABSENT"}}'::jsonb,$5,$6,$7,now()-interval '20 minutes',now()+interval '1 hour')`,
          [
            expiredGrantId,
            randomHash(),
            address,
            '3'.repeat(64),
            randomHash(),
            '5'.repeat(64),
            randomHash(),
          ],
        );
        await target.query(
          'INSERT INTO m04_authority_states (grant_id,generation,revoked) VALUES ($1,0,false)',
          [expiredGrantId],
        );
        await target.query(
          `INSERT INTO m04_sessions
           (session_id,grant_id,session_hash,nonce_domain_hash,actions,limits,issuance_proof_ref_hash,
            issuance_typed_data_digest,issuance_nonce_hash,revocation_generation,delegation_observation_hash,created_at,expires_at)
           VALUES ($1,$2,$3,$4,'["REDUCE_POSITION"]'::jsonb,
            '{"maxActionFractionBps":2000,"maxNotionalMicros":"500000","maxSlippageBps":50}'::jsonb,
            $5,$6,$7,0,$8,now()-interval '10 minutes',now()-interval '1 second')`,
          [
            expiredSessionId,
            expiredGrantId,
            expiredSessionHash,
            randomHash(),
            randomHash(),
            randomHash(),
            expiredSessionNonceHash,
            '5'.repeat(64),
          ],
        );
        await target.query(
          `INSERT INTO m04_nonce_ledger
           (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
           VALUES ($1,10143,'m04-race-account',$2,'m04-race-agent',$3,'SESSION',$4,now()-interval '10 minutes'),
             ($5,10143,'m04-race-account',$2,'m04-race-agent',$3,'AUTHORIZATION',$6,now()-interval '30 seconds')`,
          [
            expiredSessionNonceHash,
            address,
            expiredGrantId,
            randomHash(),
            expiredAuthorizationNonceHash,
            expiredAuthorizationRef,
          ],
        );
        await target.query(
          `INSERT INTO m04_authorization_refs
           (authorization_ref,grant_id,proof_ref_hash,typed_data_digest,authorization_nonce_hash,
            plan_digest,action,verified_signer,session_id,session_hash,revocation_generation,
            delegation_observation_hash,verified_at,expires_at)
           VALUES ($1,$2,$3,$1,$4,$5,'REDUCE_POSITION',$6,$7,$8,0,$9,
             now()-interval '30 seconds',now()+interval '1 minute')`,
          [
            expiredAuthorizationRef,
            expiredGrantId,
            randomHash(),
            expiredAuthorizationNonceHash,
            'a'.repeat(64),
            address,
            expiredSessionId,
            expiredSessionHash,
            '5'.repeat(64),
          ],
        );
        sessionExpiryEnforced = !(await validateM04AuthorizationRef(postRacePool, {
          authorizationRef: expiredAuthorizationRef,
          planDigest: 'a'.repeat(64),
          action: 'REDUCE_POSITION',
          now: new Date().toISOString(),
          agentId: 'm04-race-agent',
        }));
        if (!sessionExpiryEnforced)
          throw new Error('M03 boundary accepted a session after its expiry');

        const alreadyAuthorizedSession = await createAuthorizedSessionFixture('session-revoked');
        const sessionRevokeCommitted = await revokeM04Session(postRacePool, {
          sessionId: alreadyAuthorizedSession.sessionId,
          sessionHash: alreadyAuthorizedSession.sessionHash,
          expectedGeneration: 0,
          grantGeneration: 0,
          nonceHash: randomHash(),
          domainHash: randomHash(),
          proofRefHash: randomHash(),
          occurredAt: new Date().toISOString(),
        });
        sessionRevokedAuthorizationRefBlocked =
          sessionRevokeCommitted === 1 &&
          !(await validateM04AuthorizationRef(postRacePool, {
            authorizationRef: alreadyAuthorizedSession.authorizationRef,
            planDigest: 'a'.repeat(64),
            action: 'REDUCE_POSITION',
            now: new Date().toISOString(),
            agentId: 'm04-race-agent',
          }));
        if (!sessionRevokedAuthorizationRefBlocked)
          throw new Error('M03 boundary accepted a persisted authorization after session revoke');

        const parentFixture = await createAuthorizedSessionFixture('parent-revoked');
        await target.query(
          `UPDATE m04_authority_states SET generation=1,revoked=true,updated_at=now() WHERE grant_id=$1`,
          [parentFixture.grantId],
        );
        sessionRejectedAfterParentGrantRevocation = !(await validateM04AuthorizationRef(
          postRacePool,
          {
            authorizationRef: parentFixture.authorizationRef,
            planDigest: 'a'.repeat(64),
            action: 'REDUCE_POSITION',
            now: new Date().toISOString(),
            agentId: 'm04-race-agent',
          },
        ));
        if (!sessionRejectedAfterParentGrantRevocation)
          throw new Error('M03 boundary accepted a session after its parent grant was revoked');

        const replayGrantId = 'm04-session-replay-grant';
        await target.query(
          `INSERT INTO m04_capability_grants
           (grant_id,grant_hash,account_id,wallet_address,agent_id,agent_version,chain_id,policy_hash,scope,actions,limits,grant_document,nonce_domain_hash,delegation_observation_hash,grant_approval_ref_hash,created_at,expires_at)
           VALUES ($1,$2,'m04-race-account',$3,'m04-race-agent',1,10143,$4,
             '{"positionId":"21","marketSelector":"ETH-PERP"}'::jsonb,'["REDUCE_POSITION"]'::jsonb,
             '{"maxActionFractionBps":5000,"maxNotionalMicros":"1000000","maxSlippageBps":100}'::jsonb,
             '{"delegation":{"status":"ABSENT"}}'::jsonb,$5,$6,$7,now(),now()+interval '1 hour')`,
          [
            replayGrantId,
            randomHash(),
            address,
            '3'.repeat(64),
            randomHash(),
            '5'.repeat(64),
            randomHash(),
          ],
        );
        await target.query(
          'INSERT INTO m04_authority_states (grant_id,generation,revoked) VALUES ($1,0,false)',
          [replayGrantId],
        );
        const replayNonceHash = randomHash();
        const replayIssuedAt = new Date().toISOString();
        const makeReplaySession = (sessionId) => ({
          schemaVersion: '0.1',
          sessionId,
          grantId: replayGrantId,
          grantHash: '0'.repeat(64),
          chainId: 10_143,
          accountId: 'm04-race-account',
          walletAddress: address,
          agentId: 'm04-race-agent',
          agentVersion: 1,
          policyHash: '3'.repeat(64),
          actions: ['REDUCE_POSITION'],
          maxActionFractionBps: 2_000,
          maxNotionalMicros: '500000',
          maxSlippageBps: 50,
          issuedAt: replayIssuedAt,
          expiresAt: new Date(Date.parse(replayIssuedAt) + 600_000).toISOString(),
          nonceDomain: `nerva:session:${sessionId}`,
          revocationGeneration: 0,
          delegationObservationHash: '5'.repeat(64),
          digest: randomHash(),
        });
        const replaySession = makeReplaySession('m04-session-replay-one');
        const replayIssuance = {
          proofRefHash: randomHash(),
          typedDataDigest: randomHash(),
          nonceHash: replayNonceHash,
        };
        const firstSessionIssued = await persistM04Session(
          postRacePool,
          replaySession,
          replayIssuance,
        );
        if (!firstSessionIssued)
          throw new Error('A fresh M04 session nonce was not accepted for issuance');
        const replayedSession = await persistM04Session(
          postRacePool,
          makeReplaySession('m04-session-replay-two'),
          replayIssuance,
        );
        const replayedRows = await target.query(
          "SELECT session_id FROM m04_sessions WHERE session_id='m04-session-replay-two'",
        );
        m04SessionNonceReplayRejected = !replayedSession && replayedRows.rowCount === 0;
        if (!m04SessionNonceReplayRejected)
          throw new Error('M04 session issuance nonce replay was persisted');

        const walletFixture = await createAuthorizedSessionFixture('wallet-unbound');
        await target.query(
          `INSERT INTO m04_wallet_bindings
         (binding_id,account_id,chain_id,network,wallet_address,provider_id,event_type,generation,provenance_hash,occurred_at)
         VALUES ('m04-race-wallet-unbound','m04-race-account',10143,'monad-testnet',$1,
           'eip712-compatible-wallet','UNBOUND',2,$2,now())`,
          [address, randomHash()],
        );
        sessionRejectedAfterWalletUnbind = !(await validateM04AuthorizationRef(postRacePool, {
          authorizationRef: walletFixture.authorizationRef,
          planDigest: 'a'.repeat(64),
          action: 'REDUCE_POSITION',
          now: new Date().toISOString(),
          agentId: 'm04-race-agent',
        }));
        if (!sessionRejectedAfterWalletUnbind)
          throw new Error('M03 boundary accepted a session after its owner wallet was unbound');
      } finally {
        await postRacePool.end();
      }
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
          'M04 signed session issuance and session authorization 0009_natural_oracle.sql',
        ],
        tables: tables.rows[0].n,
        m04IntegrityTriggers: triggerCount.rows[0].n,
        m04SessionRevocation: 'PERSISTED_APPEND_ONLY',
        m04SessionRevocationConcurrentCalls: 'ONE_DURABLE_REVOCATION',
        m04SessionRevocationNonces: sessionRevocationNonceCount,
        m04SessionRevocationEvidence: sessionRevocationEvidenceVerified,
        m04ConcurrentSessionAuthorizationConsumedBeforeRevoke: concurrentSessionAuthorizationResult,
        m04SessionAuthorizationBlockedAfterRevoke: sessionAuthorizationBlockedAfterRevoke,
        m04SessionRejectedAfterDelegationChange: sessionRejectedAfterDelegationChange,
        m04SessionRejectedAfterParentGrantRevocation: sessionRejectedAfterParentGrantRevocation,
        m04SessionRejectedAfterWalletUnbind: sessionRejectedAfterWalletUnbind,
        m04SessionRevokedAuthorizationRefBlocked: sessionRevokedAuthorizationRefBlocked,
        m04SessionExpiryEnforced: sessionExpiryEnforced,
        m04SessionActionSubsetEnforced: sessionActionSubsetEnforced,
        m04SessionFractionBoundEnforced: sessionFractionBoundEnforced,
        m04SessionNotionalBoundEnforced: sessionNotionalBoundEnforced,
        m04SessionSlippageBoundEnforced: sessionSlippageBoundEnforced,
        m04SessionNonceReplayRejected: m04SessionNonceReplayRejected,
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
