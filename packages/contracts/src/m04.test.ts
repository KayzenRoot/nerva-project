import { describe, expect, it } from 'vitest';
import {
  M04AgentRegistrationRequestSchema,
  M04AuthorizationRequestSchema,
  M04DelegationObserveRequestSchema,
  M04GrantRequestSchema,
  M04GrantRevocationRequestSchema,
  M04ReadModelRequestSchema,
  M04SessionRequestSchema,
  M04SessionRevocationRequestSchema,
  M04WalletBindingRequestSchema,
  M04WalletUnbindingRequestSchema,
} from './index.js';

const correlationId = 'm04-schema-test';
const nonce = `0x${'a'.repeat(64)}`;
const address = `0x${'1'.repeat(40)}`;
const hash = 'b'.repeat(64);
const issuedAt = '2026-10-03T15:00:00.000Z';
const expiresAt = '2026-10-03T15:04:00.000Z';

describe('M04 request contracts', () => {
  it('accepts an unsigned owner challenge while requiring exact Monad Testnet domain', () => {
    expect(
      M04WalletBindingRequestSchema.safeParse({
        schemaVersion: '0.1',
        accountId: 'acct-1',
        address,
        chainId: 10_143,
        issuedAt,
        validUntil: expiresAt,
        nonce,
        correlationId,
      }).success,
    ).toBe(true);
    expect(
      M04WalletBindingRequestSchema.safeParse({
        schemaVersion: '0.1',
        accountId: 'acct-1',
        address,
        chainId: 143,
        issuedAt,
        validUntil: expiresAt,
        nonce,
        correlationId,
      }).success,
    ).toBe(false);
  });

  it('rejects unknown fields and arbitrary calls at every authority boundary', () => {
    const base = {
      schemaVersion: '0.1',
      grantId: 'grant-1',
      agentId: 'agent-1',
      agentVersion: 1,
      policyHash: hash,
      scope: { positionId: 'position-1', marketSelector: 'BTC-PERP' },
      actions: ['REDUCE_POSITION'],
      limits: { maxActionFractionBps: 2_500, maxNotionalMicros: '1000000', maxSlippageBps: 100 },
      issuedAt,
      expiresAt,
      authorizationExpiresAt: expiresAt,
      nonceDomain: 'nerva:grant-1',
      revocationGeneration: 0,
      delegationObservationHash: hash,
      nonce,
      correlationId,
    };
    expect(M04GrantRequestSchema.safeParse(base).success).toBe(true);
    expect(M04GrantRequestSchema.safeParse({ ...base, arbitraryCall: true }).success).toBe(false);
    expect(M04GrantRequestSchema.safeParse({ ...base, actions: ['ARBITRARY_CALL'] }).success).toBe(
      false,
    );
    expect(
      M04GrantRequestSchema.safeParse({ ...base, scope: { positionId: '*', marketSelector: '*' } })
        .success,
    ).toBe(false);
  });

  it('requires issuer provenance and bounded identity shape', () => {
    const agent = {
      schemaVersion: '0.1',
      agentId: 'agent-1',
      version: 1,
      issuer: 'issuer-1',
      keyId: 'key-1',
      walletAddress: address,
      chainId: 10_143,
      issuedAt,
      expiresAt,
      nonce,
      signature: 'x'.repeat(64),
      correlationId,
    };
    expect(M04AgentRegistrationRequestSchema.safeParse(agent).success).toBe(true);
    expect(M04AgentRegistrationRequestSchema.safeParse({ ...agent, issuer: '' }).success).toBe(
      false,
    );
    expect(
      M04AgentRegistrationRequestSchema.safeParse({ ...agent, mnemonic: 'forbidden' }).success,
    ).toBe(false);
  });

  it('accepts authorization challenges without signature and rejects invalid action/domain', () => {
    const challenge = {
      schemaVersion: '0.1',
      grantId: 'grant-1',
      planDigest: hash,
      action: 'REDUCE_POSITION',
      validUntil: expiresAt,
      nonce,
      correlationId,
    };
    expect(M04AuthorizationRequestSchema.safeParse(challenge).success).toBe(true);
    expect(
      M04AuthorizationRequestSchema.safeParse({ ...challenge, action: 'TRANSFER' }).success,
    ).toBe(false);
    expect(M04AuthorizationRequestSchema.safeParse({ ...challenge, chainId: 143 }).success).toBe(
      false,
    );
  });

  it('keeps delegation observation, session, revocation and unbinding bounded', () => {
    expect(
      M04DelegationObserveRequestSchema.safeParse({
        schemaVersion: '0.1',
        accountId: 'acct-1',
        correlationId,
      }).success,
    ).toBe(true);
    const session = {
      schemaVersion: '0.1',
      grantId: 'grant-1',
      sessionId: 'session-1',
      actions: ['NO_ACTION'],
      maxActionFractionBps: 100,
      maxNotionalMicros: '1000',
      maxSlippageBps: 0,
      expiresAt,
      nonceDomain: 'nerva:session:session-1',
      correlationId,
    };
    expect(M04SessionRequestSchema.safeParse(session).success).toBe(true);
    expect(
      M04SessionRequestSchema.safeParse({ ...session, actions: ['ARBITRARY_CALL'] }).success,
    ).toBe(false);
    const sessionRevocation = {
      schemaVersion: '0.1',
      sessionId: 'session-1',
      issuedAt,
      validUntil: expiresAt,
      nonce,
      correlationId,
    };
    expect(M04SessionRevocationRequestSchema.safeParse(sessionRevocation).success).toBe(true);
    expect(
      M04SessionRevocationRequestSchema.safeParse({ ...sessionRevocation, sessionId: '*' }).success,
    ).toBe(false);
    const revoke = {
      schemaVersion: '0.1',
      grantId: 'grant-1',
      reasonCode: 'USER_REVOKED',
      issuedAt,
      validUntil: expiresAt,
      nonce,
      correlationId,
    };
    expect(M04GrantRevocationRequestSchema.safeParse(revoke).success).toBe(true);
    expect(
      M04GrantRevocationRequestSchema.safeParse({ ...revoke, reasonCode: 'UNKNOWN' }).success,
    ).toBe(false);
    const unbind = {
      schemaVersion: '0.1',
      accountId: 'acct-1',
      address,
      chainId: 10_143,
      bindingGeneration: 1,
      issuedAt,
      validUntil: expiresAt,
      nonce,
      correlationId,
    };
    expect(M04WalletUnbindingRequestSchema.safeParse(unbind).success).toBe(true);
    expect(M04WalletUnbindingRequestSchema.safeParse({ ...unbind, chainId: 1 }).success).toBe(
      false,
    );
  });

  it('requires fresh wallet-signed read authorization data for private account status', () => {
    const request = {
      schemaVersion: '0.1',
      accountId: 'acct-1',
      address,
      chainId: 10_143,
      issuedAt,
      validUntil: expiresAt,
      nonce,
      signature: `0x${'1'.repeat(130)}`,
      correlationId,
    };
    expect(M04ReadModelRequestSchema.safeParse(request).success).toBe(true);
    expect(M04ReadModelRequestSchema.safeParse({ ...request, chainId: 143 }).success).toBe(false);
    expect(M04ReadModelRequestSchema.safeParse({ ...request, signature: undefined }).success).toBe(
      false,
    );
  });
});
