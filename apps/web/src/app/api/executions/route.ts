import { z } from 'zod';
import { M03ExecutionAuthorizationProofSchema } from '@nerva/contracts';
import {
  appendM03AuthorizationRef,
  consumeM03Nonce,
  createDatabase,
  readM03ExecutionReadModel,
  recordM03ExecutionRefusal,
} from '@nerva/db';
import { loadServerConfig } from '@nerva/config';
import { apiError, apiJson, correlationId, readM03Json } from '../../../server/m03-api.ts';
import {
  createM03ExecutionAuthorizationVerifier,
  hasM03TrustedIssuers,
} from '../../../server/m03-trust.ts';

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

export async function GET(request: Request) {
  const config = loadServerConfig();
  if (!config.databaseUrl)
    return apiJson(
      { schemaVersion: '0.1', status: 'UNAVAILABLE', attempts: [], executionEnabled: false },
      503,
    );
  const key = new URL(request.url).searchParams.get('idempotencyKey') ?? undefined;
  if (key && !/^[0-9a-f]{64}$/.test(key))
    return apiJson(
      { schemaVersion: '0.1', status: 'INVALID', attempts: [], executionEnabled: false },
      400,
    );
  const { pool } = createDatabase(config);
  try {
    const attempts = await readM03ExecutionReadModel(pool, key);
    return apiJson({
      schemaVersion: '0.1',
      status: 'AVAILABLE',
      attempts,
      executionEnabled: false,
    });
  } catch {
    return apiJson(
      { schemaVersion: '0.1', status: 'UNAVAILABLE', attempts: [], executionEnabled: false },
      503,
    );
  } finally {
    await pool.end();
  }
}

export async function POST(request: Request) {
  const body = await readM03Json(request);
  const correlation = correlationId(request, body.ok ? body.value : undefined);
  if (!body.ok)
    return apiError(400, 'INVALID_JSON', 'A bounded JSON body is required.', correlation);
  const parsed = RequestSchema.safeParse(body.value);
  if (!parsed.success)
    return apiError(
      422,
      'EXECUTION_REQUEST_INVALID',
      'The execution request is invalid.',
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
  const config = loadServerConfig();
  if (!config.databaseUrl)
    return apiError(
      503,
      'DATABASE_UNAVAILABLE',
      'Execution refusal evidence cannot be persisted.',
      correlation,
    );
  const { pool } = createDatabase(config);
  try {
    const result = await pool.query<{
      idempotency_key: string;
      digest: string;
      action: string;
      external_effect: boolean;
      environment: string;
      account_id: string;
      position_id: string;
      policy_version_hash: string;
      policy_version_id: string;
      payload: Record<string, unknown>;
    }>(
      `SELECT p.idempotency_key,p.digest,p.action,p.external_effect,p.environment,p.account_id,p.position_id,p.policy_version_hash,p.policy_version_id,p.payload
       FROM m03_execution_plans p WHERE p.digest=$1`,
      [parsed.data.planDigest],
    );
    const plan = result.rows[0];
    if (!plan || plan.idempotency_key !== parsed.data.idempotencyKey)
      return apiError(
        404,
        'PLAN_NOT_FOUND',
        'No persisted plan matches this digest and idempotency key.',
        correlation,
      );
    const policyRow = await pool.query<{ state: string; payload: Record<string, unknown> }>(
      `SELECT p.state,v.payload FROM policies p JOIN policy_versions v ON v.policy_version_id=$1
       WHERE p.policy_id=$2`,
      [plan.policy_version_id, String(plan.payload.policyId)],
    );
    const activePolicy = policyRow.rows[0];
    if (!activePolicy || activePolicy.state !== 'ACTIVE')
      return apiError(
        409,
        'POLICY_NOT_ACTIVE',
        'The policy is paused, revoked or unavailable.',
        correlation,
      );
    const proof = parsed.data.authorizationProof;
    const now = new Date().toISOString();
    const issuedAt = Date.parse(proof.issuedAt);
    const expiresAt = Date.parse(proof.expiresAt);
    const actorId = activePolicy.payload.createdByActorRef;
    if (
      typeof actorId !== 'string' ||
      proof.subject !== actorId ||
      proof.policyHash !== plan.policy_version_hash ||
      proof.planDigest !== parsed.data.planDigest ||
      proof.accountId !== plan.account_id ||
      proof.positionId !== plan.position_id ||
      String(proof.action) !== String(plan.action) ||
      proof.scope.length !== 1 ||
      proof.scope[0] !== proof.action ||
      new Set(proof.scope).size !== proof.scope.length ||
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
        'EXECUTION_AUTHORIZATION_BINDING_INVALID',
        'A fresh actor proof must bind this exact plan and action.',
        correlation,
      );
    const verified = await createM03ExecutionAuthorizationVerifier().verify(proof, {
      actorId,
      policyHash: plan.policy_version_hash,
      planDigest: parsed.data.planDigest,
      accountId: plan.account_id,
      positionId: plan.position_id,
      action: plan.action as 'REDUCE_POSITION' | 'CLOSE_POSITION',
      now,
    });
    if (!verified || verified.issuerId !== proof.issuer || verified.actorId !== actorId)
      return apiError(
        403,
        'EXECUTION_AUTHORIZATION_PROVENANCE_INVALID',
        'The actor issuer proof was not verified.',
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
        'EXECUTION_AUTHORIZATION_REPLAY',
        'The actor proof nonce was already consumed.',
        correlation,
      );
    await appendM03AuthorizationRef(pool, {
      planDigest: plan.digest,
      policyVersionHash: plan.policy_version_hash,
      actorRef: verified.actorId,
      issuerRef: verified.issuerId,
      scope: proof.scope,
      proofRefHash: verified.proofRef,
      verifiedAt: now,
      expiresAt: proof.expiresAt,
    });
    const reason =
      plan.environment !== 'TESTNET' || !plan.external_effect || plan.action === 'NO_ACTION'
        ? 'PLAN_NOT_ELIGIBLE_FOR_TESTNET_EFFECT'
        : 'NO_DOCUMENTED_PROTECTIVE_ONLY_PERPL_SCOPE';
    await recordM03ExecutionRefusal(pool, {
      idempotencyKey: parsed.data.idempotencyKey,
      planDigest: parsed.data.planDigest,
      correlationId: correlation,
      reason,
      occurredAt: new Date().toISOString(),
    });
    return apiJson(
      {
        schemaVersion: '0.1',
        status: 'REFUSED',
        reason,
        correlationId: correlation,
        planDigest: parsed.data.planDigest,
        idempotencyKey: parsed.data.idempotencyKey,
        executionEnabled: false,
      },
      409,
    );
  } catch {
    return apiError(
      503,
      'EXECUTION_REFUSAL_PERSISTENCE_UNAVAILABLE',
      'The refusal could not be durably recorded.',
      correlation,
    );
  } finally {
    await pool.end();
  }
}
