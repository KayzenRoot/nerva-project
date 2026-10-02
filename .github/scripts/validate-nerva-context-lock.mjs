import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const lockPath = '.engineering/context-locks/NERVA-WO-003.json';
const expectedBase = '166789a107dff6700b7dfab8f240184be14fe3c4';
const expectedBranch = 'feat/nerva-wo-003-m02-data-risk';
const admittedHead = '9e329e78ab4ff3ab0b0b96deed29064a6a03126a';
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
)
  throw new Error('NERVA-WO-003 Context Lock identity, status, repository or base mismatch');

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
const postMergeMain =
  process.env.GITHUB_EVENT_NAME === 'push' &&
  process.env.GITHUB_REF === 'refs/heads/main' &&
  main === head &&
  main !== base;
if (!postMergeMain && main !== base)
  throw new Error(`Context Lock base moved before audit: origin/main=${main}, expected=${base}`);
if (branch && branch !== expectedBranch && !postMergeMain)
  throw new Error(`Execution branch mismatch: ${branch}`);
git(['merge-base', '--is-ancestor', base, 'HEAD']);
git(['merge-base', '--is-ancestor', admittedHead, 'HEAD']);
if (
  blobAt(admittedHead, lockPath) !== expectedLockBlob ||
  blobAt(admittedHead, workOrderPath) !==
    git(['hash-object', `--path=${workOrderPath}`, workOrderPath])
)
  throw new Error('NERVA-WO-003 or its Context Lock differs from the admitted branch copy');
if (blobAt(admittedHead, lockPath) !== git(['hash-object', `--path=${lockPath}`, lockPath]))
  throw new Error('Context Lock document changed during execution');

for (const [file, expectedBlob] of Object.entries(lock.criticalInputs)) {
  const actual = blobAt(base, file);
  if (actual !== expectedBlob)
    throw new Error(
      `Critical input fingerprint mismatch at base for ${file}: ${actual} != ${expectedBlob}`,
    );
}

// The Work Order authorizes M02 runtime edits to some criticalInputs. Stale-if
// governance and already accepted M01 artifacts remain immutable throughout.
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
  if (blobAt(base, file) !== git(['hash-object', `--path=${file}`, file]))
    throw new Error(`Stale-if governance input changed during M02: ${file}`);
}

if (
  checkpoint.phase !== 'IMPLEMENTATION_IN_PROGRESS' ||
  checkpoint.m00Status !== 'APPROVED' ||
  checkpoint.m01Status !== 'APPROVED' ||
  checkpoint.sourcePackStatus !== 'CANONICAL_V0_1' ||
  checkpoint.activeNextModule !== 'M02' ||
  checkpoint.nextModuleWorkOrder !== 'NOT_ADMITTED' ||
  checkpoint.implementationStatus !== 'STARTED' ||
  checkpoint.runtimeProductCode !== 'M01_PLATFORM_FOUNDATION' ||
  checkpoint.lastApprovedWorkOrder !== 'NERVA-WO-002'
)
  throw new Error('Checkpoint changed from the admitted pre-M02 state');

console.log(
  JSON.stringify({
    ok: true,
    executionBase: base,
    admittedHead,
    head,
    originMain: main,
    postMergeMain,
    branch,
    criticalInputs: Object.keys(lock.criticalInputs).length,
    immutableGovernanceFiles: immutablePaths.length,
    state: 'M02_EXECUTION_LOCK_VALIDATED_CHECKPOINT_UNPROMOTED',
  }),
);
