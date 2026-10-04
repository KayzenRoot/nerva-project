import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const lock = JSON.parse(fs.readFileSync('.engineering/context-locks/NERVA-WO-007.json', 'utf8'));
const checkpoint = JSON.parse(fs.readFileSync('.engineering/CHECKPOINT.json', 'utf8'));
const expectedBase = 'b778b470eff4ff997def001899530512065e5676';
const expectedBranch = 'feat/nerva-wo-007-m06-release-hardening';

const gitCandidates =
  process.platform === 'win32'
    ? ['C:\\Program Files\\Git\\cmd\\git.exe', 'C:\\Program Files\\Git\\bin\\git.exe']
    : ['/usr/bin/git', '/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git', '/opt/local/bin/git'];
const gitExecutable = gitCandidates.find((candidate) => fs.existsSync(candidate));
if (!gitExecutable) throw new Error('NERVA-WO-007 validation requires Git in a trusted system directory');
const git = (...args) => execFileSync(gitExecutable, args, { encoding: 'utf8' }).trim();

if (
  lock.kind !== 'nerva.context-lock' ||
  lock.workOrder !== 'NERVA-WO-007' ||
  lock.module !== 'M06' ||
  lock.status !== 'LOCKED' ||
  lock.executionBase !== expectedBase ||
  lock.executionBranch !== expectedBranch ||
  lock.issueNumber !== 19 ||
  lock.repository !== 'KayzenRoot/nerva-project' ||
  lock.gef !== '@gef-bootstrap/cli@1.1.2'
) {
  throw new Error('NERVA-WO-007 Context Lock identity/base mismatch');
}

const fingerprints = Object.entries(lock.criticalInputs ?? {});
if (fingerprints.length !== 98) {
  throw new Error('NERVA-WO-007 fingerprint count mismatch');
}
for (const [file, expectedBlob] of fingerprints) {
  const actual = git('rev-parse', '--verify', `${expectedBase}:${file}`);
  if (actual !== expectedBlob) throw new Error(`NERVA-WO-007 base fingerprint mismatch: ${file}`);
}

if (
  checkpoint.m05Status !== 'APPROVED' ||
  checkpoint.activeNextModule !== 'M06' ||
  checkpoint.nextModuleWorkOrder !== 'NOT_ADMITTED' ||
  checkpoint.lastApprovedWorkOrder !== 'NERVA-WO-006' ||
  checkpoint.runtimeProductCode !== 'M05_EXPERIENCE_DEMO_M04_SAFETY_BOUNDARY' ||
  checkpoint.knownCritical !== 0 ||
  checkpoint.knownHigh !== 0
) {
  throw new Error('Checkpoint is not the accepted M05 state required for M06');
}

const head = git('rev-parse', 'HEAD');
const main = git('rev-parse', 'origin/main');
const branch =
  process.env.GITHUB_HEAD_REF ||
  (process.env.GITHUB_REF?.startsWith('refs/heads/')
    ? process.env.GITHUB_REF.slice('refs/heads/'.length)
    : git('branch', '--show-current'));

if (main !== expectedBase) {
  throw new Error(`NERVA-WO-007 Context Lock STALE: origin/main=${main}`);
}
if (branch !== expectedBranch) {
  throw new Error(`Unexpected NERVA-WO-007 branch: ${branch}`);
}
git('merge-base', '--is-ancestor', expectedBase, head);

const wo = fs.readFileSync('.engineering/work-orders/NERVA-WO-007.md', 'utf8');
const brief = fs.readFileSync('.engineering/execution-briefs/NERVA-WO-007-CODEX.md', 'utf8');
const evidence = fs.readFileSync('.engineering/evidence/NERVA-WO-007-EVIDENCE.md', 'utf8');
for (const section of [
  'OBJECTIVE','CONTEXT','SCOPE','OUT OF SCOPE','FILES / SOURCES TO READ','REQUIREMENTS',
  'ARCHITECTURE RULES','CONSTRAINTS','ACCEPTANCE CRITERIA','TESTS / PROOF OBLIGATIONS',
  'DELIVERABLES','REVIEW FORMAT','STOP CONDITION'
]) {
  if (!wo.includes(`## ${section}`)) throw new Error(`WO-007 missing section: ${section}`);
}
if (!wo.includes('NERVA_V0_1_METROPOLIS_RELEASE_READY_FOR_AUDIT')) throw new Error('WO-007 stop marker missing');
if (!brief.includes('NERVA_V0_1_METROPOLIS_RELEASE_READY_FOR_AUDIT')) throw new Error('WO-007 brief stop marker missing');

let state = 'NERVA_WO_007_ADMITTED_READY_FOR_EXECUTION';
if (!evidence.includes('M06 implementation: NOT_STARTED')) state = 'NERVA_WO_007_EXECUTION_IN_PROGRESS';
if (evidence.includes('NERVA_V0_1_METROPOLIS_RELEASE_READY_FOR_AUDIT')) {
  state = 'NERVA_V0_1_METROPOLIS_RELEASE_READY_FOR_AUDIT';
}

console.log(JSON.stringify({
  ok:true,
  base:expectedBase,
  head,
  branch,
  issue:19,
  fingerprints:fingerprints.length,
  state
}));
