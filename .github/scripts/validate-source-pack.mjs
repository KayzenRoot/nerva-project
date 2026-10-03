import fs from 'node:fs';

const required = [
  '.engineering/SOURCE-HIERARCHY.md',
  '.engineering/PROJECT-OVERVIEW.md',
  '.engineering/REQUIREMENTS.md',
  '.engineering/SCOPE.md',
  '.engineering/ARCHITECTURE.md',
  '.engineering/SECURITY.md',
  '.engineering/TEST-BENCHMARK-PLAN.md',
  '.engineering/DEPLOYMENT.md',
  '.engineering/BACKLOG.md',
  '.engineering/DEFINITION-OF-DONE.md',
  '.engineering/DECISIONS-LEDGER.md',
  '.engineering/CHECKPOINT.md',
  '.engineering/CHECKPOINT.json',
  '.engineering/INTEGRATION-CONTRACTS.md',
  '.engineering/DATA-MODEL.md',
  '.engineering/API-CONTRACTS.md',
  '.engineering/UI-UX.md',
  '.engineering/MIGRATION-RECOVERY.md',
  '.engineering/COMPETITION-STRATEGY.md',
  '.engineering/MONETIZATION.md',
  '.engineering/MODULE-ROADMAP.md',
  '.engineering/DEMO-CONTRACT.md',
  '.engineering/decisions/ADR-0001-AUTHORIZATION-BOUNDARY.md',
  '.engineering/decisions/ADR-0002-GUARDIAN-NERVA-BOUNDARY.md',
  '.engineering/work-orders/NERVA-WO-001.md',
  '.engineering/context-locks/NERVA-WO-001.json',
  '.engineering/work-orders/NERVA-WO-002.md',
  '.engineering/context-locks/NERVA-WO-002.json',
  '.engineering/evidence/NERVA-WO-002-EVIDENCE.md',
  '.engineering/work-orders/NERVA-WO-003.md',
  '.engineering/context-locks/NERVA-WO-003.json',
  '.engineering/execution-briefs/NERVA-WO-003-CODEX.md',
  '.engineering/evidence/NERVA-WO-003-EVIDENCE.md',
  '.engineering/checkpoint-deltas/NERVA-WO-003-PROPOSED.md',
  '.engineering/work-orders/NERVA-WO-004.md',
  '.engineering/context-locks/NERVA-WO-004.json',
  '.engineering/execution-briefs/NERVA-WO-004-CODEX.md',
  '.engineering/evidence/NERVA-WO-004-EVIDENCE.md',
];

const missing = required.filter((path) => !fs.existsSync(path));
if (missing.length > 0) {
  throw new Error(`Missing Source Pack files: ${missing.join(', ')}`);
}

const checkpoint = JSON.parse(fs.readFileSync('.engineering/CHECKPOINT.json', 'utf8'));

if (checkpoint.phase !== 'IMPLEMENTATION_IN_PROGRESS') {
  throw new Error('Checkpoint phase drift');
}
if (checkpoint.m00Status !== 'APPROVED') {
  throw new Error('M00 approval not promoted');
}
if (checkpoint.m01Status !== 'APPROVED') {
  throw new Error('M01 approval not promoted');
}
if (checkpoint.m02Status !== 'APPROVED') {
  throw new Error('M02 approval not promoted');
}
if (checkpoint.sourcePackStatus !== 'CANONICAL_V0_1') {
  throw new Error('Source Pack is not canonical');
}
if (checkpoint.activeNextModule !== 'M03') {
  throw new Error('Next module drift');
}
if (checkpoint.nextModuleWorkOrder !== 'NOT_ADMITTED') {
  throw new Error('M03 must remain unadmitted');
}
if (checkpoint.implementationStatus !== 'STARTED') {
  throw new Error('Implementation state drift');
}
if (checkpoint.runtimeProductCode !== 'M02_OBSERVATION_RISK_FOUNDATION') {
  throw new Error('M02 runtime state drift');
}
if (checkpoint.lastApprovedWorkOrder !== 'NERVA-WO-003') {
  throw new Error('Last approved Work Order drift');
}
if (checkpoint.knownCritical !== 0 || checkpoint.knownHigh !== 0) {
  throw new Error('Checkpoint has unresolved CRITICAL/HIGH');
}

const roadmap = fs.readFileSync('.engineering/MODULE-ROADMAP.md', 'utf8');
for (const module of ['M00', 'M01', 'M02', 'M03', 'M04', 'M05', 'M06']) {
  if (!roadmap.includes(`## ${module} —`)) {
    throw new Error(`Roadmap missing ${module}`);
  }
}

const hierarchy = fs.readFileSync('.engineering/SOURCE-HIERARCHY.md', 'utf8');
for (const anchor of [
  'CHECKPOINT.md',
  'DECISIONS-LEDGER.md',
  'SCOPE.md',
  'DEFINITION-OF-DONE.md',
  'ARCHITECTURE.md',
  'REQUIREMENTS.md',
]) {
  if (!hierarchy.includes(anchor)) {
    throw new Error(`Source hierarchy missing ${anchor}`);
  }
}

const decisions = fs.readFileSync('.engineering/DECISIONS-LEDGER.md', 'utf8');
for (const id of ['D-0004', 'D-0005', 'D-0006', 'D-0011', 'D-0016', 'D-0018', 'D-0020']) {
  if (!decisions.includes(id)) {
    throw new Error(`Critical decision missing ${id}`);
  }
}

console.log(
  JSON.stringify({
    ok: true,
    requiredFiles: required.length,
    modules: 7,
    sourcePack: 'CANONICAL_V0_1',
    m02: 'APPROVED',
    nextModule: 'M03',
    nextWorkOrder: 'NOT_ADMITTED',
    implementation: 'STARTED',
  }),
);
