import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const m04LockPath = '.engineering/context-locks/NERVA-WO-005.json';
if (fs.existsSync(m04LockPath)) {
  const lock = JSON.parse(fs.readFileSync(m04LockPath, 'utf8'));
  const base = 'd13629e0dc2d66c4f8b2e512b82ce0d11aec1a93';
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
    checkpoint.activeNextModule !== 'M04' ||
    checkpoint.nextModuleWorkOrder !== 'NOT_ADMITTED' ||
    checkpoint.lastApprovedWorkOrder !== 'NERVA-WO-004' ||
    checkpoint.runtimeProductCode !== 'M03_POLICY_SIMULATION_CLOSED_EFFECT_BOUNDARY' ||
    checkpoint.knownCritical !== 0 ||
    checkpoint.knownHigh !== 0
  ) {
    throw new Error('Checkpoint is not the approved M03 / next M04 admission state');
  }

  const event = process.env.GITHUB_EVENT_NAME ?? 'local';
  const head = git(['rev-parse', 'HEAD']);
  const main = git(['rev-parse', 'origin/main']);
  const branch = process.env.GITHUB_HEAD_REF || git(['branch', '--show-current']);
  if (main !== base) throw new Error(`NERVA-WO-005 base is stale: origin/main=${main}`);
  if (branch !== expectedBranch) throw new Error(`NERVA-WO-005 branch mismatch: ${branch}`);
  if (event === 'pull_request' && process.env.GITHUB_BASE_REF !== 'main') {
    throw new Error('NERVA-WO-005 admission PR must target main');
  }
  if (event === 'push' && process.env.GITHUB_REF === 'refs/heads/main')
    throw new Error('NERVA-WO-005 implementation validation cannot run on a main push');
  git(['merge-base', '--is-ancestor', base, 'HEAD']);

  const allowedPaths = new Set([
    '.engineering/work-orders/NERVA-WO-005.md',
    '.engineering/context-locks/NERVA-WO-005.json',
    '.engineering/execution-briefs/NERVA-WO-005-CODEX.md',
    '.engineering/evidence/NERVA-WO-005-EVIDENCE.md',
    '.github/scripts/validate-nerva-context-lock.mjs',
    '.github/scripts/validate-source-pack.mjs',
    '.github/scripts/check-no-forbidden-deps.mjs',
    '.github/scripts/validate-workspaces.mjs',
    '.github/scripts/verify-m03-safety.mjs',
    '.github/scripts/verify-db-schema.mjs',
    '.github/scripts/migration-from-m02.mjs',
    '.github/scripts/m04-permissions-benchmark.ts',
    '.github/workflows/m01-ci.yml',
    'apps/web/package.json',
    'apps/web/src/app/api/executions/route.ts',
    'apps/web/src/app/api/executions/[attemptId]/recovery/route.ts',
    'apps/web/src/app/api/permissions/route.ts',
    'apps/web/src/app/flight-recorder/page.tsx',
    'apps/web/src/app/m03-readonly-view.tsx',
    'apps/web/src/app/api/permissions/bind/route.ts',
    'apps/web/src/app/api/permissions/agents/route.ts',
    'apps/web/src/app/api/permissions/grants/route.ts',
    'apps/web/src/app/api/permissions/delegation/route.ts',
    'apps/web/src/app/api/permissions/authorize/route.ts',
    'apps/web/src/app/api/permissions/sessions/route.ts',
    'apps/web/src/app/api/permissions/sessions/route.test.ts',
    'apps/web/src/app/api/permissions/sessions/revoke/route.ts',
    'apps/web/src/app/api/permissions/revoke/route.ts',
    'apps/web/src/app/api/permissions/unbind/route.ts',
    'apps/web/src/app/api/permissions/evidence/verify/route.ts',
    'apps/web/src/app/permissions/page.tsx',
    'apps/web/src/app/permissions/permissions-read-view.tsx',
    'apps/web/src/app/page.tsx',
    'apps/web/src/app/i18n.ts',
    'apps/web/src/server/m03-api.ts',
    'apps/web/src/server/m03-api.test.ts',
    'apps/web/src/server/m04-trust.ts',
    'apps/web/src/server/monad-testnet-rpc.ts',
    'docs/M04-AGENT-WALLET-PERMISSIONS.md',
    'packages/contracts/src/index.ts',
    'packages/contracts/src/m04.test.ts',
    'packages/db/package.json',
    'packages/db/src/index.ts',
    'packages/db/src/m04.ts',
    'packages/db/src/schema.ts',
    'packages/db/migrations/0003_curved_smasher.sql',
    'packages/db/migrations/0004_brave_husk.sql',
    'packages/db/migrations/0005_cloudy_dagger.sql',
    'packages/db/migrations/0006_spooky_starfox.sql',
    'packages/db/migrations/0007_lush_hairball.sql',
    'packages/db/migrations/0008_purple_anita_blake.sql',
    'packages/db/migrations/0009_natural_oracle.sql',
    'packages/db/migrations/meta/0003_snapshot.json',
    'packages/db/migrations/meta/0004_snapshot.json',
    'packages/db/migrations/meta/0005_snapshot.json',
    'packages/db/migrations/meta/0006_snapshot.json',
    'packages/db/migrations/meta/0007_snapshot.json',
    'packages/db/migrations/meta/0008_snapshot.json',
    'packages/db/migrations/meta/0009_snapshot.json',
    'packages/db/migrations/meta/_journal.json',
    'packages/permissions/package.json',
    'packages/permissions/src/index.ts',
    'packages/permissions/src/index.test.ts',
    'package-lock.json',
    'tsconfig.json',
    'package.json',
  ]);
  const committedChanges = git(['diff', '--name-only', `${base}..HEAD`])
    .split(/\r?\n/)
    .map((path) => path.trim())
    .filter(Boolean);
  const statusText = execFileSync(
    gitExecutable,
    ['status', '--porcelain', '--untracked-files=all'],
    { encoding: 'utf8' },
  ).trimEnd();
  const worktreeChanges = statusText
    .split(/\r?\n/)
    .filter(Boolean)
    .map((entry) => entry.slice(3).trim());
  const unexpected = [...new Set([...committedChanges, ...worktreeChanges])].filter(
    (path) => !allowedPaths.has(path),
  );
  if (unexpected.length > 0) {
    throw new Error(
      `NERVA-WO-005 implementation changed files outside scope: ${JSON.stringify(unexpected)}`,
    );
  }
  if (committedChanges.length + worktreeChanges.length === 0) {
    throw new Error('NERVA-WO-005 admission contains no changes');
  }

  const workOrder = fs.readFileSync('.engineering/work-orders/NERVA-WO-005.md', 'utf8');
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
      throw new Error(`NERVA-WO-005 Work Order missing required section ${heading}`);
    }
  }
  const requiredSafetyText = [
    'HIGH_ASSURANCE',
    'MAINNET effectful execution',
    'HARD_BLOCKED',
    'ARBITRARY_CALL',
    'EIP-712',
    'EIP-7702',
    'LIQUIDATION_DISTANCE',
    'MAINTENANCE_MARGIN',
    'FUNDING_DIRECTION',
    'NERVA_M04_AGENT_WALLET_PERMISSIONS_EVIDENCE_READY_FOR_AUDIT',
  ];
  for (const text of requiredSafetyText) {
    if (!workOrder.includes(text))
      throw new Error(`NERVA-WO-005 Work Order missing safety term ${text}`);
  }

  console.log(
    JSON.stringify({
      ok: true,
      executionBase: base,
      head,
      branch,
      issue: lock.issueNumber,
      criticalFingerprints: fingerprints.length,
      implementationFiles: committedChanges.length + worktreeChanges.length,
      state: 'NERVA_M04_IMPLEMENTATION_CONTEXT_VALIDATED',
    }),
  );
  process.exit(0);
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
