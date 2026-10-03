import { canonicalHash } from '@nerva/domain';
import { isM04WalletBound, recordM04AgentIdentity } from '@nerva/db';
import { M04AgentRegistrationRequestSchema } from '@nerva/contracts';
import { verifyAgentIdentity } from '@nerva/permissions';
import { apiError, apiJson, parseM03Request, withM03Database } from '../../../../server/m03-api.ts';
import { hasM04AgentIssuers, verifyM04AgentRegistration } from '../../../../server/m04-trust.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = await parseM03Request(request, M04AgentRegistrationRequestSchema, {
    code: 'AGENT_IDENTITY_INVALID',
    message: 'A bounded trusted-issuer agent identity proof is required.',
  });
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  if (!hasM04AgentIssuers())
    return apiError(
      503,
      'AGENT_ISSUER_REGISTRY_UNAVAILABLE',
      'No trusted agent issuer is configured.',
      parsed.correlationId,
    );
  const now = new Date().toISOString();
  const provenance = await verifyM04AgentRegistration(input, now);
  if (!provenance)
    return apiError(
      403,
      'AGENT_ISSUER_PROOF_INVALID',
      'The agent issuer proof is not trusted or is expired.',
      parsed.correlationId,
    );
  const agent = await verifyAgentIdentity({
    identity: {
      agentId: input.agentId,
      version: input.version,
      issuerId: input.issuer,
      provenanceHash: provenance.provenanceHash,
      walletAddress: input.walletAddress,
      chainId: input.chainId,
    },
    verifyIssuer: async () => true,
  });
  if (!agent)
    return apiError(
      422,
      'AGENT_IDENTITY_INVALID',
      'The agent identity fields are invalid.',
      parsed.correlationId,
    );
  const nonceHash = await canonicalHash(input.nonce);
  const domainHash = await canonicalHash({
    domain: 'NERVA_AGENT_IDENTITY_V1',
    issuer: input.issuer,
    keyId: input.keyId,
    agentId: input.agentId,
    version: input.version,
    walletAddress: input.walletAddress.toLowerCase(),
    chainId: input.chainId,
  });
  return withM03Database(
    {
      correlationId: parsed.correlationId,
      unavailable: { code: 'DATABASE_UNAVAILABLE', message: 'Agent identity cannot be persisted.' },
      failure: {
        code: 'AGENT_IDENTITY_PERSISTENCE_FAILED',
        message: 'The agent identity could not be durably recorded.',
      },
      onError: () =>
        apiError(
          409,
          'AGENT_IDENTITY_REPLAY_OR_CONFLICT',
          'The agent identity proof is replayed or conflicts with an existing version.',
          parsed.correlationId,
        ),
    },
    async (pool) => {
      if (!(await isM04WalletBound(pool, agent.walletAddress)))
        return apiError(
          403,
          'WALLET_BINDING_REQUIRED',
          'A current user-verified wallet binding is required.',
          parsed.correlationId,
        );
      await recordM04AgentIdentity(pool, agent, {
        verifiedAt: now,
        nonceHash,
        domainHash,
        correlationId: parsed.correlationId,
      });
      return apiJson(
        { schemaVersion: '0.1', status: 'VERIFIED', agent, correlationId: parsed.correlationId },
        201,
      );
    },
  );
}
