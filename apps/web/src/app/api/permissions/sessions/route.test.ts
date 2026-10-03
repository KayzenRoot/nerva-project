import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  buildWalletBindingTypedData,
  compileCapabilityGrant,
  verifyAgentIdentity,
  verifyWalletIdentityBinding,
} from '@nerva/permissions';

const mocks = vi.hoisted(() => ({
  loadGrant: vi.fn(),
  latestDelegation: vi.fn(),
  persistSession: vi.fn(),
  poolEnd: vi.fn(),
}));

vi.mock('@nerva/db', () => ({
  createDatabase: () => ({ pool: { end: mocks.poolEnd } }),
  loadM04CompiledGrant: (...args: unknown[]) => mocks.loadGrant(...args),
  latestM04DelegationObservation: (...args: unknown[]) => mocks.latestDelegation(...args),
  persistM04Session: (...args: unknown[]) => mocks.persistSession(...args),
}));

vi.mock('@nerva/config', () => ({
  loadServerConfig: () => ({ databaseUrl: 'postgres://nerva:test@localhost/nerva' }),
}));

import { POST } from './route.js';

const hash = (digit: string) => digit.repeat(64);
const nonce = `0x${'a'.repeat(64)}`;

function request(body: unknown): Request {
  return new Request('http://localhost/api/permissions/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function makeGrant() {
  const owner = privateKeyToAccount(generatePrivateKey());
  const now = new Date(Math.floor(Date.now() / 1_000) * 1_000).toISOString();
  const validUntil = new Date(Date.parse(now) + 240_000).toISOString();
  const walletProof = buildWalletBindingTypedData({
    accountId: 'session-route-account',
    address: owner.address,
    issuedAt: now,
    validUntil,
    nonce,
  });
  const wallet = await verifyWalletIdentityBinding({
    typedData: walletProof,
    signature: await owner.signTypedData(walletProof),
    expected: { accountId: 'session-route-account', address: owner.address, now },
  });
  if (!wallet) throw new Error('test wallet binding was not verified');
  const agent = await verifyAgentIdentity({
    identity: {
      agentId: 'session-route-agent',
      version: 1,
      issuerId: 'test-issuer',
      provenanceHash: hash('b'),
      walletAddress: owner.address,
      chainId: 10_143,
    },
    verifyIssuer: async () => true,
  });
  if (!agent) throw new Error('test agent identity was not verified');
  const grant = await compileCapabilityGrant({
    schemaVersion: '0.1',
    grantId: 'session-route-grant',
    wallet,
    agent,
    policyHash: hash('c'),
    scope: { positionId: '42', marketSelector: 'BTC-PERP' },
    actions: ['REDUCE_POSITION', 'NO_ACTION'],
    limits: {
      maxActionFractionBps: 2_000,
      maxNotionalMicros: '1000000',
      maxSlippageBps: 100,
    },
    issuedAt: now,
    expiresAt: new Date(Date.parse(now) + 3_600_000).toISOString(),
    revocationGeneration: 0,
    nonceDomain: 'nerva:grant:session-route',
    delegation: { status: 'ABSENT', observationHash: hash('d') },
  });
  return { owner, grant };
}

describe('M04 session issuance API', () => {
  beforeEach(() => {
    mocks.loadGrant.mockReset();
    mocks.latestDelegation.mockReset();
    mocks.persistSession.mockReset();
    mocks.poolEnd.mockReset();
    mocks.persistSession.mockResolvedValue(true);
  });
  afterEach(() => vi.clearAllMocks());

  it('does not persist a session from caller parameters and grantId without an owner signature', async () => {
    const { owner, grant } = await makeGrant();
    const issuedAt = new Date(Math.floor(Date.now() / 1_000) * 1_000).toISOString();
    const validUntil = new Date(Date.parse(issuedAt) + 240_000).toISOString();
    const expiresAt = new Date(Date.parse(issuedAt) + 1_200_000).toISOString();
    mocks.loadGrant.mockResolvedValue({ grant, generation: 0, revoked: false });
    mocks.latestDelegation.mockResolvedValue({
      observation: { status: 'ABSENT', observedAt: issuedAt },
      observedAt: issuedAt,
    });
    const body = {
      schemaVersion: '0.1',
      grantId: grant.grantId,
      sessionId: 'session-route-one',
      actions: ['REDUCE_POSITION'],
      maxActionFractionBps: 500,
      maxNotionalMicros: '200000',
      maxSlippageBps: 50,
      expiresAt,
      nonceDomain: 'nerva:session:session-route-one',
      issuedAt,
      validUntil,
      nonce,
      correlationId: 'session-route-issue',
    };

    const challenge = await POST(request(body));
    const challengeBody = await challenge.json();
    expect(challenge.status).toBe(200);
    expect(challengeBody.status).toBe('AWAITING_OWNER_SIGNATURE');
    expect(challengeBody.executionEnabled).toBe(false);
    expect(challengeBody.typedData.message.account.toLowerCase()).toBe(owner.address.toLowerCase());
    expect(mocks.persistSession).not.toHaveBeenCalled();

    const signature = await owner.signTypedData(challengeBody.typedData);
    const issued = await POST(request({ ...body, signature }));
    const issuedBody = await issued.json();
    expect(issued.status).toBe(201);
    expect(issuedBody.status).toBe('ISSUED');
    expect(issuedBody.session.sessionId).toBe(body.sessionId);
    expect(mocks.persistSession).toHaveBeenCalledTimes(1);
    expect(mocks.persistSession.mock.calls[0]?.[2]).toMatchObject({
      proofRefHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      typedDataDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      nonceHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });
});
