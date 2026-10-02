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
      sql`${table.environment} in ('LOCAL','TESTNET_DEMO','MAINNET_READONLY')`,
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
};
