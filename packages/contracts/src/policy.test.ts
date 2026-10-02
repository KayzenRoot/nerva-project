import { describe, expect, it } from 'vitest';
import { createPolicyVersion, transitionPolicy } from '@nerva/domain';
import { PolicySchemaV0_1 } from './index.js';

const validPolicy = {
  schemaVersion: '0.1',
  policyId: 'policy-demo-1',
  version: 1,
  environment: 'TESTNET_DEMO',
  scope: {
    network: 'monad-testnet',
    protocolCapability: 'generic-risk-preview-v0',
    marketSelector: 'ETH-PERP',
  },
  triggers: [{ family: 'DRAWDOWN_THRESHOLD', thresholdBps: 1_000 }],
  actionIntent: { family: 'REDUCE_POSITION', maxActionFractionBps: 2_500 },
  constraints: {
    maxActionFractionBps: 2_500,
    maxNotionalMicros: '100000000',
    maxSlippageBps: 100,
    cooldownSeconds: 60,
    expiresAt: '2030-01-01T00:00:00.000Z',
    allowedProtocols: ['generic-risk-preview-v0'],
    allowedMarkets: ['ETH-PERP'],
  },
  safetyBehavior: 'REFUSE',
  metadata: { label: 'Demo policy', description: 'No execution authority' },
};

describe('M01-POL-001/003 PolicySchemaV0_1', () => {
  it('accepts a bounded strict V0.1 policy', () => {
    const result = PolicySchemaV0_1.safeParse(validPolicy);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(
        transitionPolicy('DRAFT', 'VALIDATED', {
          policyToValidate: result.data,
          now: '2029-01-01T00:00:00.000Z',
        }),
      ).toBe('VALIDATED');
    }
  });

  it('does not advance an invalid policy to VALIDATED', () => {
    const result = PolicySchemaV0_1.safeParse({ ...validPolicy, arbitraryExecutionData: true });
    expect(result.success).toBe(false);
    expect(() =>
      transitionPolicy('DRAFT', 'VALIDATED', {
        policyToValidate: { ...validPolicy, arbitraryExecutionData: true },
        now: '2029-01-01T00:00:00.000Z',
      }),
    ).toThrow(/validation/i);
  });

  it('creates a new immutable version and different hash for a material revision', async () => {
    const firstPolicy = await PolicySchemaV0_1.safeParseAsync(validPolicy).then((result) => {
      if (!result.success) throw result.error;
      return result.data;
    });
    const firstVersion = await createPolicyVersion(firstPolicy);
    const materialChangeAtSameVersion = await createPolicyVersion({
      ...firstPolicy,
      constraints: { ...firstPolicy.constraints, maxSlippageBps: 101 },
    });
    expect(materialChangeAtSameVersion.canonicalHash).not.toBe(firstVersion.canonicalHash);
    const revised = {
      ...validPolicy,
      version: 2,
      constraints: { ...validPolicy.constraints, maxSlippageBps: 101 },
    };
    const revisedPolicy = await PolicySchemaV0_1.safeParseAsync(revised).then((result) => {
      if (!result.success) throw result.error;
      return result.data;
    });
    const revisedVersion = await createPolicyVersion(revisedPolicy);
    expect(revisedVersion.version).toBe(firstVersion.version + 1);
    expect(revisedVersion.policyVersionId).not.toBe(firstVersion.policyVersionId);
    expect(revisedVersion.canonicalHash).not.toBe(firstVersion.canonicalHash);
    expect(Object.isFrozen(revisedVersion.payload)).toBe(true);
    expect(Object.isFrozen(revisedVersion.payload.constraints)).toBe(true);
  });

  it.each([
    ['unknown schema major', { ...validPolicy, schemaVersion: '1.0' }],
    [
      'unsupported protocol capability',
      {
        ...validPolicy,
        scope: { ...validPolicy.scope, protocolCapability: 'unreviewed-provider-v1' },
        constraints: { ...validPolicy.constraints, allowedProtocols: ['unreviewed-provider-v1'] },
      },
    ],
    [
      'environment and network mismatch',
      {
        ...validPolicy,
        environment: 'LOCAL',
        scope: { ...validPolicy.scope, network: 'monad-mainnet' },
      },
    ],
    ['unknown field', { ...validPolicy, arbitraryExecutionData: { calldata: '0xdeadbeef' } }],
    [
      'invalid expiry',
      { ...validPolicy, constraints: { ...validPolicy.constraints, expiresAt: 'later' } },
    ],
    [
      'negative bps',
      { ...validPolicy, actionIntent: { ...validPolicy.actionIntent, maxActionFractionBps: -1 } },
    ],
    [
      'unbounded authority',
      { ...validPolicy, actionIntent: { ...validPolicy.actionIntent, maxActionFractionBps: 0 } },
    ],
    [
      'action exceeds configured max',
      {
        ...validPolicy,
        actionIntent: { ...validPolicy.actionIntent, maxActionFractionBps: 3_000 },
      },
    ],
    ['unsafe fallback', { ...validPolicy, safetyBehavior: 'CONTINUE' }],
    [
      'duplicate trigger',
      { ...validPolicy, triggers: [...validPolicy.triggers, ...validPolicy.triggers] },
    ],
  ])('rejects %s', (_label, candidate) => {
    expect(PolicySchemaV0_1.safeParse(candidate).success).toBe(false);
  });
});
