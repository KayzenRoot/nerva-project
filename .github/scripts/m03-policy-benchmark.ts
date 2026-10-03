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
import {
  M03_FIXTURE_NOW,
  m03ConfirmationProof,
  m03PolicyFixture,
  m03PositionContextFixture,
} from '../../packages/testing/src/index.ts';

const now = M03_FIXTURE_NOW;
const policyInput = m03PolicyFixture({
  policyId: 'benchmark-policy',
  createdByActorRef: 'actor:synthetic-benchmark',
  metadata: { label: 'Synthetic benchmark', description: 'No provider reads or effects.' },
});
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
  proof: m03ConfirmationProof(compiled.policy.canonicalHash, {
    issuer: 'issuer:benchmark',
    subject: 'actor:synthetic-benchmark',
    nonce: 'synthetic-benchmark-nonce-0001',
    keyId: 'benchmark-key',
    signature: 'synthetic-only-no-live-issuer-proof-000000000000000000',
  }),
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
const context: M03PositionContext = m03PositionContextFixture({
  riskSnapshotHash: risk.snapshotHash!,
  now,
  source: 'synthetic-benchmark',
  correlationId: 'm03-benchmark',
});
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
