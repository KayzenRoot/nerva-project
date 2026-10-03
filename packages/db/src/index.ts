import { Pool, type PoolClient, type QueryResult } from 'pg';
import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ServerConfig } from '@nerva/config';
import { schema } from './schema.ts';
export {
  appendM04PermissionEvidence,
  consumeM04ReadAccess,
  consumeM04Nonce,
  listM04PermissionReadModel,
  isM04WalletBound,
  latestM04DelegationObservation,
  listM04PermissionEvidence,
  loadM04CompiledGrant,
  loadCurrentM04Wallet,
  loadCurrentM04Identities,
  loadCurrentM04IdentitiesByAgent,
  loadM04GrantMaterial,
  loadM04SessionForRevocation,
  persistM04Authorization,
  persistM04DelegationObservation,
  persistM04CapabilityGrant,
  persistM04Session,
  recordM04AgentIdentity,
  recordM04WalletBinding,
  unbindM04Wallet,
  recordM04M03BoundaryDecision,
  revokeM04Grant,
  revokeM04Session,
  runWithCurrentM04Authority,
  validateM04AuthorizationRef,
  verifyM04PermissionEvidence,
} from './m04.ts';

export {
  schema,
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
} from './schema.ts';
export type {
  WalletIdentity,
  AgentIdentity,
  PermissionEvidenceInput,
  PermissionEvidenceRecord,
  CompiledCapabilityGrant,
  SessionAuthority,
} from '@nerva/permissions';
export {
  appendIntegrationHealth,
  appendMarketSnapshot,
  appendPortfolioSnapshot,
  appendPositionSnapshot,
  appendRiskSnapshot,
  latestIntegrationHealth,
  latestMarketSnapshots,
  latestPositionSnapshot,
  latestPositionSnapshots,
  latestProviderCheckpoints,
  latestRiskSnapshot,
  metricsForPosition,
  upsertProviderCheckpoint,
} from './observations.ts';
export {
  appendM03DryRun,
  appendM03ExecutionPlan,
  appendM03AuthorizationRef,
  recordM03ExecutionRefusal,
  recordM03ExecutionRecoveryRequired,
  appendM03PolicyConfirmation,
  appendM03PolicyLifecycleEvent,
  appendM03TriggerEvaluation,
  createPgM03ExecutionStore,
  listM03PolicyReadModels,
  listM03EvaluationReadModels,
  listM03SimulationReadModels,
  readM03ExecutionReadModel,
  consumeM03Nonce,
  runM03IfExecutionEnabled,
  setM03ExecutionDisabled,
  latestM03EffectAt,
  listActiveM03PolicyConfirmations,
  appendM03PlanningRefusal,
} from './m03.ts';
export type Database = NodePgDatabase<typeof schema>;

export function createDatabase(config: Pick<ServerConfig, 'databaseUrl'>): {
  pool: Pool;
  db: Database;
} {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is required for database access');
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return { pool, db: drizzle(pool, { schema }) };
}

export async function withTransaction<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const value = await operation(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function databaseHealth(
  pool: Pool,
): Promise<{ status: 'HEALTHY' | 'UNKNOWN'; checkedAt: string }> {
  try {
    const result: QueryResult = await pool.query('SELECT 1 AS healthy');
    return {
      status: result.rows[0]?.healthy === 1 ? 'HEALTHY' : 'UNKNOWN',
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return { status: 'UNKNOWN', checkedAt: new Date().toISOString() };
  }
}

/** Missing or unavailable runtime control is interpreted as execution disabled. */
export async function readGlobalExecutionDisabled(db: Database): Promise<boolean> {
  const rows = await db
    .select({ enabled: schema.runtimeControls.enabled })
    .from(schema.runtimeControls)
    .where(eq(schema.runtimeControls.controlKey, 'GLOBAL_EXECUTION_DISABLED'))
    .limit(1);
  return rows[0]?.enabled ?? true;
}
