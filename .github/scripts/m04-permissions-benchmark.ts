import { cpus, arch, platform, release } from 'node:os';
import { performance } from 'node:perf_hooks';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  appendPermissionEvidence,
  buildWalletBindingTypedData,
  compileCapabilityGrant,
  verifyAgentIdentity,
  verifyWalletIdentityBinding,
} from '@nerva/permissions';

const started = Date.now();
const issuedAt = new Date(Math.floor(started / 1_000) * 1_000).toISOString();
const expiresAt = new Date(Date.parse(issuedAt) + 60_000).toISOString();
const account = privateKeyToAccount(generatePrivateKey());
const nonce = `0x${'a'.repeat(64)}` as const;
const binding = buildWalletBindingTypedData({
  accountId: 'benchmark-account',
  address: account.address,
  issuedAt,
  validUntil: expiresAt,
  nonce,
});
const wallet = await verifyWalletIdentityBinding({
  typedData: binding,
  signature: await account.signTypedData(binding),
  expected: { accountId: 'benchmark-account', address: account.address, now: issuedAt },
});
if (!wallet) throw new Error('M04 benchmark wallet identity vector failed');
const agent = await verifyAgentIdentity({
  identity: {
    agentId: 'benchmark-agent',
    version: 1,
    issuerId: 'benchmark-issuer',
    provenanceHash: 'b'.repeat(64),
    walletAddress: account.address,
    chainId: 10_143,
  },
  verifyIssuer: async () => true,
});
if (!agent) throw new Error('M04 benchmark agent identity vector failed');
const candidate = {
  schemaVersion: '0.1' as const,
  grantId: 'benchmark-grant',
  wallet,
  agent,
  policyHash: 'c'.repeat(64),
  scope: { positionId: '1', marketSelector: 'BTC-PERP' },
  actions: ['REDUCE_POSITION'] as const,
  limits: { maxActionFractionBps: 1_000, maxNotionalMicros: '100000', maxSlippageBps: 100 },
  issuedAt,
  expiresAt: new Date(Date.parse(issuedAt) + 7_200_000).toISOString(),
  revocationGeneration: 0,
  nonceDomain: 'nerva:benchmark-grant',
  delegation: { status: 'ABSENT' as const, observationHash: 'd'.repeat(64) },
};

function percentile95(samples: readonly number[]): number {
  return (
    [...samples].sort((a, b) => a - b)[
      Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)
    ] ?? 0
  );
}

const compileSamples: number[] = [];
for (let index = 0; index < 10; index += 1) await compileCapabilityGrant(candidate);
for (let index = 0; index < 100; index += 1) {
  const before = performance.now();
  await compileCapabilityGrant(candidate);
  compileSamples.push(performance.now() - before);
}
let evidenceHead = undefined as Awaited<ReturnType<typeof appendPermissionEvidence>> | undefined;
const evidenceSamples: number[] = [];
for (let index = 0; index < 500; index += 1) {
  const before = performance.now();
  evidenceHead = await appendPermissionEvidence(evidenceHead, {
    kind: 'GRANT_COMPILED',
    subjectRef: 'benchmark-reference',
    correlationId: `benchmark-${index}`,
    occurredAt: issuedAt,
    result: 'PASS',
    reasonCode: 'DETERMINISTIC_BENCHMARK',
  });
  evidenceSamples.push(performance.now() - before);
}

console.log(
  JSON.stringify({
    ok: true,
    benchmark: 'M04 deterministic capability compile and append-only evidence hash-chain append',
    warmup: 10,
    compilerSamples: compileSamples.length,
    compilerP95Ms: Number(percentile95(compileSamples).toFixed(3)),
    evidenceSamples: evidenceSamples.length,
    evidenceAppendP95Ms: Number(percentile95(evidenceSamples).toFixed(3)),
    evidenceHeadSequence: evidenceHead?.sequence ?? 0,
    runtime: process.version,
    platform: `${platform()} ${release()} ${arch()}`,
    cpu: cpus()[0]?.model ?? 'unknown',
    fixture: 'ephemeral-signature-key-generated-in-process; no network, wallet or persistence',
  }),
);
