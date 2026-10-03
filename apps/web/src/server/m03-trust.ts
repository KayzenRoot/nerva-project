import { createPublicKey, verify } from 'node:crypto';
import { canonicalHash, canonicalSerialize } from '@nerva/domain';
import { consumeM03Nonce } from '@nerva/db';
import type { Pool } from 'pg';
import { M03PolicyControlProofSchemaV0_1 } from '@nerva/contracts';
import type { ActorProvenanceVerifier, NonceLedger } from '@nerva/policy';
import type { M03ExecutionAuthorizationVerifier, PerplEnrollmentVerifier } from '@nerva/execution';

interface TrustedIssuerKey {
  readonly issuer: string;
  readonly keyId: string;
  readonly actorId?: string;
  readonly publicKeyPem: string;
}

function trustedKeys(): readonly TrustedIssuerKey[] {
  const raw = process.env.NERVA_M03_TRUSTED_ISSUERS_JSON;
  if (!raw || raw.length > 32_000) return [];
  try {
    const candidate: unknown = JSON.parse(raw);
    if (!Array.isArray(candidate) || candidate.length > 64) return [];
    return candidate.filter(
      (entry): entry is TrustedIssuerKey =>
        entry !== null &&
        typeof entry === 'object' &&
        typeof (entry as TrustedIssuerKey).issuer === 'string' &&
        typeof (entry as TrustedIssuerKey).keyId === 'string' &&
        typeof (entry as TrustedIssuerKey).publicKeyPem === 'string' &&
        (entry as TrustedIssuerKey).publicKeyPem.includes('PUBLIC KEY'),
    );
  } catch {
    return [];
  }
}

async function verifyProof(
  value: Readonly<Record<string, unknown>>,
): Promise<TrustedIssuerKey | undefined> {
  const issuer = value.issuer;
  const keyId = value.keyId;
  const signature = value.signature;
  if (typeof issuer !== 'string' || typeof keyId !== 'string' || typeof signature !== 'string')
    return undefined;
  const key = trustedKeys().find((entry) => entry.issuer === issuer && entry.keyId === keyId);
  if (!key) return undefined;
  try {
    const unsigned = { ...value };
    delete (unsigned as Record<string, unknown>).signature;
    const signatureBytes = Buffer.from(signature, 'base64url');
    if (
      signatureBytes.length !== 64 ||
      !verify(
        null,
        Buffer.from(canonicalSerialize(unsigned)),
        createPublicKey(key.publicKeyPem),
        signatureBytes,
      )
    )
      return undefined;
    return key;
  } catch {
    return undefined;
  }
}

export function createM03NonceLedger(pool: Pool): NonceLedger {
  return Object.freeze({
    async consume(issuer: string, nonce: string, purpose: string) {
      return consumeM03Nonce(pool, { issuer, nonce, purpose });
    },
  });
}

export function createM03ActorVerifier(): ActorProvenanceVerifier {
  const verifier: ActorProvenanceVerifier = {
    async verifyConfirmation(proof, expected) {
      const key = await verifyProof(proof as unknown as Readonly<Record<string, unknown>>);
      if (
        !key ||
        key.actorId !== expected.actorId ||
        proof.subject !== expected.actorId ||
        proof.policyHash !== expected.policyHash
      )
        return undefined;
      return {
        issuerId: key.issuer,
        actorId: expected.actorId,
        proofRef: await canonicalHash({
          issuer: key.issuer,
          keyId: key.keyId,
          signature: proof.signature,
        }),
      };
    },
  };
  return Object.freeze(verifier);
}

export function createM03ExecutionAuthorizationVerifier(): M03ExecutionAuthorizationVerifier {
  const verifier: M03ExecutionAuthorizationVerifier = {
    async verify(proof, expected) {
      const key = await verifyProof(proof);
      const action = proof.action;
      if (
        !key ||
        key.actorId !== expected.actorId ||
        proof.subject !== expected.actorId ||
        proof.policyHash !== expected.policyHash ||
        proof.planDigest !== expected.planDigest ||
        proof.accountId !== expected.accountId ||
        proof.positionId !== expected.positionId ||
        action !== expected.action
      )
        return undefined;
      return {
        issuerId: key.issuer,
        actorId: expected.actorId,
        proofRef: await canonicalHash({
          issuer: key.issuer,
          keyId: key.keyId,
          signature: proof.signature,
        }),
      };
    },
  };
  return Object.freeze(verifier);
}

export function createM03PerplEnrollmentVerifier(): PerplEnrollmentVerifier {
  const verifier: PerplEnrollmentVerifier = {
    async verify(evidence, expected) {
      const key = await verifyProof(evidence);
      if (
        !key ||
        evidence.provider !== 'perpl' ||
        evidence.network !== expected.network ||
        evidence.chainId !== expected.chainId ||
        evidence.accountId !== expected.accountId ||
        !Array.isArray(evidence.allowedActions) ||
        !evidence.allowedActions.includes(expected.action)
      )
        return undefined;
      return {
        issuerId: key.issuer,
        scopeRef: await canonicalHash({
          issuer: key.issuer,
          keyId: key.keyId,
          signature: evidence.signature,
        }),
      };
    },
  };
  return Object.freeze(verifier);
}

export function hasM03TrustedIssuers(): boolean {
  return trustedKeys().length > 0;
}

export async function verifyM03PolicyControlProof(
  value: unknown,
  expected: Readonly<{ policyId: string; policyVersionHash: string; now: string }>,
): Promise<
  Readonly<{ actorId: string; issuerId: string; proofRefHash: string; nonce: string }> | undefined
> {
  const parsed = M03PolicyControlProofSchemaV0_1.safeParse(value);
  if (!parsed.success) return undefined;
  const proof = parsed.data;
  const now = Date.parse(expected.now);
  const issued = Date.parse(proof.issuedAt);
  const expires = Date.parse(proof.expiresAt);
  if (
    proof.policyId !== expected.policyId ||
    proof.policyVersionHash !== expected.policyVersionHash ||
    !Number.isFinite(now) ||
    !Number.isFinite(issued) ||
    !Number.isFinite(expires) ||
    issued > now ||
    now - issued > 300_000 ||
    expires <= now ||
    expires <= issued ||
    expires - issued > 300_000
  )
    return undefined;
  const key = await verifyProof(proof as unknown as Readonly<Record<string, unknown>>);
  if (!key || key.actorId !== proof.subject) return undefined;
  return {
    actorId: proof.subject,
    issuerId: key.issuer,
    proofRefHash: await canonicalHash({
      issuer: key.issuer,
      keyId: key.keyId,
      signature: proof.signature,
    }),
    nonce: proof.nonce,
  };
}
