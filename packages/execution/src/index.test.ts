import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { RiskSnapshot } from '@nerva/domain';
import {
  M03_FIXTURE_NOW,
  m03AdverseRiskFixture,
  m03ConfirmationProof,
  m03PolicyFixture,
  m03PositionContextFixture,
} from '@nerva/testing';
import {
  compileM03Policy,
  confirmM03Policy,
  evaluateM03Triggers,
  planM03Action,
  simulateM03Plan,
  verifyPositionAccountBinding,
  type M03PositionContext,
  type PositionAccountBindingVerifier,
} from '@nerva/policy';
import {
  executeM03Testnet,
  MemoryExecutionStore,
  recoverM03Execution,
  type ExecutionEvent,
  type KillSwitch,
} from './index.js';

const now = M03_FIXTURE_NOW;
const sourceRisk = JSON.parse(
  readFileSync(new URL('../../policy/fixtures/risk-fresh-adverse.json', import.meta.url), 'utf8'),
) as RiskSnapshot;

function policy() {
  return m03PolicyFixture({
    policyId: 'execution-test',
    createdByActorRef: 'actor:test',
    metadata: { label: 'Execution gate test', description: 'Synthetic only.' },
  });
}

async function setup() {
  const risk: RiskSnapshot = m03AdverseRiskFixture(sourceRisk, 'execution-fixture-risk', now);
  const compiled = await compileM03Policy(policy());
  if (!compiled.policy) throw new Error('Expected a compiled fixture policy');
  const proof = m03ConfirmationProof(compiled.policy.canonicalHash, {
    issuer: 'issuer:test',
    subject: 'actor:test',
  });
  const confirmed = await confirmM03Policy({
    compiled: compiled.policy,
    proof,
    verifier: {
      async verifyConfirmation() {
        return { issuerId: 'issuer:test', actorId: 'actor:test', proofRef: 'test-ref' };
      },
    },
    nonceLedger: {
      async consume() {
        return true;
      },
    },
    now,
  });
  const context: M03PositionContext = m03PositionContextFixture({
    riskSnapshotHash: risk.snapshotHash!,
    now,
  });
  const bindingVerifier: PositionAccountBindingVerifier = {
    async verify({ context: received }) {
      return {
        provider: 'perpl',
        accountId: received.accountId,
        positionId: received.positionId,
        network: 'monad-testnet',
        sourceSnapshotHash: received.position.source.contentHash,
        proofRef: 'synthetic-position-binding',
      };
    },
  };
  const binding = await verifyPositionAccountBinding({
    context,
    riskSnapshotHash: risk.snapshotHash!,
    now,
    verifier: bindingVerifier,
  });
  const evaluation = await evaluateM03Triggers({ policy: confirmed, risk, now });
  const planned = await planM03Action({
    policy: confirmed,
    evaluation,
    risk,
    positionContext: context,
    positionBinding: binding,
    now,
  });
  if (planned.status !== 'PLANNED') throw new Error('Expected a bounded fixture plan');
  const dryRun = await simulateM03Plan({ plan: planned.plan, policy: confirmed, risk, now });
  const authorization = {
    schemaVersion: '0.1',
    issuer: 'issuer:test',
    subject: 'actor:test',
    audience: 'nerva-testnet-execution-v1',
    environment: 'TESTNET',
    network: 'monad-testnet',
    chainId: 10_143,
    policyHash: planned.plan.policyVersionHash,
    planDigest: planned.plan.digest,
    accountId: '42',
    positionId: '21',
    action: 'REDUCE_POSITION',
    scope: ['REDUCE_POSITION'],
    nonce: 'execution-nonce-00000001',
    keyId: 'test-key',
    issuedAt: now,
    expiresAt: '2026-10-03T03:04:00.000Z',
    signature: 'test-only-signature-value-0000000000000',
  };
  const enrollment = {
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
    keyId: 'test-key',
    proofRef: 'redacted-testnet-enrollment-evidence',
    verifiedAt: now,
    expiresAt: '2026-10-03T03:04:00.000Z',
    signature: 'test-only-signature-value-0000000000000',
  };
  return {
    policy: confirmed,
    confirmed,
    risk,
    plan: planned.plan,
    dryRun,
    authorizationProof: authorization,
    enrollmentEvidence: enrollment,
    now,
  };
}

function killSwitch(enabled = false): KillSwitch {
  return {
    async isEnabled() {
      return enabled;
    },
    async runIfDisabled<T>(operation: () => Promise<T>) {
      return enabled ? { permitted: false } : { permitted: true, value: await operation() };
    },
  };
}

