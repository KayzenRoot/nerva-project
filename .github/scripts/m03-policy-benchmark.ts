import { readFileSync } from 'node:fs';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import {
  compileM03Policy,
  confirmM03Policy,
  evaluateM03Triggers,
  planM03Action,
  verifyPositionAccountBinding,
  type M03PositionContext,
} from '../../packages/policy/src/index.ts';
import { type RiskSnapshot } from '../../packages/domain/src/index.ts';

const now = '2026-10-03T03:00:00.000Z';
const policyInput = {
  schemaVersion: '0.1',
  policyId: 'benchmark-policy',
  version: 1,
  createdByActorRef: 'actor:synthetic-benchmark',
  environment: 'TESTNET',
  scope: {
    network: 'monad-testnet',
    protocolCapability: 'perpl-protective-v0',
    accountId: '42',
    positionId: '21',
    marketSelector: 'ETH-PERP',
  },
  triggers: [{ metric: 'POSITION_ADVERSE_MOVE_BPS', operator: 'GTE', thresholdBps: 1_000 }],
  actionIntent: { family: 'REDUCE_POSITION', maxActionFractionBps: 2_500 },
  constraints: {
    maxActionFractionBps: 2_500,
    maxReducibleQuantityScaled: '90000',
    maxNotionalMicros: '900000',
    maxSlippageBps: 100,
    cooldownSeconds: 60,
    expiresAt: '2030-01-01T00:00:00.000Z',
    maxPlanAgeSeconds: 30,
    allowedProtocols: ['perpl-protective-v0'],
    allowedMarkets: ['ETH-PERP'],
    fallbackAction: 'NO_ACTION',
  },
  safetyBehavior: 'REFUSE',
  metadata: { label: 'Synthetic benchmark', description: 'No provider reads or effects.' },
};
const risk = JSON.parse(
  readFileSync(
    new URL('../../packages/policy/fixtures/risk-fresh-adverse.json', import.meta.url),
    'utf8',
  ),
) as RiskSnapshot;
const compiled = await compileM03Policy(policyInput);
if (!compiled.policy) throw new Error('Synthetic policy did not compile');
const policy = await confirmM03Policy({
  compiled: compiled.policy,
  proof: {
    schemaVersion: '0.1',
    issuer: 'issuer:benchmark',
    subject: 'actor:synthetic-benchmark',
    audience: 'nerva-policy-confirmation-v1',
    policyHash: compiled.policy.canonicalHash,
    nonce: 'synthetic-benchmark-nonce-0001',
    keyId: 'benchmark-key',
    issuedAt: now,
    expiresAt: '2026-10-03T03:04:00.000Z',
    signature: 'synthetic-only-no-live-issuer-proof-000000000000000000',
  },
  verifier: {
    async verifyConfirmation() {
      return {
        issuerId: 'issuer:benchmark',
        actorId: 'actor:synthetic-benchmark',
        proofRef: 'synthetic-only',
      };
    },
  },
  nonceLedger: {
    async consume() {
      return true;
    },
  },
  now,
});
const context: M03PositionContext = {
  accountId: '42',
  positionId: '21',
  marketSelector: 'ETH-PERP',
  network: 'monad-testnet',
  chainId: 10_143,
  currentRiskSnapshotHash: risk.snapshotHash!,
  positionNotionalMicros: '1000000',
  position: {
    schemaVersion: '0.1',
    snapshotId: 'benchmark-position-1',
    positionId: '21',
    marketId: '32',
    symbol: 'ETH',
    side: 'LONG',
    sizeScaled: '100000',
    sizeDecimals: 3,
    entryPriceScaled: '250000',
    entryPriceDecimals: 2,
    markPriceScaled: '246250',
    markPriceDecimals: 2,
    collateralMicros: '500000',
    quoteToken: 'USDC',
    source: {
      source: 'synthetic-benchmark',
      network: 'monad-testnet',
      chainId: 10_143,
      observedAt: now,
      receivedAt: now,
      quality: 'FRESH',
      correlationId: 'm03-benchmark',
      contentHash: 'b'.repeat(64),
    },
  },
};
const binding = await verifyPositionAccountBinding({
  context,
  riskSnapshotHash: risk.snapshotHash!,
  now,
  verifier: {
    async verify({ context: value }) {
      return {
        provider: 'perpl',
        accountId: value.accountId,
        positionId: value.positionId,
        network: 'monad-testnet',
        sourceSnapshotHash: value.position.source.contentHash,
        proofRef: 'synthetic-only-position-binding',
      };
    },
  },
});

async function decisionToPlan() {
  const evaluation = await evaluateM03Triggers({ policy, risk, now });
  const plan = await planM03Action({
    policy,
    evaluation,
    risk,
    positionContext: context,
    positionBinding: binding,
    now,
  });
  if (plan.status !== 'PLANNED') throw new Error(`Synthetic planner refused: ${plan.reason}`);
}

const warmup = 100;
const iterations = 1_000;
for (let index = 0; index < warmup; index += 1) await decisionToPlan();
const evaluationSamples: number[] = [];
const planningSamples: number[] = [];
const decisionToPlanSamples: number[] = [];
for (let index = 0; index < iterations; index += 1) {
  const decisionStart = performance.now();
  const evaluationStart = performance.now();
  const evaluation = await evaluateM03Triggers({ policy, risk, now });
  evaluationSamples.push(performance.now() - evaluationStart);
  const planStart = performance.now();
  const plan = await planM03Action({
    policy,
    evaluation,
    risk,
    positionContext: context,
    positionBinding: binding,
    now,
  });
  planningSamples.push(performance.now() - planStart);
  if (plan.status !== 'PLANNED') throw new Error(`Synthetic planner refused: ${plan.reason}`);
  decisionToPlanSamples.push(performance.now() - decisionStart);
}

function percentile(samples: number[], value: number) {
  samples.sort((left, right) => left - right);
  return Number(samples[Math.ceil(samples.length * value) - 1]!.toFixed(3));
}

const evaluationP95Ms = percentile(evaluationSamples, 0.95);
const planningP95Ms = percentile(planningSamples, 0.95);
const decisionToReadyPlanP95Ms = percentile(decisionToPlanSamples, 0.95);
const output = {
  ok: evaluationP95Ms <= 50 && decisionToReadyPlanP95Ms <= 250,
  iterations,
  warmup,
  positionsPerDecision: 1,
  evaluationP95Ms,
  evaluationTargetMs: 50,
  decisionToReadyPlanP95Ms,
  decisionToReadyPlanTargetMs: 250,
  planningOnlyP95Ms: planningP95Ms,
  runtime: process.version,
  platform: `${process.platform}/${process.arch}`,
  cpu: os.cpus()[0]?.model ?? 'UNAVAILABLE',
  methodology:
    'In-memory deterministic synthetic risk/policy/position fixtures; warmup followed by 1000 timed evaluations and plans; no database, network, provider call or financial effect.',
  liveProviderProof: false,
};
console.log(JSON.stringify(output));
if (!output.ok) process.exitCode = 1;
