import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const policies = pgTable(
  'policies',
  {
    policyId: text('policy_id').primaryKey(),
    environment: text('environment').notNull(),
    state: text('state').notNull().default('DRAFT'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'policies_state_ck',
      sql`${table.state} in ('DRAFT','VALIDATED','USER_CONFIRMED','ACTIVE','PAUSED','REVOKED','EXPIRED')`,
    ),
    check(
      'policies_environment_ck',
      sql`${table.environment} in ('LOCAL','TESTNET_DEMO','TESTNET','MAINNET_READONLY')`,
    ),
  ],
);

export const policyVersions = pgTable(
  'policy_versions',
  {
    policyVersionId: text('policy_version_id').primaryKey(),
    policyId: text('policy_id')
      .notNull()
      .references(() => policies.policyId),
    version: integer('version').notNull(),
    payload: jsonb('payload').notNull(),
    contentHash: text('content_hash').notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('policy_versions_identity_uq').on(table.policyId, table.version),
    uniqueIndex('policy_versions_hash_uq').on(table.contentHash),
    check('policy_versions_version_ck', sql`${table.version} > 0`),
    check('policy_versions_hash_ck', sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const auditEvents = pgTable('audit_events', {
  eventId: text('event_id').primaryKey(),
  eventType: text('event_type').notNull(),
  actor: text('actor').notNull(),
  subjectId: text('subject_id'),
  reason: text('reason').notNull(),
  correlationId: text('correlation_id').notNull(),
  payload: jsonb('payload').notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
});

export const integrationHealthSamples = pgTable(
  'integration_health_samples',
  {
    sampleId: text('sample_id').primaryKey(),
    integration: text('integration').notNull(),
    status: text('status').notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    correlationId: text('correlation_id').notNull(),
    reason: text('reason').notNull(),
  },
  (table) => [
    check(
      'integration_health_status_ck',
      sql`${table.status} in ('HEALTHY','DEGRADED','STALE','UNKNOWN','UNAVAILABLE')`,
    ),
  ],
);

const snapshotColumns = () => ({
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  quality: text('quality').notNull(),
  contentHash: text('content_hash').notNull(),
  correlationId: text('correlation_id').notNull(),
  payload: jsonb('payload').notNull(),
});

export const marketSnapshots = pgTable(
  'market_snapshots',
  {
    snapshotId: text('snapshot_id').primaryKey(),
    marketId: text('market_id').notNull(),
    ...snapshotColumns(),
  },
  (table) => [
    index('market_snapshots_market_time_idx').on(table.marketId, table.observedAt),
    check('market_snapshots_hash_ck', sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    check(
      'market_snapshots_quality_ck',
      sql`${table.quality} in ('FRESH','STALE','UNKNOWN','INCONSISTENT')`,
    ),
  ],
);

export const positionSnapshots = pgTable(
  'position_snapshots',
  {
    snapshotId: text('snapshot_id').primaryKey(),
    positionId: text('position_id').notNull(),
    marketId: text('market_id').notNull(),
    ...snapshotColumns(),
  },
  (table) => [
    index('position_snapshots_position_time_idx').on(table.positionId, table.observedAt),
    check('position_snapshots_hash_ck', sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    check(
      'position_snapshots_quality_ck',
      sql`${table.quality} in ('FRESH','STALE','UNKNOWN','INCONSISTENT')`,
    ),
  ],
);

export const portfolioSnapshots = pgTable(
  'portfolio_snapshots',
  { snapshotId: text('snapshot_id').primaryKey(), ...snapshotColumns() },
  (table) => [
    index('portfolio_snapshots_time_idx').on(table.observedAt),
    check('portfolio_snapshots_hash_ck', sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    check(
      'portfolio_snapshots_quality_ck',
      sql`${table.quality} in ('FRESH','STALE','UNKNOWN','INCONSISTENT')`,
    ),
  ],
);

export const riskSnapshots = pgTable(
  'risk_snapshots',
  {
    snapshotId: text('snapshot_id').primaryKey(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
    quality: text('quality').notNull(),
    actionable: boolean('actionable').notNull().default(false),
    contentHash: text('content_hash').notNull(),
    correlationId: text('correlation_id').notNull(),
    sourceSnapshotHashes: text('source_snapshot_hashes').array().notNull(),
    payload: jsonb('payload').notNull(),
  },
  (table) => [
    index('risk_snapshots_time_idx').on(table.generatedAt),
    check('risk_snapshots_hash_ck', sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    check(
      'risk_snapshots_quality_ck',
      sql`${table.quality} in ('FRESH','STALE','UNKNOWN','INCONSISTENT')`,
    ),
    check('risk_snapshots_actionable_ck', sql`${table.actionable} = false`),
  ],
);

export const riskMetrics = pgTable(
  'risk_metrics',
  {
    metricId: text('metric_id').primaryKey(),
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => riskSnapshots.snapshotId),
    name: text('name').notNull(),
    value: text('value'),
    valueBps: integer('value_bps'),
    quality: text('quality').notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    payload: jsonb('payload').notNull(),
  },
  (table) => [
    index('risk_metrics_snapshot_idx').on(table.snapshotId, table.name),
    check(
      'risk_metrics_quality_ck',
      sql`${table.quality} in ('FRESH','STALE','UNKNOWN','INCONSISTENT')`,
    ),
    check(
      'risk_metrics_bps_ck',
      sql`${table.valueBps} is null or ${table.valueBps} between 0 and 10000`,
    ),
  ],
);

export const providerCheckpoints = pgTable(
  'provider_checkpoints',
  {
    provider: text('provider').notNull(),
    stream: text('stream').notNull(),
    chainId: integer('chain_id').notNull(),
    sessionId: text('session_id'),
    sequence: text('sequence'),
    sourceBlock: text('source_block'),
    quality: text('quality').notNull(),
    reconnectCount: integer('reconnect_count').notNull().default(0),
    reason: text('reason'),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('provider_checkpoints_identity_uq').on(table.provider, table.stream, table.chainId),
    check('provider_checkpoints_chain_ck', sql`${table.chainId} in (143,10143)`),
    check(
      'provider_checkpoints_quality_ck',
      sql`${table.quality} in ('FRESH','STALE','UNKNOWN','INCONSISTENT')`,
    ),
    check('provider_checkpoints_reconnect_ck', sql`${table.reconnectCount} >= 0`),
  ],
);

export const runtimeControls = pgTable('runtime_controls', {
  controlKey: text('control_key').primaryKey(),
  enabled: boolean('enabled').notNull().default(true),
  reason: text('reason').notNull(),
  actor: text('actor').notNull(),
  source: text('source').notNull(),
  correlationId: text('correlation_id').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const m03PolicyConfirmations = pgTable(
  'm03_policy_confirmations',
  {
    policyVersionId: text('policy_version_id')
      .primaryKey()
      .references(() => policyVersions.policyVersionId),
    canonicalHash: text('canonical_hash').notNull(),
    actorRef: text('actor_ref').notNull(),
    issuerRef: text('issuer_ref').notNull(),
    proofRefHash: text('proof_ref_hash').notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    check('m03_policy_confirmations_hash_ck', sql`${table.canonicalHash} ~ '^[0-9a-f]{64}$'`),
    check('m03_policy_confirmations_proof_ck', sql`${table.proofRefHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const m03PolicyLifecycleEvents = pgTable(
  'm03_policy_lifecycle_events',
  {
    eventId: text('event_id').primaryKey(),
    policyVersionId: text('policy_version_id')
      .notNull()
      .references(() => policyVersions.policyVersionId),
    eventType: text('event_type').notNull(),
    actorRef: text('actor_ref').notNull(),
    issuerRef: text('issuer_ref').notNull(),
    proofRefHash: text('proof_ref_hash').notNull(),
    correlationId: text('correlation_id').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    payload: jsonb('payload').notNull(),
  },
  (table) => [
    index('m03_policy_lifecycle_events_version_idx').on(table.policyVersionId, table.occurredAt),
    check(
      'm03_policy_lifecycle_events_type_ck',
      sql`${table.eventType} in ('CONFIRMED','PAUSED','REVOKED','EXPIRED')`,
    ),
    check('m03_policy_lifecycle_events_proof_ck', sql`${table.proofRefHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const m03TriggerEvaluations = pgTable(
  'm03_trigger_evaluations',
  {
    evaluationId: text('evaluation_id').primaryKey(),
    policyVersionId: text('policy_version_id')
      .notNull()
      .references(() => policyVersions.policyVersionId),
    policyVersionHash: text('policy_version_hash').notNull(),
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => riskSnapshots.snapshotId),
    snapshotHash: text('snapshot_hash').notNull(),
    result: text('result').notNull(),
    reason: text('reason').notNull(),
    correlationId: text('correlation_id').notNull(),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull(),
    payload: jsonb('payload').notNull(),
  },
  (table) => [
    index('m03_trigger_evaluations_version_time_idx').on(table.policyVersionId, table.evaluatedAt),
    check(
      'm03_trigger_evaluations_policy_hash_ck',
      sql`${table.policyVersionHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      'm03_trigger_evaluations_snapshot_hash_ck',
      sql`${table.snapshotHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      'm03_trigger_evaluations_result_ck',
      sql`${table.result} in ('MATCH','NO_MATCH','REFUSED')`,
    ),
  ],
);

export const m03ExecutionPlans = pgTable(
  'm03_execution_plans',
  {
    planId: text('plan_id').primaryKey(),
    digest: text('digest').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    policyVersionId: text('policy_version_id')
      .notNull()
      .references(() => policyVersions.policyVersionId),
    policyVersionHash: text('policy_version_hash').notNull(),
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => riskSnapshots.snapshotId),
    snapshotHash: text('snapshot_hash').notNull(),
    accountId: text('account_id').notNull(),
    positionId: text('position_id').notNull(),
    marketSelector: text('market_selector').notNull(),
    action: text('action').notNull(),
    quantityScaled: text('quantity_scaled').notNull(),
    notionalMicros: text('notional_micros').notNull(),
    slippageBps: integer('slippage_bps').notNull(),
    environment: text('environment').notNull(),
    network: text('network').notNull(),
    chainId: integer('chain_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    correlationId: text('correlation_id').notNull(),
    externalEffect: boolean('external_effect').notNull(),
    payload: jsonb('payload').notNull(),
  },
  (table) => [
    uniqueIndex('m03_execution_plans_digest_uq').on(table.digest),
    uniqueIndex('m03_execution_plans_idempotency_uq').on(table.idempotencyKey),
    index('m03_execution_plans_policy_idx').on(table.policyVersionId, table.createdAt),
    check('m03_execution_plans_digest_ck', sql`${table.digest} ~ '^[0-9a-f]{64}$'`),
    check('m03_execution_plans_policy_hash_ck', sql`${table.policyVersionHash} ~ '^[0-9a-f]{64}$'`),
    check('m03_execution_plans_snapshot_hash_ck', sql`${table.snapshotHash} ~ '^[0-9a-f]{64}$'`),
    check(
      'm03_execution_plans_action_ck',
      sql`${table.action} in ('REDUCE_POSITION','CLOSE_POSITION','NO_ACTION')`,
    ),
    check(
      'm03_execution_plans_environment_ck',
      sql`${table.environment} in ('LOCAL','TESTNET_DEMO','TESTNET','MAINNET_READONLY')`,
    ),
    check(
      'm03_execution_plans_network_ck',
      sql`(${table.environment} = 'LOCAL' and ${table.network} = 'local' and ${table.chainId} = 0) or (${table.environment} in ('TESTNET_DEMO','TESTNET') and ${table.network} = 'monad-testnet' and ${table.chainId} = 10143) or (${table.environment} = 'MAINNET_READONLY' and ${table.network} = 'monad-mainnet' and ${table.chainId} = 143)`,
    ),
    check(
      'm03_execution_plans_quantity_ck',
      sql`${table.quantityScaled} ~ '^(0|[1-9][0-9]{0,37})$'`,
    ),
    check(
      'm03_execution_plans_notional_ck',
      sql`${table.notionalMicros} ~ '^(0|[1-9][0-9]{0,37})$'`,
    ),
    check('m03_execution_plans_slippage_ck', sql`${table.slippageBps} between 0 and 10000`),
    check(
      'm03_execution_plans_mainnet_no_effect_ck',
      sql`${table.environment} <> 'MAINNET_READONLY' or (${table.action} = 'NO_ACTION' and ${table.externalEffect} = false)`,
    ),
    check(
      'm03_execution_plans_demo_no_effect_ck',
      sql`${table.environment} <> 'TESTNET_DEMO' or ${table.externalEffect} = false`,
    ),
  ],
);

export const m03SimulationResults = pgTable(
  'm03_simulation_results',
  {
    simulationId: text('simulation_id').primaryKey(),
    planDigest: text('plan_digest')
      .notNull()
      .references(() => m03ExecutionPlans.digest),
    kind: text('kind').notNull(),
    authority: text('authority').notNull(),
    status: text('status').notNull(),
    simulatorVersion: text('simulator_version').notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    payload: jsonb('payload').notNull(),
  },
  (table) => [
    index('m03_simulation_results_plan_idx').on(table.planDigest, table.checkedAt),
    check(
      'm03_simulation_results_kind_ck',
      sql`${table.kind} in ('DETERMINISTIC_DRY_RUN','PROVIDER_TESTNET_PREFLIGHT')`,
    ),
    check(
      'm03_simulation_results_authority_ck',
      sql`${table.authority} in ('DRY_RUN_ONLY','PROVIDER_TESTNET_VERIFIED')`,
    ),
    check('m03_simulation_results_status_ck', sql`${table.status} in ('PASS','FAIL','UNKNOWN')`),
  ],
);

export const m03AuthorizationRefs = pgTable(
  'm03_authorization_refs',
  {
    authorizationRef: text('authorization_ref').primaryKey(),
    planDigest: text('plan_digest')
      .notNull()
      .references(() => m03ExecutionPlans.digest),
    policyVersionHash: text('policy_version_hash').notNull(),
    actorRef: text('actor_ref').notNull(),
    issuerRef: text('issuer_ref').notNull(),
    scope: text('scope').notNull(),
    proofRefHash: text('proof_ref_hash').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('m03_authorization_refs_plan_uq').on(table.planDigest),
    check(
      'm03_authorization_refs_policy_hash_ck',
      sql`${table.policyVersionHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check('m03_authorization_refs_proof_hash_ck', sql`${table.proofRefHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const m03ProviderEnrollmentRefs = pgTable(
  'm03_provider_enrollment_refs',
  {
    enrollmentRef: text('enrollment_ref').primaryKey(),
    provider: text('provider').notNull(),
    accountId: text('account_id').notNull(),
    network: text('network').notNull(),
    chainId: integer('chain_id').notNull(),
    capabilityRef: text('capability_ref').notNull(),
    capabilityEvidenceHash: text('capability_evidence_hash').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('m03_provider_enrollment_scope_uq').on(
      table.provider,
      table.accountId,
      table.network,
      table.capabilityRef,
    ),
    check('m03_provider_enrollment_provider_ck', sql`${table.provider} = 'perpl'`),
    check(
      'm03_provider_enrollment_testnet_ck',
      sql`${table.network} = 'monad-testnet' and ${table.chainId} = 10143`,
    ),
    check(
      'm03_provider_enrollment_evidence_ck',
      sql`${table.capabilityEvidenceHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const m03NonceLedger = pgTable(
  'm03_nonce_ledger',
  {
    nonceHash: text('nonce_hash').primaryKey(),
    issuerRef: text('issuer_ref').notNull(),
    purpose: text('purpose').notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('m03_nonce_ledger_hash_ck', sql`${table.nonceHash} ~ '^[0-9a-f]{64}$'`),
    check(
      'm03_nonce_ledger_purpose_ck',
      sql`${table.purpose} in ('policy-confirmation','execution-authorization','provider-enrollment','policy-control')`,
    ),
  ],
);

export const m03ExecutionIdempotency = pgTable(
  'm03_execution_idempotency',
  {
    idempotencyKey: text('idempotency_key').primaryKey(),
    provider: text('provider').notNull(),
    network: text('network').notNull(),
    chainId: integer('chain_id').notNull(),
    accountId: text('account_id').notNull(),
    planDigest: text('plan_digest').notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('m03_execution_idempotency_provider_ck', sql`${table.provider} = 'perpl'`),
    check(
      'm03_execution_idempotency_testnet_ck',
      sql`${table.network} = 'monad-testnet' and ${table.chainId} = 10143`,
    ),
    check('m03_execution_idempotency_digest_ck', sql`${table.planDigest} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const m03ExecutionAttemptEvents = pgTable(
  'm03_execution_attempt_events',
  {
    eventId: text('event_id').primaryKey(),
    idempotencyKey: text('idempotency_key').notNull(),
    planDigest: text('plan_digest').notNull(),
    state: text('state').notNull(),
    reason: text('reason').notNull(),
    correlationId: text('correlation_id').notNull(),
    providerReferenceHash: text('provider_reference_hash'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    payload: jsonb('payload').notNull(),
  },
  (table) => [
    index('m03_execution_attempt_events_key_idx').on(table.idempotencyKey, table.occurredAt),
    check('m03_execution_attempt_events_digest_ck', sql`${table.planDigest} ~ '^[0-9a-f]{64}$'`),
    check(
      'm03_execution_attempt_events_state_ck',
      sql`${table.state} in ('NOT_STARTED','PREFLIGHTED','AUTHORIZED','SUBMITTED','CONFIRMED','REFUSED','FAILED','UNKNOWN','RECOVERY_REQUIRED')`,
    ),
    check(
      'm03_execution_attempt_events_provider_hash_ck',
      sql`${table.providerReferenceHash} is null or ${table.providerReferenceHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const m03ExecutionReceipts = pgTable(
  'm03_execution_receipts',
  {
    receiptId: text('receipt_id').primaryKey(),
    idempotencyKey: text('idempotency_key').notNull(),
    planDigest: text('plan_digest').notNull(),
    outcome: text('outcome').notNull(),
    reason: text('reason').notNull(),
    correlationId: text('correlation_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    payload: jsonb('payload').notNull(),
  },
  (table) => [
    index('m03_execution_receipts_key_idx').on(table.idempotencyKey, table.createdAt),
    check('m03_execution_receipts_digest_ck', sql`${table.planDigest} ~ '^[0-9a-f]{64}$'`),
    check(
      'm03_execution_receipts_outcome_ck',
      sql`${table.outcome} in ('CONFIRMED','NO_ACTION','REFUSED','FAILED','UNKNOWN','RECOVERY_REQUIRED')`,
    ),
  ],
);

export const m04WalletBindings = pgTable(
  'm04_wallet_bindings',
  {
    bindingId: text('binding_id').primaryKey(),
    accountId: text('account_id').notNull(),
    chainId: integer('chain_id').notNull(),
    network: text('network').notNull(),
    walletAddress: text('wallet_address').notNull(),
    providerId: text('provider_id').notNull(),
    eventType: text('event_type').notNull(),
    generation: integer('generation').notNull(),
    provenanceHash: text('provenance_hash').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('m04_wallet_binding_generation_uq').on(
      table.chainId,
      table.walletAddress,
      table.generation,
    ),
    uniqueIndex('m04_wallet_binding_account_generation_uq').on(
      table.chainId,
      table.accountId,
      table.generation,
    ),
    check('m04_wallet_binding_chain_ck', sql`${table.chainId} = 10143`),
    check('m04_wallet_binding_network_ck', sql`${table.network} = 'monad-testnet'`),
    check('m04_wallet_binding_provider_ck', sql`${table.providerId} = 'eip712-compatible-wallet'`),
    check('m04_wallet_binding_event_ck', sql`${table.eventType} in ('BOUND','UNBOUND')`),
    check('m04_wallet_binding_generation_ck', sql`${table.generation} > 0`),
    check('m04_wallet_binding_provenance_ck', sql`${table.provenanceHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const m04AgentIdentities = pgTable(
  'm04_agent_identities',
  {
    agentIdentityId: text('agent_identity_id').primaryKey(),
    agentId: text('agent_id').notNull(),
    version: integer('version').notNull(),
    issuerId: text('issuer_id').notNull(),
    provenanceHash: text('provenance_hash').notNull(),
    chainId: integer('chain_id').notNull(),
    walletAddress: text('wallet_address').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('m04_agent_identity_version_uq').on(table.agentId, table.version),
    check('m04_agent_identity_version_ck', sql`${table.version} > 0`),
    check('m04_agent_identity_chain_ck', sql`${table.chainId} = 10143`),
    check('m04_agent_identity_provenance_ck', sql`${table.provenanceHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const m04CapabilityGrants = pgTable(
  'm04_capability_grants',
  {
    grantId: text('grant_id').primaryKey(),
    grantHash: text('grant_hash').notNull(),
    accountId: text('account_id').notNull(),
    walletAddress: text('wallet_address').notNull(),
    agentId: text('agent_id').notNull(),
    agentVersion: integer('agent_version').notNull(),
    chainId: integer('chain_id').notNull(),
    policyHash: text('policy_hash').notNull(),
    scope: jsonb('scope').notNull(),
    actions: jsonb('actions').notNull(),
    limits: jsonb('limits').notNull(),
    grantDocument: jsonb('grant_document').notNull(),
    nonceDomainHash: text('nonce_domain_hash').notNull(),
    delegationObservationHash: text('delegation_observation_hash').notNull(),
    grantApprovalRefHash: text('grant_approval_ref_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('m04_capability_grant_hash_uq').on(table.grantHash),
    uniqueIndex('m04_capability_nonce_domain_uq').on(table.nonceDomainHash),
    check('m04_capability_grant_chain_ck', sql`${table.chainId} = 10143`),
    check('m04_capability_grant_action_ck', sql`jsonb_typeof(${table.actions}) = 'array'`),
    check('m04_capability_grant_limits_ck', sql`jsonb_typeof(${table.limits}) = 'object'`),
    check('m04_capability_grant_scope_ck', sql`jsonb_typeof(${table.scope}) = 'object'`),
    check('m04_capability_grant_expiry_ck', sql`${table.expiresAt} > ${table.createdAt}`),
    check('m04_capability_grant_hash_ck', sql`${table.grantHash} ~ '^[0-9a-f]{64}$'`),
    check('m04_capability_policy_hash_ck', sql`${table.policyHash} ~ '^[0-9a-f]{64}$'`),
    check('m04_capability_nonce_domain_hash_ck', sql`${table.nonceDomainHash} ~ '^[0-9a-f]{64}$'`),
    check(
      'm04_capability_delegate_observation_ck',
      sql`${table.delegationObservationHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      'm04_capability_grant_approval_ck',
      sql`${table.grantApprovalRefHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const m04AuthorityStates = pgTable(
  'm04_authority_states',
  {
    grantId: text('grant_id')
      .primaryKey()
      .references(() => m04CapabilityGrants.grantId),
    generation: integer('generation').notNull().default(0),
    revoked: boolean('revoked').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('m04_authority_generation_ck', sql`${table.generation} >= 0`)],
);

export const m04Sessions = pgTable(
  'm04_sessions',
  {
    sessionId: text('session_id').primaryKey(),
    grantId: text('grant_id')
      .notNull()
      .references(() => m04CapabilityGrants.grantId),
    sessionHash: text('session_hash').notNull(),
    nonceDomainHash: text('nonce_domain_hash').notNull(),
    actions: jsonb('actions').notNull(),
    limits: jsonb('limits').notNull(),
    issuanceProofRefHash: text('issuance_proof_ref_hash'),
    issuanceTypedDataDigest: text('issuance_typed_data_digest'),
    issuanceNonceHash: text('issuance_nonce_hash'),
    revocationGeneration: integer('revocation_generation'),
    delegationObservationHash: text('delegation_observation_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('m04_session_hash_uq').on(table.sessionHash),
    uniqueIndex('m04_session_nonce_domain_uq').on(table.nonceDomainHash),
    check('m04_session_hash_ck', sql`${table.sessionHash} ~ '^[0-9a-f]{64}$'`),
    check('m04_session_domain_hash_ck', sql`${table.nonceDomainHash} ~ '^[0-9a-f]{64}$'`),
    check('m04_session_expiry_ck', sql`${table.expiresAt} > ${table.createdAt}`),
    check('m04_session_actions_ck', sql`jsonb_typeof(${table.actions}) = 'array'`),
    check('m04_session_limits_ck', sql`jsonb_typeof(${table.limits}) = 'object'`),
    check(
      'm04_session_issuance_proof_hash_ck',
      sql`${table.issuanceProofRefHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      'm04_session_issuance_typed_hash_ck',
      sql`${table.issuanceTypedDataDigest} ~ '^[0-9a-f]{64}$'`,
    ),
    check('m04_session_issuance_nonce_hash_ck', sql`${table.issuanceNonceHash} ~ '^[0-9a-f]{64}$'`),
    check('m04_session_revocation_generation_ck', sql`${table.revocationGeneration} >= 0`),
    check(
      'm04_session_delegation_hash_ck',
      sql`${table.delegationObservationHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const m04SessionRevocations = pgTable(
  'm04_session_revocations',
  {
    sessionId: text('session_id')
      .primaryKey()
      .references(() => m04Sessions.sessionId),
    generation: integer('generation').notNull(),
    actorRef: text('actor_ref').notNull(),
    proofRefHash: text('proof_ref_hash').notNull(),
    nonceHash: text('nonce_hash').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('m04_session_revocation_generation_uq').on(table.sessionId, table.generation),
    check('m04_session_revocation_generation_ck', sql`${table.generation} = 1`),
    check('m04_session_revocation_actor_ck', sql`${table.actorRef} <> ''`),
    check('m04_session_revocation_proof_ck', sql`${table.proofRefHash} ~ '^[0-9a-f]{64}$'`),
    check('m04_session_revocation_nonce_ck', sql`${table.nonceHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const m04NonceLedger = pgTable(
  'm04_nonce_ledger',
  {
    nonceHash: text('nonce_hash').primaryKey(),
    chainId: integer('chain_id').notNull(),
    accountId: text('account_id').notNull(),
    walletAddress: text('wallet_address').notNull(),
    agentId: text('agent_id').notNull(),
    grantId: text('grant_id').references(() => m04CapabilityGrants.grantId),
    operation: text('operation').notNull(),
    domainHash: text('domain_hash').notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('m04_nonce_chain_ck', sql`${table.chainId} = 10143`),
    check(
      'm04_nonce_operation_ck',
      sql`${table.operation} in ('WALLET_BINDING','AGENT_IDENTITY','GRANT_APPROVAL','AUTHORIZATION','SESSION','REVOCATION','READ_ACCESS')`,
    ),
    check(
      'm04_nonce_grant_ck',
      sql`${table.operation} in ('WALLET_BINDING','AGENT_IDENTITY','GRANT_APPROVAL','READ_ACCESS') or ${table.grantId} is not null`,
    ),
    check('m04_nonce_hash_ck', sql`${table.nonceHash} ~ '^[0-9a-f]{64}$'`),
    check('m04_nonce_domain_hash_ck', sql`${table.domainHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const m04AuthorizationRefs = pgTable(
  'm04_authorization_refs',
  {
    authorizationRef: text('authorization_ref').primaryKey(),
    grantId: text('grant_id')
      .notNull()
      .references(() => m04CapabilityGrants.grantId),
    proofRefHash: text('proof_ref_hash').notNull(),
    typedDataDigest: text('typed_data_digest').notNull(),
    authorizationNonceHash: text('authorization_nonce_hash'),
    planDigest: text('plan_digest').notNull(),
    action: text('action').notNull(),
    verifiedSigner: text('verified_signer').notNull(),
    sessionId: text('session_id').references(() => m04Sessions.sessionId),
    sessionHash: text('session_hash'),
    revocationGeneration: integer('revocation_generation').notNull(),
    delegationObservationHash: text('delegation_observation_hash').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('m04_authorization_digest_uq').on(table.typedDataDigest),
    check(
      'm04_authorization_action_ck',
      sql`${table.action} in ('REDUCE_POSITION','CLOSE_POSITION','NO_ACTION')`,
    ),
    check('m04_authorization_proof_hash_ck', sql`${table.proofRefHash} ~ '^[0-9a-f]{64}$'`),
    check('m04_authorization_typed_hash_ck', sql`${table.typedDataDigest} ~ '^[0-9a-f]{64}$'`),
    check(
      'm04_authorization_nonce_hash_ck',
      sql`${table.authorizationNonceHash} is null or ${table.authorizationNonceHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check('m04_authorization_plan_hash_ck', sql`${table.planDigest} ~ '^[0-9a-f]{64}$'`),
    check('m04_authorization_generation_ck', sql`${table.revocationGeneration} >= 0`),
    check(
      'm04_authorization_session_pair_ck',
      sql`(${table.sessionId} is null and ${table.sessionHash} is null) or (${table.sessionId} is not null and ${table.sessionHash} ~ '^[0-9a-f]{64}$')`,
    ),
    check(
      'm04_authorization_delegation_hash_ck',
      sql`${table.delegationObservationHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const m04DelegationObservations = pgTable(
  'm04_delegation_observations',
  {
    observationId: text('observation_id').primaryKey(),
    accountId: text('account_id').notNull(),
    walletAddress: text('wallet_address').notNull(),
    chainId: integer('chain_id').notNull(),
    status: text('status').notNull(),
    delegateAddress: text('delegate_address'),
    delegateCodeHash: text('delegate_code_hash'),
    blockNumber: text('block_number'),
    blockHash: text('block_hash'),
    observationHash: text('observation_hash').notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('m04_delegation_account_idx').on(table.chainId, table.walletAddress, table.observedAt),
    check('m04_delegation_chain_ck', sql`${table.chainId} = 10143`),
    check(
      'm04_delegation_status_ck',
      sql`${table.status} in ('ABSENT','ACTIVE','CHANGED','REVOKED','UNKNOWN')`,
    ),
    check('m04_delegation_observation_hash_ck', sql`${table.observationHash} ~ '^[0-9a-f]{64}$'`),
    check(
      'm04_delegation_active_ck',
      sql`${table.status} <> 'ACTIVE' or (${table.delegateAddress} is not null and ${table.delegateCodeHash} ~ '^[0-9a-f]{64}$' and ${table.blockHash} ~ '^0x[0-9a-f]{64}$')`,
    ),
  ],
);

export const m04Revocations = pgTable(
  'm04_revocations',
  {
    revocationId: text('revocation_id').primaryKey(),
    grantId: text('grant_id')
      .notNull()
      .references(() => m04CapabilityGrants.grantId),
    generation: integer('generation').notNull(),
    actorRef: text('actor_ref').notNull(),
    reasonCode: text('reason_code').notNull(),
    proofRefHash: text('proof_ref_hash').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('m04_revocation_generation_uq').on(table.grantId, table.generation),
    check('m04_revocation_generation_ck', sql`${table.generation} > 0`),
    check('m04_revocation_reason_ck', sql`${table.reasonCode} ~ '^[A-Z0-9_]{1,100}$'`),
    check('m04_revocation_proof_hash_ck', sql`${table.proofRefHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const m04PermissionEvidence = pgTable(
  'm04_permission_evidence',
  {
    sequence: integer('sequence').primaryKey(),
    eventId: text('event_id').notNull(),
    previousHash: text('previous_hash').notNull(),
    entryHash: text('entry_hash').notNull(),
    event: jsonb('event').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('m04_permission_evidence_id_uq').on(table.eventId),
    uniqueIndex('m04_permission_evidence_hash_uq').on(table.entryHash),
    check('m04_permission_evidence_previous_ck', sql`${table.previousHash} ~ '^[0-9a-f]{64}$'`),
    check('m04_permission_evidence_entry_ck', sql`${table.entryHash} ~ '^[0-9a-f]{64}$'`),
    check('m04_permission_evidence_event_ck', sql`jsonb_typeof(${table.event}) = 'object'`),
  ],
);

export const m04PermissionEvidenceHead = pgTable(
  'm04_permission_evidence_head',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    lastSequence: integer('last_sequence').notNull().default(0),
    lastHash: text('last_hash')
      .notNull()
      .default('0000000000000000000000000000000000000000000000000000000000000000'),
  },
  (table) => [
    check('m04_permission_evidence_singleton_ck', sql`${table.singleton} = true`),
    check('m04_permission_evidence_sequence_ck', sql`${table.lastSequence} >= 0`),
    check('m04_permission_evidence_head_hash_ck', sql`${table.lastHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const schema = {
  policies,
  policyVersions,
  auditEvents,
  integrationHealthSamples,
  runtimeControls,
  marketSnapshots,
  positionSnapshots,
  portfolioSnapshots,
  riskSnapshots,
  riskMetrics,
  providerCheckpoints,
  m03PolicyConfirmations,
  m03PolicyLifecycleEvents,
  m03TriggerEvaluations,
  m03ExecutionPlans,
  m03SimulationResults,
  m03AuthorizationRefs,
  m03ProviderEnrollmentRefs,
  m03NonceLedger,
  m03ExecutionIdempotency,
  m03ExecutionAttemptEvents,
  m03ExecutionReceipts,
  m04WalletBindings,
  m04AgentIdentities,
  m04CapabilityGrants,
  m04AuthorityStates,
  m04Sessions,
  m04SessionRevocations,
  m04NonceLedger,
  m04AuthorizationRefs,
  m04DelegationObservations,
  m04Revocations,
  m04PermissionEvidence,
  m04PermissionEvidenceHead,
};
