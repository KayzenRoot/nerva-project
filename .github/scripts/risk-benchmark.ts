import { performance } from 'node:perf_hooks';
import { evaluateRisk } from '../../packages/risk/src/engine.ts';

const generatedAt = '2026-10-02T12:00:00.000Z';
const source = Object.freeze({
  source: 'perpl',
  network: 'monad-mainnet' as const,
  chainId: 143,
  observedAt: generatedAt,
  receivedAt: generatedAt,
  quality: 'FRESH' as const,
  correlationId: 'M02-PERF-001',
  contentHash: 'a'.repeat(64),
});
const position = Object.freeze({
  positionId: 'fixture-position-1',
  marketId: '1',
  symbol: 'ETH-PERP',
  side: 'LONG' as const,
  sizeScaled: '250000',
  sizeDecimals: 4,
  entryPriceScaled: '200000',
  entryPriceDecimals: 18,
  markPriceScaled: '180000',
  markPriceDecimals: 2,
  collateralMicros: '5000000',
  quoteToken: 'USDC',
  source,
});
const input = Object.freeze({
  generatedAt,
  positions: [position],
  account: { status: 'AVAILABLE' as const, collateralMicros: '5000000', source },
  portfolio: {
    period: 'day' as const,
    points: [
      { at: '2026-10-01T00:00:00.000Z', valueMicros: '10000000' },
      { at: generatedAt, valueMicros: '9000000' },
    ],
    source,
  },
  requiredSources: [source],
  maxSourceAgeMs: 5_000,
  maxAccountSourceAgeMs: 15_000,
});

for (let index = 0; index < 100; index += 1) await evaluateRisk(input);
const samples: number[] = [];
for (let index = 0; index < 1_000; index += 1) {
  const start = performance.now();
  await evaluateRisk(input);
  samples.push(performance.now() - start);
}
samples.sort((left, right) => left - right);
const p95Ms = samples[Math.ceil(samples.length * 0.95) - 1]!;
const output = {
  ok: p95Ms <= 100,
  iterations: samples.length,
  warmup: 100,
  positionsPerEvaluation: 1,
  p95Ms: Number(p95Ms.toFixed(3)),
  targetMs: 100,
  methodology:
    'in-memory deterministic fixed-point evaluation; includes canonical SHA-256 snapshot identity',
};
console.log(JSON.stringify(output));
if (!output.ok) process.exitCode = 1;
