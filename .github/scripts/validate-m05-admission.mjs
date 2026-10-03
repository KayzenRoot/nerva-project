import prettier from 'prettier';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const lockPath = '.engineering/context-locks/NERVA-WO-006.json';
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const checkpoint = JSON.parse(fs.readFileSync('.engineering/CHECKPOINT.json', 'utf8'));

const gitExecutable =
  process.platform === 'win32'
    ? 'C:\\Program Files\\Git\\cmd\\git.exe'
    : '/usr/bin/git';

if (!fs.existsSync(gitExecutable)) {
  throw new Error('M05 admission validation requires Git at the trusted system path');
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
    throw new Error(`M05 admission identity mismatch: ${key}`);
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

if (
  checkpoint.m04Status !== 'APPROVED' ||
  checkpoint.activeNextModule !== 'M05' ||
  checkpoint.nextModuleWorkOrder !== 'NOT_ADMITTED' ||
  checkpoint.lastApprovedWorkOrder !== 'NERVA-WO-005' ||
  checkpoint.knownCritical !== 0 ||
  checkpoint.knownHigh !== 0
) {
  throw new Error('Canonical checkpoint does not admit M05 planning/execution package');
}

if (git('rev-parse', 'origin/main') !== lock.executionBase) {
  throw new Error('M05 admission base is stale');
}

const branchName =
  process.env.GITHUB_HEAD_REF ||
  (process.env.GITHUB_REF?.startsWith('refs/heads/')
    ? process.env.GITHUB_REF.slice('refs/heads/'.length)
    : git('branch', '--show-current'));

if (branchName !== lock.executionBranch) {
  throw new Error(`Unexpected M05 branch: ${branchName}`);
}

const allowed = new Set([
  '.engineering/work-orders/NERVA-WO-006.md',
  '.engineering/context-locks/NERVA-WO-006.json',
  '.engineering/execution-briefs/NERVA-WO-006-CODEX.md',
  '.engineering/evidence/NERVA-WO-006-EVIDENCE.md',
  '.github/scripts/validate-m05-admission.mjs',
  'package.json',
]);

const changed = git('diff', '--name-only', `${lock.executionBase}..HEAD`)
  .split(/\r?\n/)
  .filter(Boolean);

const foreign = changed.filter((path) => !allowed.has(path));
if (foreign.length > 0) {
  throw new Error(`M05 admission contains product/out-of-scope files: ${foreign.join(', ')}`);
}

const wo = fs.readFileSync('.engineering/work-orders/NERVA-WO-006.md', 'utf8');
const brief = fs.readFileSync('.engineering/execution-briefs/NERVA-WO-006-CODEX.md', 'utf8');
const evidence = fs.readFileSync('.engineering/evidence/NERVA-WO-006-EVIDENCE.md', 'utf8');

const requiredSections = [
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
];

for (const section of requiredSections) {
  if (!wo.includes(`## ${section}`)) {
    throw new Error(`WO-006 missing section: ${section}`);
  }
}

if (!wo.includes('NERVA_M05_PRODUCT_DEMO_READY_FOR_AUDIT')) {
  throw new Error('WO-006 stop marker missing');
}

if (!brief.includes('NERVA_M05_PRODUCT_DEMO_READY_FOR_AUDIT')) {
  throw new Error('M05 brief stop marker missing');
}

if (!evidence.includes('EXECUTION_NOT_STARTED')) {
  throw new Error('M05 evidence must remain scaffold-only at admission');
}

const selfSource = fs.readFileSync(new URL(import.meta.url), 'utf8');
const selfFormatted = await prettier.format(selfSource, {
  filepath: new URL(import.meta.url).pathname,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
});
console.log('M05_PRETTIER_PROBE_BEGIN');
console.log(Buffer.from(selfFormatted, 'utf8').toString('base64'));
console.log('M05_PRETTIER_PROBE_END');

console.log(
  JSON.stringify({
    ok: true,
    base: lock.executionBase,
    head: git('rev-parse', 'HEAD'),
    branch: branchName,
    issue: lock.issueNumber,
    fingerprints: fingerprints.length,
    changedFiles: changed.length,
    state: 'NERVA_WO_006_ADMITTED_READY_FOR_EXECUTION',
  }),
);
