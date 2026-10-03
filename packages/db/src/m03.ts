import { createHash } from 'node:crypto';
import type { Pool } from 'pg';

interface M03ExecutionEvent {
  readonly schemaVersion: '0.1';
  readonly eventId: string;
  readonly idempotencyKey: string;
  readonly planDigest: string;
  readonly correlationId: string;
  readonly state: string;
  readonly reason: string;
  readonly occurredAt: string;
  readonly providerReferenceHash?: string;
}

interface M03ExecutionPlan {
  readonly schemaVersion: '0.1';
  readonly planId: string;
  readonly digest: string;
  readonly idempotencyKey: string;
  readonly policyId: string;
  readonly policyVersion: number;
  readonly policyVersionHash: string;
  readonly snapshotId: string;
  readonly snapshotHash: string;
  readonly accountId: string;
  readonly positionId: string;
  readonly marketSelector: string;
  readonly action: 'REDUCE_POSITION' | 'CLOSE_POSITION' | 'NO_ACTION';
  readonly quantityScaled: string;
  readonly notionalMicros: string;
  readonly slippageBps: number;
  readonly environment:
    'LOCAL' | 'TESTNET_DEMO' | 'TESTNET' | 'MAINNET_READONLY' | 'MAINNET_EXECUTION';
  readonly network: 'local' | 'monad-testnet' | 'monad-mainnet';
  readonly chainId: 0 | 143 | 10_143;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly correlationId: string;
  readonly externalEffect: boolean;
}

