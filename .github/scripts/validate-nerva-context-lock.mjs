import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const lockPath = '.engineering/context-locks/NERVA-WO-003.json';
const expectedBase = '166789a107dff6700b7dfab8f240184be14fe3c4';
const expectedBranch = 'feat/nerva-wo-003-m02-data-risk';
const admittedHead = '9e329e78ab4ff3ab0b0b96deed29064a6a03126a';
const auditedHead = '3d6f0e2d9b6f5558fc1c4472497f6c09056dca19';
const expectedLockBlob = 'f01dd4453a7fc4045bde44a1fbce1fc4f944be9d';
const workOrderPath = '.engineering/work-orders/NERVA-WO-003.md';
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const checkpoint = JSON.parse(fs.readFileSync('.engineering/CHECKPOINT.json', 'utf8'));

if (
  lock.kind !== 'nerva.context-lock' ||
  lock.workOrder !== 'NERVA-WO-003' ||
  lock.module !== 'M02' ||
  lock.status !== 'LOCKED' ||
  lock.repository !== 'KayzenRoot/nerva-project' ||
  lock.executionBase !== expectedBase
) throw new Error('NERVA-WO-003 Context Lock identity, status, repository or base mismatch');

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}
function blobAt(ref, file) {
  return git(['rev-parse', `${ref}:${file}`]);
}

const base = lock.executionBase;
const head = git(['rev-parse', 'HEAD']);
const main = git(['rev-parse', 'origin/main']);
const branch = process.env.GITHUB_HEAD_REF || git(['branch', '--show-current']);

for (const [file, expectedBlob] of Object.entries(lock.criticalInputs)) {
  if (blobAt(base, file) !== expectedBlob)
    throw new Error(`Critical input fingerprint mismatch at execution base for ${file}`);
}

const postMergeMain =
  process.env.GITHUB_EVENT_NAME === 'push' &&
  process.env.GITHUB_REF === 'refs/heads/main' &&
  main === head &&
  main !== base;

if (postMergeMain) {
  if (
    checkpoint.m00Status !== 'APPROVED' ||
    checkpoint.m01Status !== 'APPROVED' ||
    checkpoint.m02Status !== 'APPROVED' ||
    checkpoint.activeNextModule !== 'M03' ||
    checkpoint.nextModuleWorkOrder !== 'NOT_ADMITTED' ||
    checkpoint.runtimeProductCode !== 'M02_OBSERVATION_RISK_FOUNDATION' ||
    checkpoint.lastApprovedWorkOrder !== 'NERVA-WO-003' ||
    checkpoint.knownCritical !== 0 ||
    checkpoint.knownHigh !== 0
  ) throw new Error('Post-merge Checkpoint is not the approved M02 state');

  git(['merge-base', '--is-ancestor', auditedHead, 'HEAD']);
  console.log(JSON.stringify({
    ok: true,
    executionBase: base,
    auditedHead,
    mergedHead: head,
    criticalInputs: Object.keys(lock.criticalInputs).length,
    state: 'POST_MERGE_CONTEXT_LOCK_HISTORICAL',
  }));
  process.exit(0);
}

if (main !== base)
  throw new Error(`Context Lock base moved before merge: origin/main=${main}, expected=${base}`);
if (branch && branch !== expectedBranch)
  throw new Error(`Execution branch mismatch: ${branch}`);

git(['merge-base', '--is-ancestor', admittedHead, 'HEAD']);
git(['merge-base', '--is-ancestor', auditedHead, 'HEAD']);

if (blobAt(admittedHead, lockPath) !== expectedLockBlob)
  throw new Error('Admitted Context Lock blob changed');
if (blobAt(admittedHead, workOrderPath) !== blobAt(auditedHead, workOrderPath))
  throw new Error('NERVA-WO-003 changed after admission');
if (blobAt(admittedHead, lockPath) !== blobAt(auditedHead, lockPath))
  throw new Error('Context Lock document changed during M02 execution');

const immutablePaths = [
  '.engineering/CHECKPOINT.md',
  '.engineering/CHECKPOINT.json',
  '.engineering/DECISIONS-LEDGER.md',
  '.engineering/SCOPE.md',
  '.engineering/DEFINITION-OF-DONE.md',
  '.engineering/ARCHITECTURE.md',
  '.engineering/REQUIREMENTS.md',
  '.engineering/SECURITY.md',
  '.engineering/DATA-MODEL.md',
  '.engineering/API-CONTRACTS.md',
  '.engineering/INTEGRATION-CONTRACTS.md',
  '.engineering/TEST-BENCHMARK-PLAN.md',
  '.engineering/MODULE-ROADMAP.md',
  '.engineering/decisions/ADR-0001-AUTHORIZATION-BOUNDARY.md',
  '.engineering/decisions/ADR-0002-GUARDIAN-NERVA-BOUNDARY.md',
];
for (const file of immutablePaths) {
  const expectedBlob = lock.criticalInputs[file];
  if (!expectedBlob)
    throw new Error(`Immutable path missing from Context Lock: ${file}`);
  if (blobAt(auditedHead, file) !== expectedBlob)
    throw new Error(`Audited implementation changed immutable governance input: ${file}`);
}

const allowedPromotionPaths = new Set([
  '.engineering/BACKLOG.md',
  '.engineering/CHECKPOINT.json',
  '.engineering/CHECKPOINT.md',
  '.engineering/SOURCE-HIERARCHY.md',
  '.engineering/checkpoint-deltas/NERVA-WO-003-PROPOSED.md',
  '.engineering/evidence/NERVA-WO-003-EVIDENCE.md',
  '.github/scripts/validate-nerva-context-lock.mjs',
  '.github/scripts/validate-source-pack.mjs',
  'README.md',
]);
const promotionDiff = git(['diff', '--name-only', `${auditedHead}..HEAD`])
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .filter(Boolean);
if (promotionDiff.length === 0)
  throw new Error('No post-audit promotion delta is present');
const forbidden = promotionDiff.filter((file) => !allowedPromotionPaths.has(file));
if (forbidden.length > 0)
  throw new Error(`Post-audit Context Lock drift includes non-promotion paths: ${forbidden.join(', ')}`);

if (
  checkpoint.m00Status !== 'APPROVED' ||
  checkpoint.m01Status !== 'APPROVED' ||
  checkpoint.m02Status !== 'APPROVED' ||
  checkpoint.activeNextModule !== 'M03' ||
  checkpoint.nextModuleWorkOrder !== 'NOT_ADMITTED' ||
  checkpoint.runtimeProductCode !== 'M02_OBSERVATION_RISK_FOUNDATION' ||
  checkpoint.lastApprovedWorkOrder !== 'NERVA-WO-003' ||
  checkpoint.knownCritical !== 0 ||
  checkpoint.knownHigh !== 0
) throw new Error('Checkpoint is not the audited M02 promotion state');

console.log(JSON.stringify({
  ok: true,
  executionBase: base,
  admittedHead,
  auditedHead,
  head,
  originMain: main,
  branch,
  criticalInputs: Object.keys(lock.criticalInputs).length,
  immutableGovernanceFiles: immutablePaths.length,
  promotionFiles: promotionDiff.length,
  state: 'PROMOTION_ONLY_AFTER_APPROVED_AUDIT',
}));
