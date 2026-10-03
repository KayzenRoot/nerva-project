import { describe, expect, it } from 'vitest';
import {
  HealthResponseSchema,
  M03ExecutionAuthorizationProofSchema,
  M03ProviderEnrollmentEvidenceSchemaV0_1,
} from './index.js';

const now = '2026-10-03T03:00:00.000Z';

const authorizationProof = {
  schemaVersion: '0.1',
  issuer: 'issuer:trusted-test',
  subject: 'actor:test',
  audience: 'nerva-testnet-execution-v1',
  environment: 'TESTNET',
  network: 'monad-testnet',
  chainId: 10_143,
  policyHash: 'a'.repeat(64),
  planDigest: 'b'.repeat(64),
  accountId: '42',
  positionId: '21',
  action: 'REDUCE_POSITION',
  scope: ['REDUCE_POSITION'],
  nonce: 'authorization-nonce-000001',
  keyId: 'actor-key-1',
  issuedAt: now,
  expiresAt: '2026-10-03T03:04:00.000Z',
  signature: 'redacted-test-signature-material-not-live',
};

const enrollmentEvidence = {
  schemaVersion: '0.1',
  provider: 'perpl',
  issuer: 'issuer:perpl-test',
  network: 'monad-testnet',
  chainId: 10_143,
  accountId: '42',
  credentialRefHash: 'c'.repeat(64),
  nonce: 'enrollment-nonce-000001',
  allowedActions: ['REDUCE_POSITION'],
  scopes: ['trade'],
  keyId: 'provider-key-1',
  proofRef: 'redacted-provider-enrollment-evidence',
  verifiedAt: now,
  expiresAt: '2026-10-03T03:04:00.000Z',
  signature: 'redacted-test-signature-material-not-live',
};

describe('M03 actor authorization and provider enrollment contracts', () => {
  it('supports the controlled TESTNET health identity while execution remains disabled', () => {
    expect(
      HealthResponseSchema.safeParse({
        status: 'ready',
        module: 'M01',
        environment: 'TESTNET',
        executionEnabled: false,
        timestamp: now,
      }).success,
    ).toBe(true);
  });

  it('accepts exact actor action scope and account-bound enrollment evidence', () => {
    expect(M03ExecutionAuthorizationProofSchema.safeParse(authorizationProof).success).toBe(true);
    expect(M03ProviderEnrollmentEvidenceSchemaV0_1.safeParse(enrollmentEvidence).success).toBe(
      true,
    );
  });

  it('rejects broad, mismatched or multi-action actor authorization scope', () => {
    expect(
      M03ExecutionAuthorizationProofSchema.safeParse({
        ...authorizationProof,
        scope: ['REDUCE_POSITION', 'CLOSE_POSITION'],
      }).success,
    ).toBe(false);
    expect(
      M03ExecutionAuthorizationProofSchema.safeParse({
        ...authorizationProof,
        action: 'CLOSE_POSITION',
      }).success,
    ).toBe(false);
  });

  it('rejects enrollment evidence that authorizes more than the exact requested action', () => {
    expect(
      M03ProviderEnrollmentEvidenceSchemaV0_1.safeParse({
        ...enrollmentEvidence,
        allowedActions: ['REDUCE_POSITION', 'CLOSE_POSITION'],
      }).success,
    ).toBe(false);
  });
});
