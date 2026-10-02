import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
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
      sql`${table.status} in ('HEALTHY','DEGRADED','STALE','UNKNOWN')`,
    ),
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
};
