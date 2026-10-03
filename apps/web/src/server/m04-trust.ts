import { createPublicKey, verify } from 'node:crypto';
import { canonicalHash, canonicalSerialize } from '@nerva/domain';
import type { z } from 'zod';
import type { M04AgentRegistrationRequestSchema } from '@nerva/contracts';

type AgentRegistration = z.infer<typeof M04AgentRegistrationRequestSchema>;
interface TrustedIssuerKey {
  readonly issuer: string;
  readonly keyId: string;
  readonly actorId?: string;
  readonly publicKeyPem: string;
}

function trustedAgentIssuer(
  issuer: string,
  keyId: string,
  agentId: string,
): TrustedIssuerKey | undefined {
  const raw = process.env.NERVA_M03_TRUSTED_ISSUERS_JSON;
  if (!raw || raw.length > 32_000) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > 64) return undefined;
    return parsed.find(
      (entry): entry is TrustedIssuerKey =>
        entry !== null &&
        typeof entry === 'object' &&
        (entry as TrustedIssuerKey).issuer === issuer &&
        (entry as TrustedIssuerKey).keyId === keyId &&
        (entry as TrustedIssuerKey).actorId === agentId &&
        typeof (entry as TrustedIssuerKey).publicKeyPem === 'string' &&
        (entry as TrustedIssuerKey).publicKeyPem.includes('PUBLIC KEY'),
    );
  } catch {
    return undefined;
  }
}

export function hasM04AgentIssuers(): boolean {
  return process.env.NERVA_M03_TRUSTED_ISSUERS_JSON !== undefined;
}

export async function verifyM04AgentRegistration(
  proof: AgentRegistration,
  now: string,
): Promise<Readonly<{ provenanceHash: string }> | undefined> {
  const key = trustedAgentIssuer(proof.issuer, proof.keyId, proof.agentId);
  const currentTime = Date.parse(now);
  const issuedAt = Date.parse(proof.issuedAt);
  const expiresAt = Date.parse(proof.expiresAt);
  if (
    !key ||
    !Number.isFinite(currentTime) ||
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    issuedAt > currentTime ||
    currentTime - issuedAt > 300_000 ||
    expiresAt <= currentTime ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > 300_000
  )
    return undefined;
  const unsigned = {
    schemaVersion: proof.schemaVersion,
    agentId: proof.agentId,
    version: proof.version,
    issuer: proof.issuer,
    keyId: proof.keyId,
    walletAddress: proof.walletAddress,
    chainId: proof.chainId,
    issuedAt: proof.issuedAt,
    expiresAt: proof.expiresAt,
    nonce: proof.nonce,
  };
  try {
    const signature = Buffer.from(proof.signature, 'base64url');
    if (
      signature.length !== 64 ||
      !verify(
        null,
        Buffer.from(canonicalSerialize(unsigned)),
        createPublicKey(key.publicKeyPem),
        signature,
      )
    )
      return undefined;
    return Object.freeze({
      provenanceHash: await canonicalHash({ unsigned, signature: proof.signature }),
    });
  } catch {
    return undefined;
  }
}
