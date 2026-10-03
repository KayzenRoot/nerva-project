import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { keccak256, toHex } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  appendPermissionEvidence,
  buildAuthorizationTypedData,
  buildGrantApprovalTypedData,
  buildGrantRevocationTypedData,
  buildSessionRevocationTypedData,
  classifyEip7702Code,
  compileCapabilityGrant,
  deriveSessionAuthority,
  buildWalletBindingTypedData,
  buildWalletUnbindingTypedData,
  verifyAgentIdentity,
  verifyWalletIdentityBinding,
  buildWalletReadAuthorizationTypedData,
  verifyWalletReadAuthorization,
  verifyAuthorization,
  verifyGrantApproval,
  verifyGrantRevocation,
  verifySessionRevocation,
  verifyWalletUnbinding,
  verifyPermissionEvidenceChain,
  observeEip7702Delegation,
} from './index.js';

const hash = (digit: string) => digit.repeat(64);
const nonce = `0x${'a'.repeat(64)}` as const;
const now = '2026-10-03T15:00:00.000Z';

async function fixtureGrant() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const walletTypedData = buildWalletBindingTypedData({
    accountId: 'account-test-1',
    address: account.address,
    issuedAt: now,
    validUntil: '2026-10-03T15:04:00.000Z',
    nonce,
  });
  const wallet = await verifyWalletIdentityBinding({
    typedData: walletTypedData,
    signature: await account.signTypedData(walletTypedData),
    expected: { accountId: 'account-test-1', address: account.address, now },
  });
  if (!wallet) throw new Error('test-only wallet binding vector did not verify');
  const agent = await verifyAgentIdentity({
    identity: {
      agentId: 'nerva-agent-test',
      version: 1,
      issuerId: 'issuer-test',
      provenanceHash: hash('b'),
      walletAddress: account.address,
      chainId: 10_143,
    },
    verifyIssuer: async (value) => value.issuerId === 'issuer-test',
  });
  if (!agent) throw new Error('test-only agent issuer vector did not verify');
  const candidate = {
    schemaVersion: '0.1' as const,
    grantId: 'grant-test-1',
    wallet,
    agent,
    policyHash: hash('c'),
    scope: { positionId: '21', marketSelector: 'BTC-PERP' },
    actions: ['REDUCE_POSITION', 'NO_ACTION'] as const,
    limits: { maxActionFractionBps: 2_500, maxNotionalMicros: '1000000', maxSlippageBps: 200 },
    issuedAt: now,
    expiresAt: '2026-10-04T15:00:00.000Z',
    revocationGeneration: 0,
    nonceDomain: 'nerva:grant-test-1',
    delegation: { status: 'ABSENT' as const, observationHash: hash('d') },
  };
  const grant = await compileCapabilityGrant(candidate);
  return { grant, privateKey };
}

