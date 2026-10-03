import {
  appendM03AuthorizationRef,
  consumeM03Nonce,
  createDatabase,
  readM03ExecutionReadModel,
  recordM03ExecutionRefusal,
  recordM04M03BoundaryDecision,
  validateM04AuthorizationRef,
} from '@nerva/db';
import { loadServerConfig } from '@nerva/config';
import {
  apiError,
  apiJson,
  M03ExecutionRequestSchema as RequestSchema,
  parseM03Request,
  trustedM03IssuerUnavailable,
  withM03Database,
} from '../../../server/m03-api.ts';
import { createM03ExecutionAuthorizationVerifier } from '../../../server/m03-trust.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const parsed = await parseM03Request(request, RequestSchema, {
    code: 'EXECUTION_REQUEST_INVALID',
    message: 'The execution request is invalid.',
  });
  if (!parsed.ok) return parsed.response;
  const correlation = parsed.correlationId;
  const issuerError = trustedM03IssuerUnavailable(correlation);
  if (issuerError) return issuerError;
  return withM03Database(
    {
      correlationId: correlation,
      unavailable: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Execution refusal evidence cannot be persisted.',
      },
      failure: {
        code: 'EXECUTION_REFUSAL_PERSISTENCE_UNAVAILABLE',
        message: 'The refusal could not be durably recorded.',
      },
    },
    async (pool) => {
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
      const m03ActorId = activePolicy.payload.createdByActorRef;
      const m04AuthorizationValid = await validateM04AuthorizationRef(pool, {
        authorizationRef: parsed.data.m04AuthorizationRef,
        planDigest: plan.digest,
        action: plan.action,
        now: new Date().toISOString(),
        agentId: typeof m03ActorId === 'string' ? m03ActorId : undefined,
      });
      if (!m04AuthorizationValid) {
        const refusalAt = new Date().toISOString();
        await recordM03ExecutionRefusal(pool, {
          idempotencyKey: parsed.data.idempotencyKey,
          planDigest: parsed.data.planDigest,
          correlationId: correlation,
          reason: 'M04_AUTHORIZATION_INVALID_OR_REVOKED',
          occurredAt: refusalAt,
        });
        await recordM04M03BoundaryDecision(pool, {
          planDigest: plan.digest,
          authorizationRefHash: parsed.data.m04AuthorizationRef,
          correlationId: correlation,
          occurredAt: refusalAt,
          result: 'REFUSED',
          reasonCode: 'M04_AUTHORIZATION_INVALID_OR_REVOKED',
        });
        return apiJson(
          {
            schemaVersion: '0.1',
            status: 'REFUSED',
            reason: 'M04_AUTHORIZATION_INVALID_OR_REVOKED',
            planDigest: plan.digest,
            correlationId: correlation,
            executionEnabled: false,
          },
          409,
        );
      }
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
      await recordM04M03BoundaryDecision(pool, {
        planDigest: plan.digest,
        authorizationRefHash: parsed.data.m04AuthorizationRef,
        correlationId: correlation,
        occurredAt: new Date().toISOString(),
        result: 'REFUSED',
        reasonCode: reason,
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
    },
  );
}
