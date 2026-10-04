import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const lockPath = '.engineering/context-locks/NERVA-WO-006.json';
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const checkpoint = JSON.parse(fs.readFileSync('.engineering/CHECKPOINT.json', 'utf8'));
const auditedHead = 'bd0190a744befa413fac15f4f276d28b846a348e';

const gitExecutable =
  process.platform === 'win32' ? String.raw`C:\Program Files\Git\cmd\git.exe` : '/usr/bin/git';

if (!fs.existsSync(gitExecutable)) {
  throw new Error('M05 validation requires Git at the trusted system path');
}

const git = (...args) => {
  const result = spawnSync(gitExecutable, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
};

const expected = {
  workOrder: 'NERVA-WO-006',
  module: 'M05',
  status: 'LOCKED',
  executionBase: '5243c2808f258996c11e5e2fa9dffa5af96041cd',
  executionBranch: 'feat/nerva-wo-006-m05-product-demo',
  issueNumber: 15,
  repository: 'KayzenRoot/nerva-project',
  gef: '@gef-bootstrap/cli@1.1.2',
};

for (const [key, value] of Object.entries(expected)) {
  if (lock[key] !== value) {
    throw new Error(`M05 identity mismatch: ${key}`);
  }
}

const fingerprints = Object.entries(lock.criticalInputs ?? {});
if (fingerprints.length !== 89) {
  throw new Error('M05 Context Lock must contain 89 fingerprints');
}

for (const [path, sha] of fingerprints) {
  if (git('rev-parse', '--verify', `${lock.executionBase}:${path}`) !== sha) {
    throw new Error(`M05 Context Lock fingerprint mismatch: ${path}`);
  }
}

const executionCheckpoint =
  checkpoint.m04Status === 'APPROVED' &&
  checkpoint.activeNextModule === 'M05' &&
  checkpoint.nextModuleWorkOrder === 'NOT_ADMITTED' &&
  checkpoint.lastApprovedWorkOrder === 'NERVA-WO-005' &&
  checkpoint.knownCritical === 0 &&
  checkpoint.knownHigh === 0;

const promotedCheckpoint =
  checkpoint.m04Status === 'APPROVED' &&
  checkpoint.m05Status === 'APPROVED' &&
  checkpoint.activeNextModule === 'M06' &&
  checkpoint.nextModuleWorkOrder === 'NOT_ADMITTED' &&
  checkpoint.lastApprovedWorkOrder === 'NERVA-WO-006' &&
  checkpoint.runtimeProductCode === 'M05_EXPERIENCE_DEMO_M04_SAFETY_BOUNDARY' &&
  checkpoint.knownCritical === 0 &&
  checkpoint.knownHigh === 0;

if (!executionCheckpoint && !promotedCheckpoint) {
  throw new Error('Canonical checkpoint is neither M05 execution state nor approved M05 promotion state');
}

const head = git('rev-parse', 'HEAD');
const main = git('rev-parse', 'origin/main');
const branchName =
  process.env.GITHUB_HEAD_REF ||
  (process.env.GITHUB_REF?.startsWith('refs/heads/')
    ? process.env.GITHUB_REF.slice('refs/heads/'.length)
    : git('branch', '--show-current'));

if (executionCheckpoint) {
  if (main !== lock.executionBase) {
    throw new Error('M05 admission base is stale');
  }
  if (branchName !== lock.executionBranch) {
    throw new Error(`Unexpected M05 branch: ${branchName}`);
  }
}

const allowed = new Set([
  '.engineering/work-orders/NERVA-WO-006.md',
  '.engineering/context-locks/NERVA-WO-006.json',
  '.engineering/execution-briefs/NERVA-WO-006-CODEX.md',
  '.engineering/evidence/NERVA-WO-006-EVIDENCE.md',
  '.engineering/checkpoint-deltas/NERVA-WO-006-PROPOSED.md',
  '.engineering/CHECKPOINT.md',
  '.engineering/CHECKPOINT.json',
  '.engineering/BACKLOG.md',
  '.github/scripts/validate-source-pack.mjs',
  '.github/scripts/validate-nerva-context-lock.mjs',
  '.github/scripts/validate-m05-admission.mjs',
  '.github/scripts/verify-m05-demo-boundary.mjs',
  '.github/workflows/m01-ci.yml',
  '.gitignore',
  'package.json',
  'package-lock.json',
  'apps/web/next.config.ts',
  'apps/web/AGENTS.md',
  'apps/web/CLAUDE.md',
  'playwright.config.ts',
  'apps/web/src/app/page.tsx',
  'apps/web/src/app/layout.tsx',
  'apps/web/src/app/experience-header.tsx',
  'apps/web/src/app/m05.css',
  'apps/web/src/app/dashboard/page.tsx',
  'apps/web/src/app/dashboard-copy.ts',
  'apps/web/src/app/home-copy.ts',
  'apps/web/src/app/product-copy.json',
  'apps/web/src/app/localization.test.ts',
  'apps/web/src/app/flight-recorder-lineage.ts',
  'apps/web/src/app/m03-readonly-view.test.ts',
  'apps/web/src/app/m03-readonly-view.tsx',
  'apps/web/src/app/permissions/permissions-read-view.tsx',
  'apps/web/src/app/policies/page.tsx',
  'apps/web/src/app/policies/policy-workbench.tsx',
  'apps/web/src/app/policies/policy-workbench.test.ts',
  'apps/web/src/app/policies/policy-templates.ts',
  'apps/web/src/app/demo/page.tsx',
  'apps/web/src/app/demo/demo-view.tsx',
  'apps/web/src/app/demo/demo-copy.ts',
  'apps/web/src/app/demo/demo-model.ts',
  'apps/web/src/app/demo/demo-model.test.ts',
  'apps/web/src/app/demo/analytics-privacy.test.ts',
  'apps/web/e2e/m05-demo.pw.ts',
  'docs/NERVA-M05-DEMO-RUNBOOK.md',
  '.engineering/evidence/NERVA-WO-006-artifacts/guided-demo-desktop.png',
  '.engineering/evidence/NERVA-WO-006-artifacts/guided-demo-mobile.png',
]);

const changed = git('diff', '--name-only', `${lock.executionBase}..HEAD`)
  .split(/\r?\n/)
  .filter(Boolean);
const foreign = changed.filter((path) => !allowed.has(path));
if (foreign.length > 0) {
  throw new Error(`M05 changed files outside admitted/promotion scope: ${foreign.join(', ')}`);
}

const wo = fs.readFileSync('.engineering/work-orders/NERVA-WO-006.md', 'utf8');
const brief = fs.readFileSync('.engineering/execution-briefs/NERVA-WO-006-CODEX.md', 'utf8');
const evidence = fs.readFileSync('.engineering/evidence/NERVA-WO-006-EVIDENCE.md', 'utf8');

for (const section of [
  'OBJECTIVE','CONTEXT','SCOPE','OUT OF SCOPE','FILES / SOURCES TO READ','REQUIREMENTS',
  'ARCHITECTURE RULES','CONSTRAINTS','ACCEPTANCE CRITERIA','TESTS / PROOF OBLIGATIONS',
  'DELIVERABLES','REVIEW FORMAT','STOP CONDITION',
]) {
  if (!wo.includes(`## ${section}`)) throw new Error(`WO-006 missing section: ${section}`);
}
if (!wo.includes('NERVA_M05_PRODUCT_DEMO_READY_FOR_AUDIT')) throw new Error('WO-006 stop marker missing');
if (!brief.includes('NERVA_M05_PRODUCT_DEMO_READY_FOR_AUDIT')) throw new Error('M05 brief stop marker missing');

if (promotedCheckpoint) {
  if (!evidence.includes(auditedHead) || !evidence.includes('Verdict: `APPROVED`')) {
    throw new Error('M05 approved promotion lacks independent audit receipt');
  }

  const event = process.env.GITHUB_EVENT_NAME ?? 'local';
  const mainPush =
    event === 'push' &&
    process.env.GITHUB_REF === 'refs/heads/main' &&
    main === head &&
    main !== lock.executionBase;

  if (main === lock.executionBase) {
    if (branchName !== lock.executionBranch) {
      throw new Error(`Unexpected M05 promotion branch: ${branchName}`);
    }
    git('merge-base', '--is-ancestor', auditedHead, 'HEAD');
    const promotionAllowed = new Set([
      '.engineering/CHECKPOINT.md',
      '.engineering/CHECKPOINT.json',
      '.engineering/BACKLOG.md',
      '.engineering/evidence/NERVA-WO-006-EVIDENCE.md',
      '.engineering/checkpoint-deltas/NERVA-WO-006-PROPOSED.md',
      '.github/scripts/validate-m05-admission.mjs',
      '.github/scripts/validate-source-pack.mjs',
      '.github/scripts/validate-nerva-context-lock.mjs',
    ]);
    const promotionChanged = git('diff', '--name-only', `${auditedHead}..HEAD`)
      .split(/\r?\n/)
      .filter(Boolean);
    const forbiddenPromotion = promotionChanged.filter((path) => !promotionAllowed.has(path));
    if (promotionChanged.length === 0 || forbiddenPromotion.length > 0) {
      throw new Error(`Invalid M05 promotion delta: ${forbiddenPromotion.join(', ')}`);
    }
    console.log(JSON.stringify({
      ok:true, base:lock.executionBase, auditedHead, head, branch:branchName, issue:lock.issueNumber,
      fingerprints:fingerprints.length, promotionFiles:promotionChanged.length,
      state:'NERVA_M05_APPROVED_CHECKPOINT_PROMOTED',
    }));
    process.exit(0);
  }

  git('merge-base', '--is-ancestor', lock.executionBase, main);
  console.log(JSON.stringify({
    ok:true, base:lock.executionBase, auditedHead, currentMain:main, head, branch:branchName,
    issue:lock.issueNumber, fingerprints:fingerprints.length,
    state: mainPush ? 'NERVA_M05_POST_MERGE_CONTEXT_LOCK_HISTORICAL' : 'NERVA_M05_CONTEXT_LOCK_HISTORICAL',
  }));
  process.exit(0);
}

const implementationChanged = changed.some((path) => path.startsWith('apps/web/src/app/'));
if (implementationChanged && evidence.includes('EXECUTION_NOT_STARTED')) {
  throw new Error('M05 implementation changed but Evidence Bundle is still marked not started');
}

let state = 'NERVA_WO_006_ADMITTED_READY_FOR_EXECUTION';
if (implementationChanged) state = 'NERVA_WO_006_EXECUTION_IN_PROGRESS';
if (evidence.includes('NERVA_M05_PRODUCT_DEMO_READY_FOR_AUDIT')) state = 'NERVA_M05_PRODUCT_DEMO_READY_FOR_AUDIT';

console.log(JSON.stringify({
  ok:true, base:lock.executionBase, head, branch:branchName, issue:lock.issueNumber,
  fingerprints:fingerprints.length, changedFiles:changed.length, state,
}));
