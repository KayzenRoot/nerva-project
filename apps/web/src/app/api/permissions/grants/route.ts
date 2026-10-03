import {
  latestM04DelegationObservation,
  loadCurrentM04IdentitiesByAgent,
  persistM04CapabilityGrant,
} from '@nerva/db';
import { M04GrantRequestSchema } from '@nerva/contracts';
import {
  buildGrantApprovalTypedData,
  compileCapabilityGrant,
  restorePersistedAgentIdentity,
  restorePersistedWalletIdentity,
  verifyGrantApproval,
} from '@nerva/permissions';
import { apiError, apiJson, parseM03Request, withM03Database } from '../../../../server/m03-api.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = await parseM03Request(request, M04GrantRequestSchema, {
    code: 'CAPABILITY_GRANT_INVALID',
    message: 'A strict bounded capability grant is required.',
  });
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  const now = new Date().toISOString();
  if (
    Date.parse(input.issuedAt) > Date.parse(now) ||
    Date.parse(now) - Date.parse(input.issuedAt) > 300_000 ||
    Date.parse(input.expiresAt) <= Date.parse(now)
  )
    return apiError(
      422,
      'CAPABILITY_GRANT_TIME_INVALID',
      'Grant issuance must be fresh and expiry must remain in the future.',
      parsed.correlationId,
    );
  return withM03Database(
    {
      correlationId: parsed.correlationId,
      unavailable: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Grant provenance cannot be verified.',
      },
      failure: {
        code: 'CAPABILITY_GRANT_FAILED',
        message: 'The capability grant could not be verified or persisted.',
      },
      onError: () =>
        apiError(
          409,
          'CAPABILITY_GRANT_CONFLICT',
          'The grant nonce or identity conflicts with current authority.',
          parsed.correlationId,
        ),
    },
    async (pool) => {
      const identities = await loadCurrentM04IdentitiesByAgent(pool, {
        agentId: input.agentId,
        agentVersion: input.agentVersion,
      });
      if (!identities)
        return apiError(
          403,
          'CURRENT_WALLET_AND_AGENT_REQUIRED',
          'A currently bound wallet and verified agent are required.',
          parsed.correlationId,
        );
      const delegation = await latestM04DelegationObservation(pool, identities.wallet.address);
      if (
        !delegation ||
        !['ABSENT', 'ACTIVE'].includes(delegation.observation.status) ||
        Date.parse(now) - Date.parse(delegation.observedAt) < 0 ||
        Date.parse(now) - Date.parse(delegation.observedAt) > 30_000 ||
        delegation.observationHash !== input.delegationObservationHash
      )
        return apiError(
          409,
          'DELEGATION_NOT_FRESH_OR_VERIFIED',
          'A fresh finalized-block EIP-7702 observation is required.',
          parsed.correlationId,
        );
      const policy = await pool.query<{
        state: string;
        environment: string;
        content_hash: string;
        payload: Record<string, unknown>;
      }>(
        `SELECT p.state,p.environment,v.content_hash,v.payload FROM policies p
       JOIN policy_versions v ON v.policy_id=p.policy_id WHERE v.content_hash=$1 LIMIT 1`,
        [input.policyHash],
      );
      const approvedPolicy = policy.rows[0];
      if (
        !approvedPolicy ||
        approvedPolicy.state !== 'ACTIVE' ||
        !['TESTNET', 'TESTNET_DEMO'].includes(approvedPolicy.environment)
      )
        return apiError(
          403,
          'ACTIVE_TESTNET_POLICY_REQUIRED',
          'Only an active testnet policy can bound this grant.',
          parsed.correlationId,
        );
      const policyPayload = approvedPolicy.payload;
      const scope = policyPayload.scope as Record<string, unknown> | undefined;
      const intent = policyPayload.actionIntent as Record<string, unknown> | undefined;
      const constraints = policyPayload.constraints as Record<string, unknown> | undefined;
      const allowedAction = intent?.family;
      if (
        scope?.network !== 'monad-testnet' ||
        scope?.marketSelector !== input.scope.marketSelector ||
        !['REDUCE_POSITION', 'CLOSE_POSITION'].includes(String(allowedAction)) ||
        input.actions.some((action) => action !== 'NO_ACTION' && action !== allowedAction) ||
        input.limits.maxActionFractionBps > Number(constraints?.maxActionFractionBps) ||
        BigInt(input.limits.maxNotionalMicros) >
          BigInt(String(constraints?.maxNotionalMicros ?? '0')) ||
        input.limits.maxSlippageBps > Number(constraints?.maxSlippageBps) ||
        Date.parse(input.expiresAt) > Date.parse(String(constraints?.expiresAt ?? '')) ||
        input.revocationGeneration !== 0
      )
        return apiError(
          422,
          'GRANT_EXCEEDS_POLICY',
          'The capability exceeds its exact active policy bounds.',
          parsed.correlationId,
        );
      const wallet = restorePersistedWalletIdentity(identities.wallet);
      const agent = restorePersistedAgentIdentity(identities.agent);
      let grant;
      let typedData;
      try {
        grant = await compileCapabilityGrant({
          schemaVersion: input.schemaVersion,
          grantId: input.grantId,
          wallet,
          agent,
          policyHash: input.policyHash,
          scope: input.scope,
          actions: input.actions,
          limits: input.limits,
          issuedAt: input.issuedAt,
          expiresAt: input.expiresAt,
          revocationGeneration: input.revocationGeneration,
          nonceDomain: input.nonceDomain,
          delegation: {
            status: delegation.observation.status as 'ACTIVE' | 'ABSENT',
            observationHash: delegation.observationHash,
            ...(delegation.observation.status === 'ACTIVE'
              ? {
                  delegateAddress: delegation.observation.delegateAddress,
                  delegateCodeHash: delegation.observation.delegateCodeHash,
                }
              : {}),
          },
        });
        typedData = buildGrantApprovalTypedData({
          grant,
          authorizationExpiresAt: input.authorizationExpiresAt,
          nonce: input.nonce,
          now,
        });
      } catch {
        return apiError(
          422,
          'CAPABILITY_GRANT_INVALID',
          'The permission compiler refused this grant.',
          parsed.correlationId,
        );
      }
      if (!input.signature)
        return apiJson({
          schemaVersion: '0.1',
          status: 'AWAITING_OWNER_SIGNATURE',
          grantHash: grant.digest,
          typedData,
          executionEnabled: false,
          correlationId: parsed.correlationId,
        });
      const approval = await verifyGrantApproval({
        grant,
        typedData,
        signature: input.signature,
        now,
      });
      if (!approval)
        return apiError(
          403,
          'GRANT_OWNER_SIGNATURE_INVALID',
          'A fresh wallet-owner EIP-712 approval is required.',
          parsed.correlationId,
        );
      await persistM04CapabilityGrant(pool, {
        grant,
        approvalRefHash: approval.proofRefHash,
        nonceHash: approval.nonceHash,
        domainHash: approval.digest,
        correlationId: parsed.correlationId,
      });
      return apiJson(
        {
          schemaVersion: '0.1',
          status: 'ACTIVE',
          grant: {
            grantId: grant.grantId,
            grantHash: grant.digest,
            chainId: grant.chainId,
            accountId: grant.accountId,
            walletAddress: grant.walletAddress,
            agentId: grant.agentId,
            agentVersion: grant.agentVersion,
            policyHash: grant.policyHash,
            scope: grant.scope,
            actions: grant.actions,
            limits: grant.limits,
            expiresAt: grant.expiresAt,
            revocationGeneration: grant.revocationGeneration,
            delegation: grant.delegation,
          },
          executionEnabled: false,
          correlationId: parsed.correlationId,
        },
        201,
      );
    },
  );
}
