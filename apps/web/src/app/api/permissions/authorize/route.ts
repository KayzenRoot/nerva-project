import {
  loadM04CompiledGrant,
  loadM04SessionAuthority,
  latestM04DelegationObservation,
  persistM04Authorization,
} from '@nerva/db';
import { M04AuthorizationRequestSchema } from '@nerva/contracts';
import {
  buildAuthorizationTypedData,
  isCurrentM04DelegationObservation,
  type SessionAuthority,
  verifyAuthorization,
} from '@nerva/permissions';
import {
  apiError,
  apiJson,
  latestM03SimulationsAreCurrentPass,
  withM04DatabaseRequest,
} from '../../../../server/m03-api.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return withM04DatabaseRequest(
    request,
    M04AuthorizationRequestSchema,
    {
      invalid: {
        code: 'M04_AUTHORIZATION_INVALID',
        message: 'An exact M03-plan-bound wallet authorization is required.',
      },
      unavailable: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'M04 authorization cannot be verified.',
      },
      failure: {
        code: 'M04_AUTHORIZATION_FAILED',
        message: 'The exact plan-bound authorization was refused.',
      },
      conflict: {
        code: 'M04_AUTHORIZATION_CONFLICT',
        message: 'The authorization nonce was consumed or the grant changed.',
      },
    },
    async (pool, input, correlationId) => {
      const now = new Date().toISOString();
      const loaded = await loadM04CompiledGrant(pool, input.grantId);
      if (
        !loaded ||
        loaded.revoked ||
        loaded.grant.revocationGeneration !== loaded.generation ||
        Date.parse(loaded.grant.expiresAt) <= Date.parse(now)
      )
        return apiError(
          403,
          'ACTIVE_GRANT_REQUIRED',
          'A current non-revoked capability grant is required.',
          correlationId,
        );
      let sessionAuthority: SessionAuthority | undefined;
      if (input.authority === 'session') {
        const loadedSession = await loadM04SessionAuthority(pool, input.sessionId!);
        if (
          !loadedSession ||
          loadedSession.revoked ||
          loadedSession.parentRevoked ||
          loadedSession.session.grantId !== input.grantId ||
          loadedSession.session.digest !== input.sessionHash ||
          loadedSession.session.revocationGeneration !== loaded.generation ||
          loadedSession.generation !== loaded.generation ||
          Date.parse(loadedSession.session.expiresAt) <= Date.parse(now)
        )
          return apiError(
            403,
            'ACTIVE_SESSION_REQUIRED',
            'An exact active session within the current parent grant is required.',
            correlationId,
          );
        sessionAuthority = loadedSession.session;
      }
      const delegation = await latestM04DelegationObservation(pool, loaded.grant.walletAddress);
      if (
        !isCurrentM04DelegationObservation({
          expected: loaded.grant.delegation,
          observation: delegation?.observation,
          observedAt: delegation?.observedAt,
          now,
        })
      )
        return apiError(
          409,
          'DELEGATION_AUTHORITY_INVALID',
          'EIP-7702 delegation is stale, unknown, changed or revoked.',
          correlationId,
        );
      const planResult = await pool.query<{
        digest: string;
        policy_version_hash: string;
        account_id: string;
        position_id: string;
        market_selector: string;
        action: string;
        notional_micros: string;
        quantity_scaled: string;
        snapshot_id: string;
        environment: string;
        network: string;
        chain_id: number;
        expires_at: Date;
        slippage_bps: number;
        external_effect: boolean;
        actor_id: string | null;
      }>(
        `SELECT p.digest,p.policy_version_hash,p.account_id,p.position_id,p.market_selector,p.action,p.notional_micros,
        p.quantity_scaled,p.slippage_bps,p.snapshot_id,p.environment,p.network,p.chain_id,p.expires_at,p.external_effect,
        v.payload->>'createdByActorRef' AS actor_id
       FROM m03_execution_plans p JOIN policy_versions v ON v.policy_version_id=p.policy_version_id
       WHERE p.digest=$1 LIMIT 1`,
        [input.planDigest],
      );
      const plan = planResult.rows[0];
      if (
        !plan ||
        plan.expires_at.getTime() <= Date.parse(now) ||
        plan.environment !== 'TESTNET' ||
        plan.network !== 'monad-testnet' ||
        plan.chain_id !== 10_143 ||
        plan.external_effect !== true ||
        plan.account_id !== loaded.grant.accountId ||
        plan.actor_id !== loaded.grant.agentId ||
        plan.policy_version_hash !== loaded.grant.policyHash ||
        plan.position_id !== loaded.grant.scope.positionId ||
        plan.market_selector !== loaded.grant.scope.marketSelector ||
        plan.action !== input.action ||
        Date.parse(input.validUntil) > plan.expires_at.getTime() ||
        !loaded.grant.actions.includes(input.action) ||
        BigInt(plan.notional_micros) > BigInt(loaded.grant.limits.maxNotionalMicros) ||
        plan.slippage_bps > loaded.grant.limits.maxSlippageBps ||
        (sessionAuthority !== undefined &&
          (!sessionAuthority.actions.includes(input.action) ||
            Date.parse(input.validUntil) > Date.parse(sessionAuthority.expiresAt) ||
            BigInt(plan.notional_micros) > BigInt(sessionAuthority.maxNotionalMicros) ||
            plan.slippage_bps > sessionAuthority.maxSlippageBps))
      )
        return apiError(
          403,
          'PLAN_OUTSIDE_GRANT',
          'The persisted testnet plan exceeds this grant or is not effect eligible.',
          correlationId,
        );
      const quantity = await pool.query<{ size_scaled: string }>(
        `SELECT ps.payload->>'sizeScaled' AS size_scaled
         FROM risk_snapshots rs JOIN position_snapshots ps
           ON ps.content_hash=ANY(rs.source_snapshot_hashes)
         WHERE rs.snapshot_id=$1 AND ps.position_id=$2 AND ps.quality='FRESH'
         ORDER BY ps.observed_at DESC LIMIT 1`,
        [plan.snapshot_id, plan.position_id],
      );
      const positionSize = quantity.rows[0]?.size_scaled;
      if (
        !positionSize ||
        BigInt(plan.quantity_scaled) * 10_000n >
          BigInt(positionSize) * BigInt(loaded.grant.limits.maxActionFractionBps) ||
        (sessionAuthority !== undefined &&
          BigInt(plan.quantity_scaled) * 10_000n >
            BigInt(positionSize) * BigInt(sessionAuthority.maxActionFractionBps))
      )
        return apiError(
          403,
          'PLAN_FRACTION_EXCEEDS_GRANT',
          'The plan quantity exceeds the grant fraction ceiling.',
          correlationId,
        );
      const checks = await pool.query<{
        kind: string;
        status: string;
        checked_at: Date;
        expires_at: Date;
      }>(
        `SELECT kind,status,checked_at,expires_at FROM m03_simulation_results WHERE plan_digest=$1
       AND kind IN ('DETERMINISTIC_DRY_RUN','PROVIDER_TESTNET_PREFLIGHT') ORDER BY checked_at DESC`,
        [input.planDigest],
      );
      if (
        !latestM03SimulationsAreCurrentPass(
          checks.rows.map((row) => ({
            kind: row.kind,
            status: row.status,
            checkedAt: row.checked_at,
            expiresAt: row.expires_at,
          })),
          now,
        )
      )
        return apiError(
          409,
          'SIMULATION_OR_PREFLIGHT_NOT_PASS',
          'A current PASS simulation and testnet preflight are required; UNKNOWN blocks authorization.',
          correlationId,
        );
      const killSwitch = await pool.query<{ enabled: boolean }>(
        `SELECT enabled FROM runtime_controls WHERE control_key='GLOBAL_EXECUTION_DISABLED' LIMIT 1`,
      );
      if (!killSwitch.rows[0] || killSwitch.rows[0].enabled !== false)
        return apiError(
          409,
          'M03_KILL_SWITCH_ACTIVE',
          'The M03 kill switch prevents authorization.',
          correlationId,
        );
      let typedData;
      try {
        typedData = buildAuthorizationTypedData({
          grant: loaded.grant,
          planDigest: input.planDigest,
          action: input.action,
          validUntil: input.validUntil,
          nonce: input.nonce,
          revocationGeneration: loaded.generation,
          ...(sessionAuthority ? { session: sessionAuthority } : {}),
        });
      } catch {
        return apiError(
          422,
          'M04_AUTHORIZATION_INVALID',
          'The exact authorization payload does not fit the active grant.',
          correlationId,
        );
      }
      if (!input.signature)
        return apiJson({
          schemaVersion: '0.1',
          status: 'AWAITING_OWNER_SIGNATURE',
          planDigest: input.planDigest,
          action: input.action,
          typedData,
          executionEnabled: false,
          correlationId: correlationId,
        });
      const verified = await verifyAuthorization({
        grant: loaded.grant,
        typedData,
        signature: input.signature,
        expected: {
          planDigest: input.planDigest,
          action: input.action,
          now,
          signer: loaded.grant.walletAddress,
          revocationGeneration: loaded.generation,
          delegationObservationHash: loaded.grant.delegation.observationHash,
          ...(sessionAuthority ? { session: sessionAuthority } : {}),
        },
      });
      if (!verified)
        return apiError(
          403,
          'M04_WALLET_SIGNATURE_INVALID',
          'The user-controlled wallet signature failed verification.',
          correlationId,
        );
      const persisted = await persistM04Authorization(pool, {
        grantId: input.grantId,
        generation: loaded.generation,
        verified,
        domainHash: verified.typedDataDigest,
        correlationId: correlationId,
        verifiedAt: now,
      });
      if (!persisted)
        return apiError(
          409,
          'M04_AUTHORITY_CHANGED',
          'Revocation or delegate state changed before authorization was consumed.',
          correlationId,
        );
      return apiJson(
        {
          schemaVersion: '0.1',
          status: 'AUTHORIZED',
          authorizationRef: verified.typedDataDigest,
          planDigest: verified.planDigest,
          action: verified.action,
          expiresAt: verified.expiresAt,
          signer: verified.signer,
          executionEnabled: false,
          livePerplEffect: 'BLOCKED',
          mainnetEffect: 'HARD_BLOCKED',
          correlationId: correlationId,
        },
        201,
      );
    },
  );
}
