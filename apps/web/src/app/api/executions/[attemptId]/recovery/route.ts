import { z } from 'zod';
import { M03ExecutionAuthorizationProofSchema } from '@nerva/contracts';
import {
  createDatabase,
  readM03ExecutionReadModel,
  recordM03ExecutionRecoveryRequired,
} from '@nerva/db';
import { loadServerConfig } from '@nerva/config';
import { consumeM03Nonce } from '@nerva/db';
import { apiError, apiJson, correlationId, readM03Json } from '../../../../../server/m03-api.ts';
import {
  createM03ExecutionAuthorizationVerifier,
  hasM03TrustedIssuers,
} from '../../../../../server/m03-trust.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RequestSchema = z
  .object({
    schemaVersion: z.literal('0.1'),
    planDigest: z.string().regex(/^[0-9a-f]{64}$/),
    idempotencyKey: z.string().regex(/^[0-9a-f]{64}$/),
    authorizationProof: M03ExecutionAuthorizationProofSchema,
    correlationId: z.string().min(1).max(200),
  })
  .strict();

export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly attemptId: string }> },
) {
  const body = await readM03Json(request);
  const correlation = correlationId(request, body.ok ? body.value : undefined);
  if (!body.ok)
    return apiError(400, 'INVALID_JSON', 'A bounded JSON body is required.', correlation);
  const parsed = RequestSchema.safeParse(body.value);
  if (!parsed.success)
    return apiError(
      422,
      'RECOVERY_REQUEST_INVALID',
      'The recovery request is invalid.',
      correlation,
    );
  if (parsed.data.correlationId !== correlation)
    return apiError(
      400,
      'CORRELATION_MISMATCH',
      'The body and request correlation identifiers must match.',
      correlation,
    );
  if (!hasM03TrustedIssuers())
    return apiError(
      503,
      'ACTOR_ISSUER_REGISTRY_UNAVAILABLE',
      'No trusted actor issuer keys are configured.',
      correlation,
    );
  const { attemptId } = await context.params;
  if (!/^[0-9a-f]{64}$/.test(attemptId))
    return apiError(400, 'ATTEMPT_ID_INVALID', 'The attempt identifier is invalid.', correlation);
  const config = loadServerConfig();
  if (!config.databaseUrl)
    return apiError(
      503,
      'DATABASE_UNAVAILABLE',
      'Recovery evidence cannot be persisted.',
      correlation,
    );
  const { pool } = createDatabase(config);
  try {
    const planResult = await pool.query<{
      action: string;
      account_id: string;
      position_id: string;
      policy_version_hash: string;
      environment: string;
      network: string;
      chain_id: number;
      policy_state: string;
      policy_payload: Record<string, unknown>;
    }>(
      `SELECT p.action,p.account_id,p.position_id,p.policy_version_hash,p.environment,p.network,p.chain_id,
              pol.state AS policy_state,v.payload AS policy_payload
       FROM m03_execution_plans p
       JOIN policy_versions v ON v.policy_version_id=p.policy_version_id
       JOIN policies pol ON pol.policy_id=v.policy_id
       WHERE p.digest=$1 AND p.idempotency_key=$2`,
      [parsed.data.planDigest, parsed.data.idempotencyKey],
    );
    const plan = planResult.rows[0];
    const proof = parsed.data.authorizationProof;
    const now = new Date().toISOString();
    const actorId = plan?.policy_payload.createdByActorRef;
    const issuedAt = Date.parse(proof.issuedAt);
    const expiresAt = Date.parse(proof.expiresAt);
    if (
      !plan ||
      plan.policy_state !== 'ACTIVE' ||
      plan.environment !== 'TESTNET' ||
      plan.network !== 'monad-testnet' ||
      plan.chain_id !== 10_143 ||
      (plan.action !== 'REDUCE_POSITION' && plan.action !== 'CLOSE_POSITION') ||
      typeof actorId !== 'string' ||
      proof.subject !== actorId ||
      proof.policyHash !== plan.policy_version_hash ||
      proof.planDigest !== parsed.data.planDigest ||
      proof.accountId !== plan.account_id ||
      proof.positionId !== plan.position_id ||
      proof.action !== plan.action ||
      proof.scope.length !== 1 ||
      proof.scope[0] !== proof.action ||
      !Number.isFinite(issuedAt) ||
      !Number.isFinite(expiresAt) ||
      issuedAt > Date.parse(now) ||
      Date.parse(now) - issuedAt > 300_000 ||
      expiresAt <= Date.parse(now) ||
      expiresAt <= issuedAt ||
      expiresAt - issuedAt > 300_000
    )
      return apiError(
        403,
        'RECOVERY_AUTHORIZATION_BINDING_INVALID',
        'A fresh actor proof must bind this exact active testnet plan.',
        correlation,
      );
    const verified = await createM03ExecutionAuthorizationVerifier().verify(proof, {
      actorId,
      policyHash: plan.policy_version_hash,
      planDigest: parsed.data.planDigest,
      accountId: plan.account_id,
      positionId: plan.position_id,
      action: plan.action,
      now,
    });
    if (!verified || verified.actorId !== actorId || verified.issuerId !== proof.issuer)
      return apiError(
        403,
        'RECOVERY_AUTHORIZATION_PROVENANCE_INVALID',
        'The recovery actor proof was not verified.',
        correlation,
      );
    if (
      !(await consumeM03Nonce(pool, {
        issuer: proof.issuer,
        nonce: proof.nonce,
        purpose: 'execution-authorization',
      }))
    )
      return apiError(
        409,
        'RECOVERY_AUTHORIZATION_REPLAY',
        'The recovery actor proof nonce was already consumed.',
        correlation,
      );
    const events = await readM03ExecutionReadModel(pool, parsed.data.idempotencyKey);
    const attempt = events.find((event) => {
      const row = event as Record<string, unknown>;
      return (
        row.event_id === attemptId &&
        row.plan_digest === parsed.data.planDigest &&
        ['SUBMITTED', 'UNKNOWN', 'RECOVERY_REQUIRED'].includes(String(row.state))
      );
    });
    if (!attempt)
      return apiError(
        404,
        'AMBIGUOUS_ATTEMPT_NOT_FOUND',
        'No matching ambiguous attempt is eligible for reconciliation.',
        correlation,
      );
    await recordM03ExecutionRecoveryRequired(pool, {
      attemptEventId: attemptId,
      idempotencyKey: parsed.data.idempotencyKey,
      planDigest: parsed.data.planDigest,
      correlationId: correlation,
      occurredAt: new Date().toISOString(),
    });
    return apiJson(
      {
        schemaVersion: '0.1',
        status: 'RECOVERY_REQUIRED',
        reason: 'READ_ONLY_PROVIDER_RECONCILIATION_UNAVAILABLE_NO_RETRY',
        correlationId: correlation,
        attemptId,
        planDigest: parsed.data.planDigest,
        executionEnabled: false,
      },
      202,
    );
  } catch {
    return apiError(
      503,
      'RECOVERY_PERSISTENCE_UNAVAILABLE',
      'Recovery status could not be durably recorded.',
      correlation,
    );
  } finally {
    await pool.end();
  }
}