describe('M04 bounded permission authority', () => {
  it('compiles strict chain/account/agent/policy-bound grants deterministically', async () => {
    const { grant } = await fixtureGrant();
    const same = await compileCapabilityGrant(grant.source);
    expect(same.digest).toBe(grant.digest);
    expect(grant.chainId).toBe(10_143);
    expect(grant.source.actions).toEqual(['NO_ACTION', 'REDUCE_POSITION']);
  });

  it('refuses unknown fields, mainnet, wildcard or arbitrary-call scope', async () => {
    const { grant } = await fixtureGrant();
    await expect(
      compileCapabilityGrant({ ...grant.source, arbitraryCall: true } as never),
    ).rejects.toThrow();
    await expect(
      compileCapabilityGrant({
        ...grant.source,
        wallet: { ...grant.source.wallet, chainId: 143, network: 'monad-mainnet' },
      } as never),
    ).rejects.toThrow();
    await expect(
      compileCapabilityGrant({
        ...grant.source,
        scope: { positionId: '*', marketSelector: '*' },
      } as never),
    ).rejects.toThrow();
  });

  it('builds and verifies EIP-712 authority bound to the exact M03 plan and domain', async () => {
    const { grant, privateKey } = await fixtureGrant();
    const typedData = buildAuthorizationTypedData({
      grant,
      planDigest: hash('e'),
      action: 'REDUCE_POSITION',
      validUntil: '2026-10-03T15:05:00.000Z',
      nonce,
      revocationGeneration: 0,
    });
    const signer = privateKeyToAccount(privateKey);
    const signature = await signer.signTypedData(typedData);
    const verified = await verifyAuthorization({
      grant,
      typedData,
      signature,
      expected: {
        planDigest: hash('e'),
        action: 'REDUCE_POSITION',
        now,
        signer: signer.address,
        revocationGeneration: 0,
        delegationObservationHash: hash('d'),
      },
    });
    expect(verified?.signer.toLowerCase()).toBe(signer.address.toLowerCase());
    const replayOnOtherChain = {
      ...typedData,
      domain: { ...typedData.domain, chainId: 1 },
    } as typeof typedData;
    await expect(
      verifyAuthorization({
        grant,
        typedData: replayOnOtherChain,
        signature,
        expected: {
          planDigest: hash('e'),
          action: 'REDUCE_POSITION',
          now,
          signer: signer.address,
          revocationGeneration: 0,
          delegationObservationHash: hash('d'),
        },
      }),
    ).resolves.toBeUndefined();
  });

  it('verifies exact owner-signed grant approval and current-generation revocation proofs', async () => {
    const { grant, privateKey } = await fixtureGrant();
    const signer = privateKeyToAccount(privateKey);
    const approvalData = buildGrantApprovalTypedData({
      grant,
      authorizationExpiresAt: '2026-10-03T15:04:00.000Z',
      nonce,
      now,
    });
    const approval = await verifyGrantApproval({
      grant,
      typedData: approvalData,
      signature: await signer.signTypedData(approvalData),
      now,
    });
    expect(approval?.signer.toLowerCase()).toBe(signer.address.toLowerCase());
    const revocationData = buildGrantRevocationTypedData({
      grant,
      reasonCode: 'USER_REVOKED',
      revocationGeneration: 0,
      issuedAt: now,
      validUntil: '2026-10-03T15:04:00.000Z',
      nonce,
    });
    const revocation = await verifyGrantRevocation({
      grant,
      reasonCode: 'USER_REVOKED',
      generation: 0,
      typedData: revocationData,
      signature: await signer.signTypedData(revocationData),
      now,
    });
    expect(revocation?.signer.toLowerCase()).toBe(signer.address.toLowerCase());
    const wrongGeneration = {
      ...revocationData,
      message: { ...revocationData.message, revocationGeneration: 1n },
    };
    await expect(
      verifyGrantRevocation({
        grant,
        reasonCode: 'USER_REVOKED',
        generation: 0,
        typedData: wrongGeneration,
        signature: await signer.signTypedData(revocationData),
        now,
      }),
    ).resolves.toBeUndefined();
  });

  it('requires an exact wallet-signed unbinding and rejects cross-chain replay', async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const typedData = buildWalletUnbindingTypedData({
      accountId: 'account-test-1',
      address: account.address,
      bindingGeneration: 3,
      issuedAt: now,
      validUntil: '2026-10-03T15:04:00.000Z',
      nonce,
    });
    const signature = await account.signTypedData(typedData);
    const verified = await verifyWalletUnbinding({
      accountId: 'account-test-1',
      address: account.address,
      bindingGeneration: 3,
      typedData,
      signature,
      now,
    });
    expect(verified?.signer.toLowerCase()).toBe(account.address.toLowerCase());
    const otherChain = {
      ...typedData,
      domain: { ...typedData.domain, chainId: 143 },
    } as typeof typedData;
    await expect(
      verifyWalletUnbinding({
        accountId: 'account-test-1',
        address: account.address,
        bindingGeneration: 3,
        typedData: otherChain,
        signature,
        now,
      }),
    ).resolves.toBeUndefined();
  });

  it('limits wallet binding challenge lifetime and refuses unknown wallet code', async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    expect(() =>
      buildWalletBindingTypedData({
        accountId: 'account-test-1',
        address: account.address,
        issuedAt: now,
        validUntil: '2026-10-03T16:00:00.000Z',
        nonce,
      }),
    ).toThrow();
    const shortChallenge = buildWalletBindingTypedData({
      accountId: 'account-test-1',
      address: account.address,
      issuedAt: now,
      validUntil: '2026-10-03T15:04:00.000Z',
      nonce,
    });
    const longChallenge = {
      ...shortChallenge,
      message: {
        ...shortChallenge.message,
        validUntil: BigInt(Date.parse('2026-10-03T15:05:01.000Z') / 1_000),
      },
    };
    expect(
      await verifyWalletIdentityBinding({
        typedData: longChallenge,
        signature: await account.signTypedData(longChallenge),
        expected: { accountId: 'account-test-1', address: account.address, now },
      }),
    ).toBeUndefined();
    expect(classifyEip7702Code('0x60006000').status).toBe('UNKNOWN');
  });

  it('requires a short-lived account and chain-bound wallet proof to read private permission status', async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const read = buildWalletReadAuthorizationTypedData({
      accountId: 'account-test-1',
      address: account.address,
      issuedAt: now,
      validUntil: '2026-10-03T15:02:00.000Z',
      nonce,
    });
    const signature = await account.signTypedData(read);
    const verified = await verifyWalletReadAuthorization({
      accountId: 'account-test-1',
      address: account.address,
      typedData: read,
      signature,
      now,
    });
    expect(verified?.address.toLowerCase()).toBe(account.address.toLowerCase());
    await expect(
      verifyWalletReadAuthorization({
        accountId: 'another-account',
        address: account.address,
        typedData: read,
        signature,
        now,
      }),
    ).resolves.toBeUndefined();
    await expect(
      verifyWalletReadAuthorization({
        accountId: 'account-test-1',
        address: account.address,
        typedData: read,
        signature,
        now: '2026-10-03T15:03:00.000Z',
      }),
    ).resolves.toBeUndefined();
  });

  it('blocks stale revocation generation, expired authorization and delegate mismatch', async () => {
    const { grant, privateKey } = await fixtureGrant();
    const typedData = buildAuthorizationTypedData({
      grant,
      planDigest: hash('e'),
      action: 'REDUCE_POSITION',
      validUntil: '2026-10-03T15:05:00.000Z',
      nonce,
      revocationGeneration: 0,
    });
    const signer = privateKeyToAccount(privateKey);
    const signature = await signer.signTypedData(typedData);
    const common = {
      grant,
      typedData,
      signature,
      expected: {
        planDigest: hash('e'),
        action: 'REDUCE_POSITION' as const,
        signer: signer.address,
        revocationGeneration: 1,
        delegationObservationHash: hash('d'),
      },
    };
    await expect(
      verifyAuthorization({ ...common, expected: { ...common.expected, now } }),
    ).resolves.toBeUndefined();
    await expect(
      verifyAuthorization({
        ...common,
        expected: {
          ...common.expected,
          revocationGeneration: 0,
          delegationObservationHash: hash('f'),
          now,
        },
      }),
    ).resolves.toBeUndefined();
    await expect(
      verifyAuthorization({
        ...common,
        expected: {
          ...common.expected,
          revocationGeneration: 0,
          delegationObservationHash: hash('d'),
          now: '2026-10-03T15:06:00.000Z',
        },
      }),
    ).resolves.toBeUndefined();
  });

  it('classifies EIP-7702 delegation indicators and invalidates changed delegates', () => {
    const first = classifyEip7702Code(`0xef0100${'1'.repeat(40)}`);
    expect(first.status).toBe('ACTIVE');
    expect(first.delegateAddress).toBe(`0x${'1'.repeat(40)}`);
    expect(classifyEip7702Code('0x').status).toBe('ABSENT');
    expect(classifyEip7702Code('not-hex').status).toBe('UNKNOWN');
    expect(classifyEip7702Code(`0xef0100${'2'.repeat(40)}`, first).status).toBe('CHANGED');
    expect(classifyEip7702Code('0x', first).status).toBe('REVOKED');
  });

  it('observes delegate address and runtime code at one finalized hash; uncertainty blocks', async () => {
    const block = { number: '9001', hash: `0x${'a'.repeat(64)}` };
    const delegateRuntime = '0x60006000';
    const result = await observeEip7702Delegation({
      port: {
        chainId: async () => 10_143,
        finalizedBlock: async () => block,
        codeAtBlockHash: async (address) =>
          address.toLowerCase() === `0x${'1'.repeat(40)}`
            ? `0xef0100${'2'.repeat(40)}`
            : delegateRuntime,
      },
      account: `0x${'1'.repeat(40)}`,
      expectedChainId: 10_143,
      now,
    });
    expect(result.status).toBe('ACTIVE');
    expect(result.delegateAddress?.toLowerCase()).toBe(`0x${'2'.repeat(40)}`);
    expect(result.delegateCodeHash).toBe(
      keccak256(toHex(Buffer.from(delegateRuntime.slice(2), 'hex'))).slice(2),
    );
    const uncertain = await observeEip7702Delegation({
      port: {
        chainId: async () => 10_143,
        finalizedBlock: async () => {
          throw new Error('finalized unavailable');
        },
        codeAtBlockHash: async () => '0x',
      },
      account: `0x${'1'.repeat(40)}`,
      expectedChainId: 10_143,
      now,
    });
    expect(uncertain.status).toBe('UNKNOWN');
  });

  it('derives sessions only as shorter-lived strict subsets with a separate nonce domain', async () => {
    const { grant } = await fixtureGrant();
    const session = await deriveSessionAuthority({
      sessionId: 'session-1',
      grant,
      actions: ['NO_ACTION'],
      maxActionFractionBps: 1_000,
      maxNotionalMicros: '500000',
      maxSlippageBps: 100,
      expiresAt: '2026-10-03T16:00:00.000Z',
      nonceDomain: 'nerva:session:session-1',
      now,
    });
    expect(session.grantId).toBe(grant.grantId);
    expect(session.nonceDomain).not.toBe(grant.source.nonceDomain);
    await expect(
      deriveSessionAuthority({
        sessionId: 'session-2',
        grant,
        actions: ['CLOSE_POSITION'],
        maxActionFractionBps: 1_000,
        maxNotionalMicros: '500000',
        maxSlippageBps: 100,
        expiresAt: '2026-10-03T16:00:00.000Z',
        nonceDomain: 'nerva:session:session-2',
        now,
      }),
    ).rejects.toThrow();
  });

  it('requires a fresh wallet proof bound to the exact session before revocation', async () => {
    const { grant, privateKey } = await fixtureGrant();
    const session = await deriveSessionAuthority({
      sessionId: 'session-revoke-1',
      grant,
      actions: ['NO_ACTION'],
      maxActionFractionBps: 1_000,
      maxNotionalMicros: '500000',
      maxSlippageBps: 100,
      expiresAt: '2026-10-03T16:00:00.000Z',
      nonceDomain: 'nerva:session:session-revoke-1',
      now,
    });
    const typedData = buildSessionRevocationTypedData({
      sessionId: session.sessionId,
      sessionHash: session.digest,
      grant,
      revocationGeneration: 0,
      issuedAt: now,
      validUntil: '2026-10-03T15:04:00.000Z',
      nonce,
    });
    const signer = privateKeyToAccount(privateKey);
    const signature = await signer.signTypedData(typedData);
    const verified = await verifySessionRevocation({
      sessionId: session.sessionId,
      sessionHash: session.digest,
      grant,
      generation: 0,
      typedData,
      signature,
      now,
    });
    expect(verified?.signer.toLowerCase()).toBe(grant.walletAddress.toLowerCase());
    await expect(
      verifySessionRevocation({
        sessionId: session.sessionId,
        sessionHash: session.digest,
        grant,
        generation: 1,
        typedData,
        signature,
        now,
      }),
    ).resolves.toBeUndefined();
    await expect(
      verifySessionRevocation({
        sessionId: 'session-revoke-other',
        sessionHash: session.digest,
        grant,
        generation: 0,
        typedData,
        signature,
        now,
      }),
    ).resolves.toBeUndefined();
    await expect(
      verifySessionRevocation({
        sessionId: session.sessionId,
        sessionHash: session.digest,
        grant,
        generation: 0,
        typedData: {
          ...typedData,
          domain: { ...typedData.domain, chainId: 143 },
        },
        signature,
        now,
      }),
    ).resolves.toBeUndefined();
  });

  it('hash-links privacy-minimized permission evidence and detects edits, deletion and reorder', async () => {
    const first = await appendPermissionEvidence(undefined, {
      kind: 'GRANT_COMPILED',
      subjectRef: 'grant-test-1',
      correlationId: 'm04-test-1',
      occurredAt: now,
      result: 'PASS',
      reasonCode: 'GRANT_COMPILED',
    });
    const second = await appendPermissionEvidence(first, {
      kind: 'AUTHORIZATION_VERIFIED',
      subjectRef: hash('e'),
      correlationId: 'm04-test-1',
      occurredAt: now,
      result: 'PASS',
      reasonCode: 'M03_PLAN_BOUND',
    });
    expect(await verifyPermissionEvidenceChain([first, second])).toBe(true);
    expect(
      await verifyPermissionEvidenceChain([
        { ...second, credential: 'forbidden' } as unknown as typeof second,
      ]),
    ).toBe(false);
    expect(await verifyPermissionEvidenceChain([second, first])).toBe(false);
    expect(
      await verifyPermissionEvidenceChain([first, { ...second, reasonCode: 'TAMPERED' }]),
    ).toBe(false);
    expect(Object.keys(second)).not.toContain('signature');
  });
});