interface M03DryRunSimulation {
  readonly simulationId: string;
  readonly kind: string;
  readonly authority: string;
  readonly planDigest: string;
  readonly status: string;
  readonly simulatorVersion: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

function safePayload(value: unknown, path = '$'): void {
  if (value === null || typeof value !== 'object') return;
  for (const [key, member] of Object.entries(value)) {
    if (/(?:api[_-]?key|secret|signature|private|mnemonic|seedphrase|seed_phrase)/i.test(key))
      throw new TypeError(`M03 payload contains sensitive credential material at ${path}.${key}`);
    safePayload(member, `${path}.${key}`);
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface PersistedPolicyConfirmation {
  readonly policyId: string;
  readonly version: number;
  readonly environment: 'LOCAL' | 'TESTNET_DEMO' | 'TESTNET' | 'MAINNET_READONLY';
  readonly payload: Readonly<Record<string, unknown>>;
  readonly canonicalHash: string;
  readonly actorRef: string;
  readonly issuerRef: string;
  readonly proofRefHash: string;
  readonly confirmedAt: string;
  readonly correlationId: string;
}

export async function appendM03PolicyConfirmation(
  pool: Pool,
  confirmation: PersistedPolicyConfirmation,
): Promise<string> {
  safePayload(confirmation.payload);
  if (!/^[0-9a-f]{64}$/.test(confirmation.canonicalHash))
    throw new TypeError('M03 policy canonical hash must be SHA-256');
  if (!/^[0-9a-f]{64}$/.test(confirmation.proofRefHash))
    throw new TypeError('M03 provenance reference must be a SHA-256 digest');
  const versionId = `${confirmation.policyId}:v${confirmation.version}`;
  const eventId = sha256(`${versionId}:CONFIRMED:${confirmation.canonicalHash}`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const policyRow = await client.query(
      `INSERT INTO policies (policy_id,environment,state)
       VALUES ($1,$2,'ACTIVE')
       ON CONFLICT (policy_id) DO UPDATE SET state='ACTIVE',updated_at=now()
       WHERE policies.environment=EXCLUDED.environment
       RETURNING policy_id`,
      [confirmation.policyId, confirmation.environment],
    );
    if (policyRow.rowCount !== 1) throw new Error('M03_POLICY_ENVIRONMENT_CONFLICT');
    await client.query(
      `INSERT INTO policy_versions (policy_version_id,policy_id,version,payload,content_hash,confirmed_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6)`,
      [
        versionId,
        confirmation.policyId,
        confirmation.version,
        JSON.stringify(confirmation.payload),
        confirmation.canonicalHash,
        confirmation.confirmedAt,
      ],
    );
    await client.query(
      `INSERT INTO m03_policy_confirmations (policy_version_id,canonical_hash,actor_ref,issuer_ref,proof_ref_hash,confirmed_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        versionId,
        confirmation.canonicalHash,
        confirmation.actorRef,
        confirmation.issuerRef,
        confirmation.proofRefHash,
        confirmation.confirmedAt,
      ],
    );
    const eventPayload = {
      schemaVersion: '0.1',
      eventId,
      policyVersionId: versionId,
      actorRef: confirmation.actorRef,
      issuerRef: confirmation.issuerRef,
      proofRefHash: confirmation.proofRefHash,
      canonicalHash: confirmation.canonicalHash,
      correlationId: confirmation.correlationId,
      occurredAt: confirmation.confirmedAt,
    };
    await client.query(
      `INSERT INTO m03_policy_lifecycle_events (event_id,policy_version_id,event_type,actor_ref,issuer_ref,proof_ref_hash,correlation_id,occurred_at,payload)
       VALUES ($1,$2,'CONFIRMED',$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        eventId,
        versionId,
        confirmation.actorRef,
        confirmation.issuerRef,
        confirmation.proofRefHash,
        confirmation.correlationId,
        confirmation.confirmedAt,
        JSON.stringify(eventPayload),
      ],
    );
    await client.query('COMMIT');
    return versionId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function appendM03PolicyLifecycleEvent(
  pool: Pool,
  input: Readonly<{
    policyId: string;
    policyVersionHash: string;
    action: 'PAUSE' | 'REVOKE';
    actorRef: string;
    issuerRef: string;
    proofRefHash: string;
    correlationId: string;
    occurredAt: string;
  }>,
): Promise<void> {
  if (!/^[0-9a-f]{64}$/.test(input.policyVersionHash) || !/^[0-9a-f]{64}$/.test(input.proofRefHash))
    throw new TypeError('M03 lifecycle hashes must be SHA-256');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query<{ state: string; policy_version_id: string }>(
      `SELECT p.state,v.policy_version_id FROM policies p
       JOIN policy_versions v ON v.policy_id=p.policy_id
       WHERE p.policy_id=$1 AND v.content_hash=$2 FOR UPDATE OF p`,
      [input.policyId, input.policyVersionHash],
    );
    const previous = current.rows[0];
    if (!previous || !['ACTIVE', 'PAUSED'].includes(previous.state))
      throw new Error('M03_POLICY_CONTROL_STATE_INVALID');
    if (input.action === 'PAUSE' && previous.state !== 'ACTIVE')
      throw new Error('M03_POLICY_CONTROL_STATE_INVALID');
    const state = input.action === 'PAUSE' ? 'PAUSED' : 'REVOKED';
    const eventType = state;
    const eventBody = {
      schemaVersion: '0.1',
      policyId: input.policyId,
      policyVersionId: previous.policy_version_id,
      policyVersionHash: input.policyVersionHash,
      eventType,
      actorRef: input.actorRef,
      issuerRef: input.issuerRef,
      proofRefHash: input.proofRefHash,
      correlationId: input.correlationId,
      occurredAt: input.occurredAt,
    };
    const eventId = sha256(JSON.stringify(eventBody));
    await client.query('UPDATE policies SET state=$2,updated_at=$3 WHERE policy_id=$1', [
      input.policyId,
      state,
      input.occurredAt,
    ]);
    await client.query(
      `INSERT INTO m03_policy_lifecycle_events (event_id,policy_version_id,event_type,actor_ref,issuer_ref,proof_ref_hash,correlation_id,occurred_at,payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) ON CONFLICT (event_id) DO NOTHING`,
      [
        eventId,
        previous.policy_version_id,
        eventType,
        input.actorRef,
        input.issuerRef,
        input.proofRefHash,
        input.correlationId,
        input.occurredAt,
        JSON.stringify(eventBody),
      ],
    );
    await client.query(
      `INSERT INTO audit_events (event_id,event_type,actor,subject_id,reason,correlation_id,payload,occurred_at)
       VALUES ($1,'M03_POLICY_CONTROL',$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT (event_id) DO NOTHING`,
      [
        sha256(`${eventId}:audit`),
        input.actorRef,
        input.policyId,
        eventType,
        input.correlationId,
        JSON.stringify({
          policyVersionHash: input.policyVersionHash,
          proofRefHash: input.proofRefHash,
        }),
        input.occurredAt,
      ],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function appendM03TriggerEvaluation(
  pool: Pool,
  input: Readonly<{
    evaluation: unknown;
    evaluationId: string;
    policyVersionId: string;
    policyVersionHash: string;
    snapshotId: string;
    snapshotHash: string;
    result: 'MATCH' | 'NO_MATCH' | 'REFUSED';
    reason: string;
    correlationId: string;
    evaluatedAt: string;
  }>,
): Promise<void> {
  safePayload(input.evaluation);
  await pool.query(
    `INSERT INTO m03_trigger_evaluations (evaluation_id,policy_version_id,policy_version_hash,snapshot_id,snapshot_hash,result,reason,correlation_id,evaluated_at,payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) ON CONFLICT (evaluation_id) DO NOTHING`,
    [
      input.evaluationId,
      input.policyVersionId,
      input.policyVersionHash,
      input.snapshotId,
      input.snapshotHash,
      input.result,
      input.reason,
      input.correlationId,
      input.evaluatedAt,
      JSON.stringify(input.evaluation),
    ],
  );
}

export async function appendM03ExecutionPlan(pool: Pool, plan: M03ExecutionPlan): Promise<void> {
  if (
    plan.environment === 'MAINNET_EXECUTION' ||
    (plan.externalEffect &&
      (plan.environment !== 'TESTNET' ||
        plan.network !== 'monad-testnet' ||
        plan.chainId !== 10_143))
  )
    throw new TypeError('M03 execution plans cannot enable mainnet effects or non-testnet effects');
  safePayload(plan);
  await pool.query(
    `INSERT INTO m03_execution_plans (plan_id,digest,idempotency_key,policy_version_id,policy_version_hash,snapshot_id,snapshot_hash,account_id,position_id,market_selector,action,quantity_scaled,notional_micros,slippage_bps,environment,network,chain_id,created_at,expires_at,correlation_id,external_effect,payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb)
     ON CONFLICT (plan_id) DO NOTHING`,
    [
      plan.planId,
      plan.digest,
      plan.idempotencyKey,
      `${plan.policyId}:v${plan.policyVersion}`,
      plan.policyVersionHash,
      plan.snapshotId,
      plan.snapshotHash,
      plan.accountId,
      plan.positionId,
      plan.marketSelector,
      plan.action,
      plan.quantityScaled,
      plan.notionalMicros,
      plan.slippageBps,
      plan.environment,
      plan.network,
      plan.chainId,
      plan.createdAt,
      plan.expiresAt,
      plan.correlationId,
      plan.externalEffect,
      JSON.stringify(plan),
    ],
  );
}

export async function appendM03AuthorizationRef(
  pool: Pool,
  input: Readonly<{
    planDigest: string;
    policyVersionHash: string;
    actorRef: string;
    issuerRef: string;
    scope: readonly string[];
    proofRefHash: string;
    verifiedAt: string;
    expiresAt: string;
  }>,
): Promise<void> {
  if (
    !/^[0-9a-f]{64}$/.test(input.planDigest) ||
    !/^[0-9a-f]{64}$/.test(input.policyVersionHash) ||
    !/^[0-9a-f]{64}$/.test(input.proofRefHash) ||
    input.scope.length !== 1 ||
    !input.actorRef ||
    !input.issuerRef ||
    !Number.isFinite(Date.parse(input.verifiedAt)) ||
    !Number.isFinite(Date.parse(input.expiresAt)) ||
    Date.parse(input.expiresAt) <= Date.parse(input.verifiedAt)
  )
    throw new TypeError('M03 authorization reference is malformed');
  const authorizationRef = sha256(`${input.planDigest}\u0000${input.proofRefHash}`);
  const result = await pool.query(
    `INSERT INTO m03_authorization_refs (authorization_ref,plan_digest,policy_version_hash,actor_ref,issuer_ref,scope,proof_ref_hash,verified_at,expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (authorization_ref) DO NOTHING`,
    [
      authorizationRef,
      input.planDigest,
      input.policyVersionHash,
      input.actorRef,
      input.issuerRef,
      input.scope[0],
      input.proofRefHash,
      input.verifiedAt,
      input.expiresAt,
    ],
  );
  if (result.rowCount !== 1) {
    const existing = await pool.query<{
      plan_digest: string;
      policy_version_hash: string;
      actor_ref: string;
      issuer_ref: string;
      scope: string;
      proof_ref_hash: string;
    }>(
      `SELECT plan_digest,policy_version_hash,actor_ref,issuer_ref,scope,proof_ref_hash FROM m03_authorization_refs WHERE authorization_ref=$1`,
      [authorizationRef],
    );
    const row = existing.rows[0];
    if (
      !row ||
      row.plan_digest !== input.planDigest ||
      row.policy_version_hash !== input.policyVersionHash ||
      row.actor_ref !== input.actorRef ||
      row.issuer_ref !== input.issuerRef ||
      row.scope !== input.scope[0] ||
      row.proof_ref_hash !== input.proofRefHash
    )
      throw new Error('M03 authorization reference identity conflict');
  }
}

export async function recordM03ExecutionRefusal(
  pool: Pool,
  input: Readonly<{
    idempotencyKey: string;
    planDigest: string;
    correlationId: string;
    reason: string;
    occurredAt: string;
  }>,
): Promise<void> {
  if (!/^[0-9a-f]{64}$/.test(input.idempotencyKey) || !/^[0-9a-f]{64}$/.test(input.planDigest))
    throw new TypeError('M03 execution refusal identity is malformed');
  const body = {
    schemaVersion: '0.1' as const,
    idempotencyKey: input.idempotencyKey,
    planDigest: input.planDigest,
    correlationId: input.correlationId,
    state: 'REFUSED' as const,
    reason: input.reason,
    occurredAt: input.occurredAt,
  };
  const event: M03ExecutionEvent = { ...body, eventId: sha256(JSON.stringify(body)) };
  safePayload(event);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO m03_execution_attempt_events (event_id,idempotency_key,plan_digest,state,reason,correlation_id,occurred_at,payload)
       VALUES ($1,$2,$3,'REFUSED',$4,$5,$6,$7::jsonb) ON CONFLICT (event_id) DO NOTHING`,
      [
        event.eventId,
        event.idempotencyKey,
        event.planDigest,
        event.reason,
        event.correlationId,
        event.occurredAt,
        JSON.stringify(event),
      ],
    );
    const receiptId = sha256(`${event.eventId}:receipt`);
    await client.query(
      `INSERT INTO m03_execution_receipts (receipt_id,idempotency_key,plan_digest,outcome,reason,correlation_id,created_at,payload)
       VALUES ($1,$2,$3,'REFUSED',$4,$5,$6,$7::jsonb) ON CONFLICT (receipt_id) DO NOTHING`,
      [
        receiptId,
        event.idempotencyKey,
        event.planDigest,
        event.reason,
        event.correlationId,
        event.occurredAt,
        JSON.stringify({
          schemaVersion: '0.1',
          receiptId,
          idempotencyKey: event.idempotencyKey,
          planDigest: event.planDigest,
          outcome: 'REFUSED',
          reason: event.reason,
          correlationId: event.correlationId,
          createdAt: event.occurredAt,
        }),
      ],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function recordM03ExecutionRecoveryRequired(
  pool: Pool,
  input: Readonly<{
    attemptEventId: string;
    idempotencyKey: string;
    planDigest: string;
    correlationId: string;
    occurredAt: string;
  }>,
): Promise<void> {
  if (!/^[0-9a-f]{64}$/.test(input.idempotencyKey) || !/^[0-9a-f]{64}$/.test(input.planDigest))
    throw new TypeError('M03 recovery identity is malformed');
  const body = {
    schemaVersion: '0.1' as const,
    idempotencyKey: input.idempotencyKey,
    planDigest: input.planDigest,
    correlationId: input.correlationId,
    state: 'RECOVERY_REQUIRED' as const,
    reason: 'READ_ONLY_PROVIDER_RECONCILIATION_UNAVAILABLE_NO_RETRY',
    occurredAt: input.occurredAt,
  };
  const event: M03ExecutionEvent = {
    ...body,
    eventId: sha256(`${input.attemptEventId}:reconcile-unavailable`),
  };
  safePayload(event);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO m03_execution_attempt_events (event_id,idempotency_key,plan_digest,state,reason,correlation_id,occurred_at,payload)
       VALUES ($1,$2,$3,'RECOVERY_REQUIRED',$4,$5,$6,$7::jsonb) ON CONFLICT (event_id) DO NOTHING`,
      [
        event.eventId,
        event.idempotencyKey,
        event.planDigest,
        event.reason,
        event.correlationId,
        event.occurredAt,
        JSON.stringify(event),
      ],
    );
    const receiptId = sha256(`${event.eventId}:receipt`);
    await client.query(
      `INSERT INTO m03_execution_receipts (receipt_id,idempotency_key,plan_digest,outcome,reason,correlation_id,created_at,payload)
       VALUES ($1,$2,$3,'RECOVERY_REQUIRED',$4,$5,$6,$7::jsonb) ON CONFLICT (receipt_id) DO NOTHING`,
      [
        receiptId,
        event.idempotencyKey,
        event.planDigest,
        event.reason,
        event.correlationId,
        event.occurredAt,
        JSON.stringify({
          schemaVersion: '0.1',
          receiptId,
          idempotencyKey: event.idempotencyKey,
          planDigest: event.planDigest,
          outcome: 'RECOVERY_REQUIRED',
          reason: event.reason,
          correlationId: event.correlationId,
          createdAt: event.occurredAt,
        }),
      ],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function appendM03DryRun(pool: Pool, simulation: M03DryRunSimulation): Promise<void> {
  safePayload(simulation);
  if (simulation.kind !== 'DETERMINISTIC_DRY_RUN' || simulation.authority !== 'DRY_RUN_ONLY')
    throw new TypeError('Only explicitly synthetic dry-run results can use this persistence path');
  await pool.query(
    `INSERT INTO m03_simulation_results (simulation_id,plan_digest,kind,authority,status,simulator_version,checked_at,expires_at,payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) ON CONFLICT (simulation_id) DO NOTHING`,
    [
      simulation.simulationId,
      simulation.planDigest,
      simulation.kind,
      simulation.authority,
      simulation.status,
      simulation.simulatorVersion,
      simulation.createdAt,
      simulation.expiresAt,
      JSON.stringify(simulation),
    ],
  );
}

export async function consumeM03Nonce(
  pool: Pool,
  input: Readonly<{ issuer: string; nonce: string; purpose: string }>,
): Promise<boolean> {
  if (
    ![
      'policy-confirmation',
      'execution-authorization',
      'provider-enrollment',
      'policy-control',
    ].includes(input.purpose)
  )
    return false;
  const nonceHash = sha256(`${input.purpose}\u0000${input.issuer}\u0000${input.nonce}`);
  const result = await pool.query(
    `INSERT INTO m03_nonce_ledger (nonce_hash,issuer_ref,purpose)
     VALUES ($1,$2,$3) ON CONFLICT (nonce_hash) DO NOTHING RETURNING nonce_hash`,
    [nonceHash, input.issuer, input.purpose],
  );
  return result.rowCount === 1;
}

const m03EffectGateLock = 1_083_091_073;

/** Holds the same advisory lock used by switch updates through the provider dispatch boundary. */
export async function runM03IfExecutionEnabled<T>(
  pool: Pool,
  localKillSwitchEnabled: boolean,
  operation: () => Promise<T>,
): Promise<Readonly<{ permitted: true; value: T }> | Readonly<{ permitted: false }>> {
  if (localKillSwitchEnabled) return { permitted: false };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [m03EffectGateLock]);
    const control = await client.query<{ enabled: boolean }>(
      `SELECT enabled FROM runtime_controls WHERE control_key='GLOBAL_EXECUTION_DISABLED'`,
    );
    if (control.rowCount !== 1 || control.rows[0]?.enabled !== false) {
      await client.query('ROLLBACK');
      return { permitted: false };
    }
    const value = await operation();
    await client.query('COMMIT');
    return { permitted: true, value };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Updates serialize with in-flight effect admission and default to disabled on startup. */
export async function setM03ExecutionDisabled(
  pool: Pool,
  input: Readonly<{
    disabled: boolean;
    actor: string;
    reason: string;
    source: string;
    correlationId: string;
  }>,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [m03EffectGateLock]);
    await client.query(
      `INSERT INTO runtime_controls (control_key,enabled,reason,actor,source,correlation_id,updated_at)
       VALUES ('GLOBAL_EXECUTION_DISABLED',$1,$2,$3,$4,$5,now())
       ON CONFLICT (control_key) DO UPDATE SET enabled=EXCLUDED.enabled,reason=EXCLUDED.reason,
         actor=EXCLUDED.actor,source=EXCLUDED.source,correlation_id=EXCLUDED.correlation_id,updated_at=now()`,
      [input.disabled, input.reason, input.actor, input.source, input.correlationId],
    );
    const eventId = sha256(`${input.correlationId}:GLOBAL_EXECUTION_DISABLED:${input.disabled}`);
    await client.query(
      `INSERT INTO audit_events (event_id,event_type,actor,subject_id,reason,correlation_id,payload,occurred_at)
       VALUES ($1,'M03_KILL_SWITCH_CHANGED',$2,'GLOBAL_EXECUTION_DISABLED',$3,$4,$5::jsonb,now())
       ON CONFLICT (event_id) DO NOTHING`,
      [
        eventId,
        input.actor,
        input.reason,
        input.correlationId,
        JSON.stringify({ disabled: input.disabled, source: input.source }),
      ],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function createPgM03ExecutionStore(pool: Pool) {
  return Object.freeze({
    async claim(input: {
      idempotencyKey: string;
      planDigest: string;
      provider: 'perpl';
      network: 'monad-testnet';
      accountId: string;
    }): Promise<'CLAIMED' | 'DUPLICATE' | 'CONFLICT'> {
      if (input.provider !== 'perpl' || input.network !== 'monad-testnet') return 'CONFLICT';
      const inserted = await pool.query(
        `INSERT INTO m03_execution_idempotency (idempotency_key,provider,network,chain_id,account_id,plan_digest)
         VALUES ($1,'perpl','monad-testnet',10143,$2,$3) ON CONFLICT (idempotency_key) DO NOTHING RETURNING idempotency_key`,
        [input.idempotencyKey, input.accountId, input.planDigest],
      );
      if (inserted.rowCount === 1) return 'CLAIMED';
      const existing = await pool.query<{
        plan_digest: string;
        account_id: string;
        network: string;
        provider: string;
      }>(
        'SELECT plan_digest,account_id,network,provider FROM m03_execution_idempotency WHERE idempotency_key=$1',
        [input.idempotencyKey],
      );
      const row = existing.rows[0];
      if (!row) return 'CONFLICT';
      return row.plan_digest === input.planDigest &&
        row.account_id === input.accountId &&
        row.network === input.network &&
        row.provider === input.provider
        ? 'DUPLICATE'
        : 'CONFLICT';
    },
    async append(event: M03ExecutionEvent): Promise<void> {
      safePayload(event);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO m03_execution_attempt_events (event_id,idempotency_key,plan_digest,state,reason,correlation_id,provider_reference_hash,occurred_at,payload)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) ON CONFLICT (event_id) DO NOTHING`,
          [
            event.eventId,
            event.idempotencyKey,
            event.planDigest,
            event.state,
            event.reason,
            event.correlationId,
            event.providerReferenceHash ?? null,
            event.occurredAt,
            JSON.stringify(event),
          ],
        );
        const outcome = {
          CONFIRMED: 'CONFIRMED',
          REFUSED: 'REFUSED',
          FAILED: 'FAILED',
          UNKNOWN: 'UNKNOWN',
          RECOVERY_REQUIRED: 'RECOVERY_REQUIRED',
        }[event.state];
        if (outcome) {
          const receiptId = sha256(`${event.eventId}:receipt`);
          await client.query(
            `INSERT INTO m03_execution_receipts (receipt_id,idempotency_key,plan_digest,outcome,reason,correlation_id,created_at,payload)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT (receipt_id) DO NOTHING`,
            [
              receiptId,
              event.idempotencyKey,
              event.planDigest,
              outcome,
              event.reason,
              event.correlationId,
              event.occurredAt,
              JSON.stringify({
                schemaVersion: '0.1',
                receiptId,
                idempotencyKey: event.idempotencyKey,
                planDigest: event.planDigest,
                outcome,
                reason: event.reason,
                correlationId: event.correlationId,
                createdAt: event.occurredAt,
              }),
            ],
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async find(idempotencyKey: string): Promise<readonly M03ExecutionEvent[]> {
      const result = await pool.query<{ payload: M03ExecutionEvent }>(
        'SELECT payload FROM m03_execution_attempt_events WHERE idempotency_key=$1 ORDER BY occurred_at,event_id',
        [idempotencyKey],
      );
      return result.rows.map((row) => row.payload);
    },
  });
}

export async function listM03PolicyReadModels(pool: Pool): Promise<readonly unknown[]> {
  const result = await pool.query(
    `SELECT p.policy_id,p.environment,p.state,v.policy_version_id,v.version,v.content_hash,v.payload,v.confirmed_at,
       c.actor_ref,c.issuer_ref,c.proof_ref_hash,
       (SELECT e.result FROM m03_trigger_evaluations e WHERE e.policy_version_id=v.policy_version_id ORDER BY e.evaluated_at DESC LIMIT 1) AS latest_evaluation,
       (SELECT e.reason FROM m03_trigger_evaluations e WHERE e.policy_version_id=v.policy_version_id ORDER BY e.evaluated_at DESC LIMIT 1) AS latest_evaluation_reason
     FROM policies p JOIN LATERAL (SELECT pv.* FROM policy_versions pv WHERE pv.policy_id=p.policy_id ORDER BY pv.version DESC LIMIT 1) v ON true
     LEFT JOIN m03_policy_confirmations c ON c.policy_version_id=v.policy_version_id
     ORDER BY p.policy_id,v.version DESC LIMIT 200`,
  );
  return result.rows;
}

export async function listActiveM03PolicyConfirmations(pool: Pool): Promise<readonly unknown[]> {
  const result = await pool.query(
    `SELECT p.policy_id,p.environment,p.state,v.policy_version_id,v.version,v.content_hash,v.payload,v.confirmed_at,
       c.canonical_hash,c.actor_ref,c.issuer_ref,c.proof_ref_hash,c.confirmed_at AS provenance_confirmed_at
     FROM policies p
     JOIN LATERAL (SELECT pv.* FROM policy_versions pv WHERE pv.policy_id=p.policy_id ORDER BY pv.version DESC LIMIT 1) v ON true
     JOIN m03_policy_confirmations c ON c.policy_version_id=v.policy_version_id
     WHERE p.state='ACTIVE' ORDER BY p.policy_id LIMIT 200`,
  );
  return result.rows;
}

export async function appendM03PlanningRefusal(
  pool: Pool,
  input: Readonly<{
    evaluationId: string;
    policyId: string;
    policyVersionHash: string;
    snapshotHash: string;
    reason: string;
    actorRef: string;
    correlationId: string;
    occurredAt: string;
  }>,
): Promise<void> {
  if (
    !/^[0-9a-f]{64}$/.test(input.evaluationId) ||
    !/^[0-9a-f]{64}$/.test(input.policyVersionHash) ||
    !/^[0-9a-f]{64}$/.test(input.snapshotHash)
  )
    throw new TypeError('M03 planning refusal identities must be SHA-256');
  const payload = {
    schemaVersion: '0.1',
    evaluationId: input.evaluationId,
    policyId: input.policyId,
    policyVersionHash: input.policyVersionHash,
    snapshotHash: input.snapshotHash,
    reason: input.reason,
    actorRef: input.actorRef,
    correlationId: input.correlationId,
    occurredAt: input.occurredAt,
  };
  safePayload(payload);
  const eventId = sha256(`${input.evaluationId}:M03_PLAN_REFUSED:${input.reason}`);
  await pool.query(
    `INSERT INTO audit_events (event_id,event_type,actor,subject_id,reason,correlation_id,payload,occurred_at)
     VALUES ($1,'M03_PLAN_REFUSED',$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT (event_id) DO NOTHING`,
    [
      eventId,
      input.actorRef,
      input.policyId,
      input.reason,
      input.correlationId,
      JSON.stringify(payload),
      input.occurredAt,
    ],
  );
}

export async function readM03ExecutionReadModel(
  pool: Pool,
  idempotencyKey?: string,
): Promise<readonly unknown[]> {
  const result = await pool.query(
    `SELECT e.event_id,e.idempotency_key,e.plan_digest,e.state,e.reason,e.correlation_id,e.provider_reference_hash,e.occurred_at,e.payload
     FROM m03_execution_attempt_events e
     WHERE $1::text IS NULL OR e.idempotency_key=$1
     ORDER BY e.occurred_at DESC LIMIT 200`,
    [idempotencyKey ?? null],
  );
  return result.rows;
}

export async function listM03EvaluationReadModels(pool: Pool): Promise<readonly unknown[]> {
  const result = await pool.query(
    `SELECT evaluation_id,policy_version_id,policy_version_hash,snapshot_id,snapshot_hash,result,reason,correlation_id,evaluated_at
     FROM m03_trigger_evaluations ORDER BY evaluated_at DESC LIMIT 200`,
  );
  return result.rows;
}

export async function listM03SimulationReadModels(pool: Pool): Promise<readonly unknown[]> {
  const result = await pool.query(
    `SELECT simulation_id,plan_digest,kind,authority,status,simulator_version,checked_at,expires_at
     FROM m03_simulation_results ORDER BY checked_at DESC LIMIT 200`,
  );
  return result.rows;
}

export async function latestM03EffectAt(
  pool: Pool,
  policyVersionId: string,
): Promise<string | undefined> {
  const result = await pool.query<{ occurred_at: Date }>(
    `SELECT e.occurred_at FROM m03_execution_attempt_events e
     JOIN m03_execution_plans p ON p.digest=e.plan_digest
     WHERE p.policy_version_id=$1 AND e.state IN ('SUBMITTED','CONFIRMED','UNKNOWN','RECOVERY_REQUIRED')
     ORDER BY e.occurred_at DESC LIMIT 1`,
    [policyVersionId],
  );
  return result.rows[0] ? new Date(result.rows[0].occurred_at).toISOString() : undefined;
}
