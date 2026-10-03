import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const m05LockPath = '.engineering/context-locks/NERVA-WO-006.json';
if (fs.existsSync(m05LockPath)) {
  const lock = JSON.parse(fs.readFileSync(m05LockPath, 'utf8'));
  const base = '5243c2808f258996c11e5e2fa9dffa5af96041cd';
  const expectedBranch = 'feat/nerva-wo-006-m05-product-demo';
  const gitCandidates =
    process.platform === 'win32'
      ? ['C:\\Program Files\\Git\\cmd\\git.exe', 'C:\\Program Files\\Git\\bin\\git.exe']
      : ['/usr/bin/git', '/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git', '/opt/local/bin/git'];
  const gitExecutable = gitCandidates.find((candidate) => fs.existsSync(candidate));
  if (!gitExecutable) {
    throw new Error('NERVA-WO-006 validation requires Git in a trusted system directory');
  }
  const git = (args) => execFileSync(gitExecutable, args, { encoding: 'utf8' }).trim();
  const blobAt = (ref, file) => git(['rev-parse', '--verify', `${ref}:${file}`]);

  if (
    lock.kind !== 'nerva.context-lock' ||
    lock.workOrder !== 'NERVA-WO-006' ||
    lock.module !== 'M05' ||
    lock.status !== 'LOCKED' ||
    lock.executionBase !== base ||
    lock.executionBranch !== expectedBranch ||
    lock.issueNumber !== 15 ||
    lock.repository !== 'KayzenRoot/nerva-project' ||
    lock.gef !== '@gef-bootstrap/cli@1.1.2'
  ) {
    throw new Error('NERVA-WO-006 Context Lock identity/base mismatch');
  }

  const fingerprints = Object.entries(lock.criticalInputs ?? {});
  if (fingerprints.length !== 89) {
    throw new Error('NERVA-WO-006 fingerprint count mismatch');
  }
  for (const [file, expectedBlob] of fingerprints) {
    if (blobAt(base, file) !== expectedBlob) {
      throw new Error(`NERVA-WO-006 base fingerprint mismatch for ${file}`);
    }
  }

  const checkpoint = JSON.parse(fs.readFileSync('.engineering/CHECKPOINT.json', 'utf8'));
  if (
    checkpoint.m04Status !== 'APPROVED' ||
    checkpoint.activeNextModule !== 'M05' ||
    checkpoint.nextModuleWorkOrder !== 'NOT_ADMITTED' ||
    checkpoint.lastApprovedWorkOrder !== 'NERVA-WO-005' ||
    checkpoint.runtimeProductCode !== 'M04_AGENT_WALLET_BOUNDED_PERMISSIONS_VERIFIABLE_EVIDENCE' ||
    checkpoint.knownCritical !== 0 ||
    checkpoint.knownHigh !== 0
  ) {
    throw new Error('Checkpoint is not the approved M04 / next M05 admission state');
  }

  const event = process.env.GITHUB_EVENT_NAME ?? 'local';
  const head = git(['rev-parse', 'HEAD']);
  const main = git(['rev-parse', 'origin/main']);
  const branch =
    process.env.GITHUB_HEAD_REF ||
    (process.env.GITHUB_REF?.startsWith('refs/heads/')
      ? process.env.GITHUB_REF.slice('refs/heads/'.length)
      : git(['branch', '--show-current']));

  if (main !== base) {
    throw new Error(`NERVA-WO-006 base is stale: origin/main=${main}`);
  }
  if (branch !== expectedBranch) {
    throw new Error(`NERVA-WO-006 branch mismatch: ${branch}`);
  }
  if (event === 'pull_request' && process.env.GITHUB_BASE_REF !== 'main') {
    throw new Error('NERVA-WO-006 admission PR must target main');
  }
  if (event === 'push' && process.env.GITHUB_REF === 'refs/heads/main') {
    throw new Error('NERVA-WO-006 admission validation cannot run on a main push');
  }
  git(['merge-base', '--is-ancestor', base, 'HEAD']);

  const allowedPaths = new Set([
    '.engineering/work-orders/NERVA-WO-006.md',
    '.engineering/context-locks/NERVA-WO-006.json',
    '.engineering/execution-briefs/NERVA-WO-006-CODEX.md',
    '.engineering/evidence/NERVA-WO-006-EVIDENCE.md',
    '.github/scripts/validate-nerva-context-lock.mjs',
    '.github/scripts/validate-source-pack.mjs',
    'package.json',
  ]);

  const committedChanges = git(['diff', '--name-only', `${base}..HEAD`])
    .split(/\r?\n/)
    .map((path) => path.trim())
    .filter(Boolean);
  const unexpected = committedChanges.filter((path) => !allowedPaths.has(path));
  if (unexpected.length > 0) {
    throw new Error(
      `NERVA-WO-006 admission changed files outside governance scope: ${unexpected.join(', ')}`,
    );
  }

  const workOrder = fs.readFileSync('.engineering/work-orders/NERVA-WO-006.md', 'utf8');
  for (const heading of [
    'OBJECTIVE',
    'CONTEXT',
    'SCOPE',
    'OUT OF SCOPE',
    'FILES / SOURCES TO READ',
    'REQUIREMENTS',
    'ARCHITECTURE RULES',
    'CONSTRAINTS',
    'ACCEPTANCE CRITERIA',
    'TESTS / PROOF OBLIGATIONS',
    'DELIVERABLES',
    'REVIEW FORMAT',
    'STOP CONDITION',
  ]) {
    if (!workOrder.includes(`## ${heading}`)) {
      throw new Error(`NERVA-WO-006 Work Order missing required section ${heading}`);
    }
  }

  for (const marker of [
    'HIGH_ASSURANCE',
    'DEMO_ONLY',
    'SIMULATED OUTCOME',
    'MAINNET',
    'HARD_BLOCKED',
    'live Perpl',
    'Flight Recorder',
    'NERVA_M05_PRODUCT_DEMO_READY_FOR_AUDIT',
  ]) {
    if (!workOrder.includes(marker)) {
      throw new Error(`NERVA-WO-006 Work Order missing safety/demo marker ${marker}`);
    }
  }

  const evidence = fs.readFileSync('.engineering/evidence/NERVA-WO-006-EVIDENCE.md', 'utf8');
  if (!evidence.includes('EXECUTION_NOT_STARTED')) {
    throw new Error('NERVA-WO-006 Evidence Bundle must remain scaffold-only during admission');
  }

  console.log(
    JSON.stringify({
      ok: true,
      executionBase: base,
      head,
      branch,
      issue: lock.issueNumber,
      criticalFingerprints: fingerprints.length,
      admissionFiles: committedChanges.length,
      state: 'NERVA_WO_006_ADMITTED_READY_FOR_EXECUTION',
    }),
  );
  process.exit(0);
}

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const m04LockPath = '.engineering/context-locks/NERVA-WO-005.json';
if (fs.existsSync(m04LockPath)) {
  const lock = JSON.parse(fs.readFileSync(m04LockPath, 'utf8'));
  const base = 'd13629e0dc2d66c4f8b2e512b82ce0d11aec1a93';
  const auditedHead = '070badfa79323328b11840c4eb6c0326d31e2637';
  const expectedBranch = 'feat/nerva-wo-005-m04-agent-wallet-permissions-evidence';
  const gitCandidates =
    process.platform === 'win32'
      ? ['C:\\Program Files\\Git\\cmd\\git.exe', 'C:\\Program Files\\Git\\bin\\git.exe']
      : [
          '/usr/bin/git',
          '/bin/git',
          '/usr/local/bin/git',
          '/opt/homebrew/bin/git',
          '/opt/local/bin/git',
        ];
  const gitExecutable = gitCandidates.find((candidate) => fs.existsSync(candidate));
  if (!gitExecutable) {
    throw new Error('NERVA-WO-005 validation requires Git in a trusted system directory');
  }

  const git = (args) => execFileSync(gitExecutable, args, { encoding: 'utf8' }).trim();
  const blobAt = (ref, file) => git(['rev-parse', '--verify', `${ref}:${file}`]);

  if (
    lock.kind !== 'nerva.context-lock' ||
    lock.workOrder !== 'NERVA-WO-005' ||
    lock.module !== 'M04' ||
    lock.status !== 'LOCKED' ||
    lock.executionBase !== base ||
    lock.executionBranch !== expectedBranch ||
    lock.issueNumber !== 13 ||
    lock.repository !== 'KayzenRoot/nerva-project' ||
    lock.gef !== '@gef-bootstrap/cli@1.1.2'
  ) {
    throw new Error('NERVA-WO-005 Context Lock identity/base mismatch');
  }

  const fingerprints = Object.entries(lock.criticalInputs ?? {});
  if (fingerprints.length !== 64) {
    throw new Error('NERVA-WO-005 fingerprint count mismatch');
  }
  for (const [file, expectedBlob] of fingerprints) {
    if (blobAt(base, file) !== expectedBlob) {
      throw new Error(`NERVA-WO-005 base fingerprint mismatch for ${file}`);
    }
  }

  const checkpoint = JSON.parse(fs.readFileSync('.engineering/CHECKPOINT.json', 'utf8'));
  if (
    checkpoint.m03Status !== 'APPROVED' ||
    checkpoint.m04Status !== 'APPROVED' ||
    checkpoint.activeNextModule !== 'M05' ||
    checkpoint.nextModuleWorkOrder !== 'NOT_ADMITTED' ||
    checkpoint.lastApprovedWorkOrder !== 'NERVA-WO-005' ||
    checkpoint.runtimeProductCode !== 'M04_AGENT_WALLET_BOUNDED_PERMISSIONS_VERIFIABLE_EVIDENCE' ||
    checkpoint.knownCritical !== 0 ||
    checkpoint.knownHigh !== 0
  ) {
    throw new Error('Checkpoint is not the approved M04 promotion state');
  }

  const event = process.env.GITHUB_EVENT_NAME ?? 'local';
  const head = git(['rev-parse', 'HEAD']);
  const main = git(['rev-parse', 'origin/main']);
  const branch = process.env.GITHUB_HEAD_REF || git(['branch', '--show-current']);

  const allowedPromotionPaths = new Set([
    '.engineering/BACKLOG.md',
    '.engineering/CHECKPOINT.json',
    '.engineering/CHECKPOINT.md',
    '.engineering/SOURCE-HIERARCHY.md',
    '.engineering/checkpoint-deltas/NERVA-WO-005-PROPOSED.md',
    '.engineering/evidence/NERVA-WO-005-EVIDENCE.md',
    '.github/scripts/validate-nerva-context-lock.mjs',
    '.github/scripts/validate-source-pack.mjs',
    'README.md',
  ]);

  const assertPromotionOnly = (from, to) => {
    const changed = git(['diff', '--name-only', `${from}..${to}`])
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    const forbidden = changed.filter((file) => !allowedPromotionPaths.has(file));
    if (forbidden.length > 0) {
      throw new Error(
        `Post-audit M04 promotion contains non-promotion paths: ${forbidden.join(', ')}`,
      );
    }
    return changed;
  };

  const mainPush =
    event === 'push' &&
    process.env.GITHUB_REF === 'refs/heads/main' &&
    main === head &&
    main !== base;

  if (mainPush) {
    if (git(['rev-parse', 'HEAD^']) !== base) {
      throw new Error('M04 squash merge parent does not match the accepted M03 baseline');
    }
    const changed = assertPromotionOnly(auditedHead, 'HEAD');
    if (changed.length === 0) {
      throw new Error('M04 post-merge tree lacks promotion delta');
    }
    console.log(
      JSON.stringify({
        ok: true,
        executionBase: base,
        auditedHead,
        mergedHead: head,
        criticalFingerprints: fingerprints.length,
        promotionFiles: changed.length,
        state: 'M04_POST_MERGE_CONTEXT_LOCK_HISTORICAL',
      }),
    );
    process.exit(0);
  }

  if (main === base && branch === expectedBranch) {
    git(['merge-base', '--is-ancestor', auditedHead, 'HEAD']);
    const changed = assertPromotionOnly(auditedHead, 'HEAD');
    if (changed.length === 0) {
      throw new Error('No M04 promotion delta is present');
    }
    const evidence = fs.readFileSync('.engineering/evidence/NERVA-WO-005-EVIDENCE.md', 'utf8');
    if (!evidence.includes(auditedHead) || !evidence.includes('Verdict: `APPROVED`')) {
      throw new Error('M04 audit receipt is missing from the Evidence Bundle');
    }
    console.log(
      JSON.stringify({
        ok: true,
        executionBase: base,
        auditedHead,
        head,
        branch,
        criticalFingerprints: fingerprints.length,
        promotionFiles: changed.length,
        state: 'M04_PROMOTION_ONLY_AFTER_APPROVED_AUDIT',
      }),
    );
    process.exit(0);
  }

  if (main !== base) {
    git(['merge-base', '--is-ancestor', base, main]);
    console.log(
      JSON.stringify({
        ok: true,
        executionBase: base,
        auditedHead,
        currentMain: main,
        head,
        branch,
        criticalFingerprints: fingerprints.length,
        state: 'M04_CONTEXT_LOCK_HISTORICAL',
      }),
    );
    process.exit(0);
  }

  throw new Error(
    `NERVA-WO-005 validator is not valid for event=${event} branch=${branch} main=${main}`,
  );
}