describe('M03 effect boundary and recovery', () => {
  it('blocks UNKNOWN simulation before authorization and any provider call', async () => {
    const setupResult = await setup();
    const provider = { submitProtective: vi.fn(), reconcile: vi.fn() };
    const result = await executeM03Testnet({
      ...setupResult,
      dryRun: { ...setupResult.dryRun, status: 'UNKNOWN' },
      store: new MemoryExecutionStore(),
      killSwitch: killSwitch(),
      provider,
    });
    expect(result.state).toBe('REFUSED');
    expect(result.reason).toBe('SIMULATION_UNKNOWN');
    expect(provider.submitProtective).not.toHaveBeenCalled();
  });

  it('refuses the documented broad Perpl trade scope and never dispatches', async () => {
    const setupResult = await setup();
    const provider = { submitProtective: vi.fn(), reconcile: vi.fn() };
    const result = await executeM03Testnet({
      ...setupResult,
      store: new MemoryExecutionStore(),
      killSwitch: killSwitch(),
      authorizationVerifier: {
        async verify() {
          return { issuerId: 'issuer:test', actorId: 'actor:test', proofRef: 'verified' };
        },
      },
      enrollmentVerifier: {
        async verify() {
          return { issuerId: 'issuer:perpl-test', scopeRef: 'verified-broad-scope' };
        },
      },
      nonceLedger: {
        async consume() {
          return true;
        },
      },
      preflightVerifier: {
        async verify({ plan }) {
          return {
            schemaVersion: '0.1',
            provider: 'perpl',
            status: 'PASS',
            planDigest: plan.digest,
            policyVersionHash: plan.policyVersionHash,
            sourceSnapshotHash: plan.snapshotHash,
            environment: 'TESTNET',
            network: 'monad-testnet',
            chainId: 10_143,
            simulatorVersion: 'test-only-preflight',
            checkedAt: now,
            expiresAt: '2026-10-03T03:04:00.000Z',
            evidenceRef: 'synthetic-test-preflight',
          };
        },
      },
      provider,
    });
    expect(result.state).toBe('REFUSED');
    expect(result.reason).toBe('NO_DOCUMENTED_PROTECTIVE_ONLY_PERPL_SCOPE');
    expect(provider.submitProtective).not.toHaveBeenCalled();
  });

  it('kill switch prevents authorization even with exact-plan simulation and supplied proofs', async () => {
    const setupResult = await setup();
    const provider = { submitProtective: vi.fn(), reconcile: vi.fn() };
    const result = await executeM03Testnet({
      ...setupResult,
      store: new MemoryExecutionStore(),
      killSwitch: killSwitch(true),
      provider,
    });
    expect(result.state).toBe('REFUSED');
    expect(result.reason).toBe('KILL_SWITCH_ENABLED_BEFORE_AUTHORIZATION');
    expect(provider.submitProtective).not.toHaveBeenCalled();
  });

  it('recovery reconciles read-only and never resubmits an ambiguous attempt', async () => {
    const { plan } = await setup();
    const store = new MemoryExecutionStore();
    const ambiguous: ExecutionEvent = {
      schemaVersion: '0.1',
      eventId: 'replay-event-1',
      idempotencyKey: plan.idempotencyKey,
      planDigest: plan.digest,
      correlationId: plan.correlationId,
      state: 'RECOVERY_REQUIRED',
      reason: 'AMBIGUOUS_PROVIDER_RESULT',
      occurredAt: now,
    };
    await store.append(ambiguous);
    const provider = {
      submitProtective: vi.fn(),
      reconcile: vi.fn(async () => ({
        outcome: 'NOT_SUBMITTED' as const,
        reason: 'No effect exists',
      })),
    };
    const result = await recoverM03Execution({ plan, store, provider, now });
    expect(result.state).toBe('RECOVERY_REQUIRED');
    expect(result.reason).toBe('FRESH_EVALUATION_AND_NEW_PLAN_REQUIRED');
    expect(provider.reconcile).toHaveBeenCalledTimes(1);
    expect(provider.submitProtective).not.toHaveBeenCalled();
  });

  it('persistent idempotency claim suppresses duplicate and conflicting plans', async () => {
    const { plan } = await setup();
    const store = new MemoryExecutionStore();
    const identity = {
      idempotencyKey: plan.idempotencyKey,
      planDigest: plan.digest,
      provider: 'perpl' as const,
      network: 'monad-testnet' as const,
      accountId: plan.accountId,
    };
    expect(await store.claim(identity)).toBe('CLAIMED');
    expect(await store.claim(identity)).toBe('DUPLICATE');
    expect(await store.claim({ ...identity, planDigest: 'd'.repeat(64) })).toBe('CONFLICT');
    const concurrentStore = new MemoryExecutionStore();
    const concurrent = await Promise.all([
      concurrentStore.claim(identity),
      concurrentStore.claim(identity),
    ]);
    expect(concurrent.sort()).toEqual(['CLAIMED', 'DUPLICATE']);
  });
});
