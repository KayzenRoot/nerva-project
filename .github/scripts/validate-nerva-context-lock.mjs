import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const lockPath = '.engineering/context-locks/NERVA-WO-003.json';
const expectedBase = '166789a107dff6700b7dfab8f240184be14fe3c4';
const admittedHead = '9e329e78ab4ff3ab0b0b96deed29064a6a03126a';
const auditedHead = '3d6f0e2d9b6f5558fc1c4472497f6c09056dca19';
const promotionHead = '43f38ebb448c6248db2d1e9800ea0352bdffb0b4';
const expectedPromotionTree = '11c52ef782c4ceabde14dc12f1c5e8f4af5c36b1';
const acceptedMerge = '402e52922dc88bfac155260e50a0c4019ed57067';
const correctionBranch = 'fix/nerva-wo-003-postmerge-validator';
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const checkpoint = JSON.parse(fs.readFileSync('.engineering/CHECKPOINT.json', 'utf8'));

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function blobAt(ref, file) {
  return git(['rev-parse', `${ref}:${file}`]);
}

if (
  lock.kind !== 'nerva.context-lock' ||
  lock.workOrder !== 'NERVA-WO-003' ||
  lock.module !== 'M02' ||
  lock.status !== 'LOCKED' ||
  lock.repository !== 'KayzenRoot/nerva-project' ||
  lock.executionBase !== expectedBase
) {
  throw new Error('NERVA-WO-003 historical Context Lock identity/base mismatch');
}

for (const [file, expectedBlob] of Object.entries(lock.criticalInputs)) {
  if (blobAt(expectedBase, file) !== expectedBlob) {
    throw new Error(`Historical Context Lock base mismatch for ${file}`);
  }
}

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
) {
  throw new Error('Checkpoint is not the approved M02 state');
}

if (git(['rev-parse', `${acceptedMerge}^`]) !== expectedBase) {
  throw new Error('Accepted M02 squash merge parent does not match the M01 baseline');
}
if (git(['rev-parse', `${acceptedMerge}^{tree}`]) !== expectedPromotionTree) {
  throw new Error('Accepted M02 squash merge tree does not match the validated promotion tree');
}

const head = git(['rev-parse', 'HEAD']);
const main = git(['rev-parse', 'origin/main']);
const branch = process.env.GITHUB_HEAD_REF || git(['branch', '--show-current']);

const allowedCorrectionPaths = new Set([
  '.engineering/evidence/NERVA-WO-003-EVIDENCE.md',
  '.github/scripts/validate-nerva-context-lock.mjs',
]);

function assertCorrectionOnly(from, to) {
  const changed = git(['diff', '--name-only', `${from}..${to}`])
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const forbidden = changed.filter((file) => !allowedCorrectionPaths.has(file));
  if (forbidden.length > 0) {
    throw new Error(`Post-merge correction contains forbidden paths: ${forbidden.join(', ')}`);
  }
  return changed;
}

const correctionPr =
  process.env.GITHUB_EVENT_NAME === 'pull_request' &&
  main === acceptedMerge &&
  branch === correctionBranch;

if (correctionPr) {
  git(['merge-base', '--is-ancestor', acceptedMerge, 'HEAD']);
  const changed = assertCorrectionOnly(acceptedMerge, 'HEAD');
  if (changed.length === 0) {
    throw new Error('Correction PR contains no correction delta');
  }
  console.log(
    JSON.stringify({
      ok: true,
      executionBase: expectedBase,
      admittedHead,
      auditedHead,
      promotionHead,
      promotionTree: expectedPromotionTree,
      acceptedMerge,
      correctionHead: head,
      correctionFiles: changed.length,
      state: 'M02_POST_MERGE_CORRECTION_VALIDATED',
    }),
  );
  process.exit(0);
}

const postMergeMain =
  process.env.GITHUB_EVENT_NAME === 'push' &&
  process.env.GITHUB_REF === 'refs/heads/main' &&
  main === head &&
  main !== expectedBase;

if (postMergeMain) {
  git(['merge-base', '--is-ancestor', acceptedMerge, 'HEAD']);
  const changed = assertCorrectionOnly(acceptedMerge, 'HEAD');
  console.log(
    JSON.stringify({
      ok: true,
      executionBase: expectedBase,
      auditedHead,
      promotionHead,
      promotionTree: expectedPromotionTree,
      acceptedMerge,
      mainHead: head,
      correctionFiles: changed.length,
      state: 'POST_MERGE_CONTEXT_LOCK_HISTORICAL',
    }),
  );
  process.exit(0);
}

throw new Error(
  `NERVA-WO-003 historical validator is not valid for event=${process.env.GITHUB_EVENT_NAME ?? 'local'} branch=${branch} main=${main}`,
);