const m03LockPath = '.engineering/context-locks/NERVA-WO-004.json';
if (fs.existsSync(m03LockPath)) {
  const lock = JSON.parse(fs.readFileSync(m03LockPath, 'utf8'));
  const base = '31cce06cf68aab0a82d3801ed6177b8a3b311869';
  const auditedHead = '22fe67a49dd90b0ab5567a8b93cbcd940ba4b0b9';
  const promotionHead = '66167892504fe9d13c7f31ffa6de1d1331745247';
  const expectedPromotionTree = '126f4ff1877a6eb6f4dd115ecc759d587016c620';
  const acceptedMerge = '3935e2e1a4cce7e35b4e35afe58435ae3a32e72b';
  const expectedBranch = 'feat/nerva-wo-004-m03-policy-sim-exec';
  const correctionBranch = 'fix/nerva-wo-004-postmerge-validator';
  const gitCandidates =
    process.platform === 'win32'
      ? ['C:\\Program Files\\Git\\cmd\\git.exe', 'C:\\Program Files\\Git\\bin\\git.exe']
      : [
          '/usr/bin/git',
          '/bin/git',
          '/usr/local/bin/git',
          '/opt/homebrew/bin/git',
          '/opt/local/bin/git',
        ];
  const gitExecutable = gitCandidates.find((candidate) => fs.existsSync(candidate));
  if (!gitExecutable) {
    throw new Error('NERVA-WO-004 validation requires Git in a trusted system directory');
  }

  const git = (args) => execFileSync(gitExecutable, args, { encoding: 'utf8' }).trim();
  const blobAt = (ref, file) => git(['rev-parse', `${ref}:${file}`]);

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
  if (fingerprints.length !== 36) {
    throw new Error('NERVA-WO-004 fingerprint count mismatch');
  }
  for (const [file, expectedBlob] of fingerprints) {
    if (blobAt(base, file) !== expectedBlob) {
      throw new Error(`NERVA-WO-004 base fingerprint mismatch for ${file}`);
    }
  }

  const checkpoint = JSON.parse(fs.readFileSync('.engineering/CHECKPOINT.json', 'utf8'));
  if (
    checkpoint.m02Status !== 'APPROVED' ||
    checkpoint.m03Status !== 'APPROVED' ||
    checkpoint.activeNextModule !== 'M04' ||
    checkpoint.nextModuleWorkOrder !== 'NOT_ADMITTED' ||
    checkpoint.lastApprovedWorkOrder !== 'NERVA-WO-004' ||
    checkpoint.runtimeProductCode !== 'M03_POLICY_SIMULATION_CLOSED_EFFECT_BOUNDARY' ||
    checkpoint.knownCritical !== 0 ||
    checkpoint.knownHigh !== 0
  ) {
    throw new Error('Checkpoint is not the approved M03 state');
  }

  if (git(['rev-parse', `${acceptedMerge}^`]) !== base) {
    throw new Error('Accepted M03 squash merge parent does not match the accepted M02 baseline');
  }
  if (git(['rev-parse', `${acceptedMerge}^{tree}`]) !== expectedPromotionTree) {
    throw new Error('Accepted M03 squash merge tree does not match the validated promotion tree');
  }

  const event = process.env.GITHUB_EVENT_NAME ?? 'local';
  const head = git(['rev-parse', 'HEAD']);
  const main = git(['rev-parse', 'origin/main']);
  const branch = process.env.GITHUB_HEAD_REF || git(['branch', '--show-current']);

  const allowedCorrectionPaths = new Set([
    '.engineering/evidence/NERVA-WO-004-EVIDENCE.md',
    '.github/scripts/validate-nerva-context-lock.mjs',
  ]);

  const assertCorrectionOnly = (from, to) => {
    const changed = git(['diff', '--name-only', `${from}..${to}`])
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    const forbidden = changed.filter((file) => !allowedCorrectionPaths.has(file));
    if (forbidden.length > 0) {
      throw new Error(
        `NERVA-WO-004 post-merge correction contains forbidden paths: ${forbidden.join(', ')}`,
      );
    }
    return changed;
  };

  const correctionPr =
    event === 'pull_request' && main === acceptedMerge && branch === correctionBranch;

  if (correctionPr) {
    git(['merge-base', '--is-ancestor', acceptedMerge, 'HEAD']);
    const changed = assertCorrectionOnly(acceptedMerge, 'HEAD');
    if (changed.length === 0) {
      throw new Error('NERVA-WO-004 correction PR contains no correction delta');
    }
    console.log(
      JSON.stringify({
        ok: true,
        executionBase: base,
        auditedHead,
        promotionHead,
        promotionTree: expectedPromotionTree,
        acceptedMerge,
        correctionHead: head,
        correctionFiles: changed.length,
        criticalFingerprints: fingerprints.length,
        state: 'M03_POST_MERGE_CORRECTION_VALIDATED',
      }),
    );
    process.exit(0);
  }

  const postMergeMain =
    event === 'push' &&
    process.env.GITHUB_REF === 'refs/heads/main' &&
    main === head &&
    main !== base;

  if (postMergeMain) {
    git(['merge-base', '--is-ancestor', acceptedMerge, 'HEAD']);
    const changed = assertCorrectionOnly(acceptedMerge, 'HEAD');
    console.log(
      JSON.stringify({
        ok: true,
        executionBase: base,
        auditedHead,
        promotionHead,
        promotionTree: expectedPromotionTree,
        acceptedMerge,
        mainHead: head,
        correctionFiles: changed.length,
        criticalFingerprints: fingerprints.length,
        state: 'M03_POST_MERGE_CONTEXT_LOCK_HISTORICAL',
      }),
    );
    process.exit(0);
  }

  if (main === base && branch === expectedBranch) {
    git(['merge-base', '--is-ancestor', auditedHead, 'HEAD']);
    console.log(
      JSON.stringify({
        ok: true,
        executionBase: base,
        auditedHead,
        head,
        branch,
        criticalFingerprints: fingerprints.length,
        state: 'M03_PROMOTION_BRANCH_HISTORICAL',
      }),
    );
    process.exit(0);
  }

  git(['merge-base', '--is-ancestor', acceptedMerge, main]);
  git(['merge-base', '--is-ancestor', main, 'HEAD']);
  console.log(
    JSON.stringify({
      ok: true,
      executionBase: base,
      auditedHead,
      acceptedMerge,
      currentMain: main,
      head,
      branch,
      criticalFingerprints: fingerprints.length,
      state: 'M03_CONTEXT_LOCK_HISTORICAL',
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
