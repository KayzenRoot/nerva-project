import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const m03LockPath = '.engineering/context-locks/NERVA-WO-004.json';
if (fs.existsSync(m03LockPath)) {
  const lock = JSON.parse(fs.readFileSync(m03LockPath, 'utf8'));
  const base = '31cce06cf68aab0a82d3801ed6177b8a3b311869';
  const expectedBranch = 'feat/nerva-wo-004-m03-policy-sim-exec';
  const expectedCriticalInputs = [
    '.engineering/CHECKPOINT.md',
    '.engineering/CHECKPOINT.json',
    '.engineering/DECISIONS-LEDGER.md',
    '.engineering/decisions/ADR-0001-AUTHORIZATION-BOUNDARY.md',
    '.engineering/decisions/ADR-0002-GUARDIAN-NERVA-BOUNDARY.md',
    '.engineering/SOURCE-HIERARCHY.md',
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
    '.engineering/BACKLOG.md',
    '.engineering/UI-UX.md',
    '.engineering/MIGRATION-RECOVERY.md',
    '.engineering/EXTERNAL-EVIDENCE.md',
    '.engineering/DEPLOYMENT.md',
    '.engineering/DEMO-CONTRACT.md',
    '.engineering/work-orders/NERVA-WO-003.md',
    '.engineering/context-locks/NERVA-WO-003.json',
    '.engineering/execution-briefs/NERVA-WO-003-CODEX.md',
    '.engineering/evidence/NERVA-WO-003-EVIDENCE.md',
    '.engineering/checkpoint-deltas/NERVA-WO-003-PROPOSED.md',
    'docs/M02-OBSERVATION-RISK.md',
    'package.json',
    'package-lock.json',
    '.gef/init-state.json',
    '.gef/receipts/run-1-a2be9ac4152d.json',
    '.github/scripts/verify-gef-bootstrap.mjs',
    '.github/scripts/validate-source-pack.mjs',
    '.github/scripts/validate-nerva-context-lock.mjs',
    '.github/workflows/m01-ci.yml',
  ];
  const m03GitCandidates =
    process.platform === 'win32'
      ? ['C:\\Program Files\\Git\\cmd\\git.exe', 'C:\\Program Files\\Git\\bin\\git.exe']
      : [
          '/usr/bin/git',
          '/bin/git',
          '/usr/local/bin/git',
          '/opt/homebrew/bin/git',
          '/opt/local/bin/git',
        ];
  const m03GitExecutable = m03GitCandidates.find((candidate) => fs.existsSync(candidate));
  if (!m03GitExecutable) {
    throw new Error(
      'NERVA-WO-004 Context Lock validation requires Git in a trusted system directory',
    );
  }

  function m03Git(args) {
    return execFileSync(m03GitExecutable, args, { encoding: 'utf8' }).trim();
  }

  if (
    lock.kind !== 'nerva.context-lock' ||
    lock.workOrder !== 'NERVA-WO-004' ||
    lock.module !== 'M03' ||
    lock.status !== 'LOCKED' ||
    lock.executionBase !== base ||
    lock.executionBranch !== expectedBranch ||
    lock.issueNumber !== 10 ||
    lock.repository !== 'KayzenRoot/nerva-project' ||
    lock.gef !== '@gef-bootstrap/cli@1.1.2'
  ) {
    throw new Error('NERVA-WO-004 Context Lock identity/base mismatch');
  }

  const fingerprints = Object.entries(lock.criticalInputs ?? {});
  if (
    fingerprints.length !== expectedCriticalInputs.length ||
    expectedCriticalInputs.some((path) => !Object.hasOwn(lock.criticalInputs, path))
  ) {
    throw new Error('NERVA-WO-004 Context Lock critical-input set mismatch');
  }

  for (const [file, expectedBlob] of fingerprints) {
    const actualBlob = m03Git(['rev-parse', `${base}:${file}`]);
    if (actualBlob !== expectedBlob) {
      throw new Error(`NERVA-WO-004 base fingerprint mismatch for ${file}`);
    }
  }

  const event = process.env.GITHUB_EVENT_NAME ?? 'local';
  const branch = process.env.GITHUB_HEAD_REF || m03Git(['branch', '--show-current']);
  const head = m03Git(['rev-parse', 'HEAD']);
  const main = m03Git(['rev-parse', 'origin/main']);
  const mainPush =
    event === 'push' &&
    process.env.GITHUB_REF === 'refs/heads/main' &&
    branch === 'main' &&
    main === head;

  if (!mainPush) {
    if (branch !== expectedBranch) {
      throw new Error(`NERVA-WO-004 branch mismatch: ${branch}`);
    }
    if (main !== base) {
      throw new Error(`NERVA-WO-004 Context Lock stale: origin/main is ${main}`);
    }
    m03Git(['merge-base', '--is-ancestor', base, 'HEAD']);

    const checkpoint = JSON.parse(fs.readFileSync('.engineering/CHECKPOINT.json', 'utf8'));
    if (
      checkpoint.m02Status !== 'APPROVED' ||
      checkpoint.activeNextModule !== 'M03' ||
      checkpoint.nextModuleWorkOrder !== 'NOT_ADMITTED' ||
      checkpoint.lastApprovedWorkOrder !== 'NERVA-WO-003' ||
      checkpoint.knownCritical !== 0 ||
      checkpoint.knownHigh !== 0
    ) {
      throw new Error('Canonical Checkpoint no longer admits the NERVA-WO-004 base');
    }

    for (const [file] of fingerprints) {
      if (!file.startsWith('.engineering/') && file !== 'docs/M02-OBSERVATION-RISK.md') continue;
      try {
        m03Git(['diff', '--quiet', base, '--', file]);
      } catch {
        throw new Error(`NERVA-WO-004 locked governance input changed in the branch: ${file}`);
      }
    }
  } else {
    m03Git(['merge-base', '--is-ancestor', base, 'HEAD']);
  }

  const workOrder = fs.readFileSync('.engineering/work-orders/NERVA-WO-004.md', 'utf8');
  for (const section of [
    'OBJECTIVE',
    'CONTEXT',
    'SCOPE',
    'OUT OF SCOPE',
    'FILES/SOURCES TO READ',
    'REQUIREMENTS',
    'ARCHITECTURE RULES',
    'CONSTRAINTS',
    'ACCEPTANCE CRITERIA',
    'TESTS/PROOF OBLIGATIONS',
    'DELIVERABLES',
    'REVIEW FORMAT',
    'STOP CONDITION',
  ]) {
    if (!workOrder.includes(`## ${section}`)) {
      throw new Error(`NERVA-WO-004 Work Order section missing: ${section}`);
    }
  }
  for (const required of [
    '`HIGH_ASSURANCE`',
    '`MAINNET`',
    '`REDUCE_POSITION`',
    '`CLOSE_POSITION`',
    '`NO_ACTION`',
    '`LIQUIDATION_DISTANCE`',
    '`MAINTENANCE_MARGIN`',
    '`FUNDING_DIRECTION`',
    '`UNAVAILABLE_UNPROVEN`',
    '`UNKNOWN`',
    'provider-side enrollment and permission/scope provenance',
    'kill switch',
    'idempotency',
    'replay protection',
    'M04',
    'NERVA_M03_POLICY_SIM_EXEC_READY_FOR_AUDIT',
  ]) {
    if (!workOrder.includes(required)) {
      throw new Error(`NERVA-WO-004 Work Order safety gate missing: ${required}`);
    }
  }

  const evidence = fs.readFileSync('.engineering/evidence/NERVA-WO-004-EVIDENCE.md', 'utf8');
  if (
    !evidence.includes('SCAFFOLD — M03 IMPLEMENTATION NOT STARTED') ||
    !evidence.includes('Implementation head: `PENDING') ||
    !evidence.includes('NOT STARTED')
  ) {
    throw new Error('NERVA-WO-004 Evidence Bundle must remain an implementation-free scaffold');
  }

  console.log(
    JSON.stringify({
      ok: true,
      executionBase: base,
      branch: expectedBranch,
      issue: 10,
      criticalFingerprints: fingerprints.length,
      checkpoint: 'M02_APPROVED_M03_NEXT_WO_NOT_ADMITTED',
      state: 'NERVA_WO_004_ADMISSION_CONTEXT_VALIDATED',
    }),
  );
  process.exit(0);
}

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
