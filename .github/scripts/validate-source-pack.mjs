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
  '.engineering/checkpoint-deltas/NERVA-WO-004-PROPOSED.md',
  '.engineering/work-orders/NERVA-WO-005.md',
  '.engineering/context-locks/NERVA-WO-005.json',
  '.engineering/execution-briefs/NERVA-WO-005-CODEX.md',
  '.engineering/evidence/NERVA-WO-005-EVIDENCE.md',
  '.engineering/checkpoint-deltas/NERVA-WO-005-PROPOSED.md',
  'docs/M04-AGENT-WALLET-PERMISSIONS.md',
  '.engineering/work-orders/NERVA-WO-006.md',
  '.engineering/context-locks/NERVA-WO-006.json',
  '.engineering/execution-briefs/NERVA-WO-006-CODEX.md',
  '.engineering/evidence/NERVA-WO-006-EVIDENCE.md',
  '.engineering/checkpoint-deltas/NERVA-WO-006-PROPOSED.md',
  'docs/NERVA-M05-DEMO-RUNBOOK.md',
  '.engineering/work-orders/NERVA-WO-007.md',
  '.engineering/context-locks/NERVA-WO-007.json',
  '.engineering/execution-briefs/NERVA-WO-007-CODEX.md',
  '.engineering/evidence/NERVA-WO-007-EVIDENCE.md',
  '.engineering/checkpoint-deltas/NERVA-WO-007-PROPOSED.md',
];

const missing = required.filter((path) => !fs.existsSync(path));
if (missing.length > 0) {
  throw new Error(`Missing Source Pack files: ${missing.join(', ')}`);
}

const checkpoint = JSON.parse(fs.readFileSync('.engineering/CHECKPOINT.json', 'utf8'));

if (checkpoint.phase !== 'IMPLEMENTATION_IN_PROGRESS') {
  throw new Error('Checkpoint phase drift');
}
for (const module of ['m00Status', 'm01Status', 'm02Status', 'm03Status', 'm04Status', 'm05Status']) {
  if (checkpoint[module] !== 'APPROVED') {
    throw new Error(`${module} approval not promoted`);
  }
}
if (checkpoint.sourcePackStatus !== 'CANONICAL_V0_1') {
  throw new Error('Source Pack is not canonical');
}
if (checkpoint.activeNextModule !== 'M06') {
  throw new Error('Next module drift');
}
if (checkpoint.nextModuleWorkOrder !== 'NOT_ADMITTED') {
  throw new Error('M06 must remain unadmitted');
}
if (checkpoint.implementationStatus !== 'STARTED') {
  throw new Error('Implementation state drift');
}
if (checkpoint.runtimeProductCode !== 'M05_EXPERIENCE_DEMO_M04_SAFETY_BOUNDARY') {
  throw new Error('M05 runtime state drift');
}
if (checkpoint.lastApprovedWorkOrder !== 'NERVA-WO-006') {
  throw new Error('Last approved Work Order drift');
}
if (checkpoint.knownCritical !== 0 || checkpoint.knownHigh !== 0) {
  throw new Error('Checkpoint has unresolved CRITICAL/HIGH');
}

const m04Lock = JSON.parse(fs.readFileSync('.engineering/context-locks/NERVA-WO-005.json', 'utf8'));
const m04Evidence = fs.readFileSync('.engineering/evidence/NERVA-WO-005-EVIDENCE.md', 'utf8');
if (
  m04Lock.workOrder !== 'NERVA-WO-005' ||
  m04Lock.module !== 'M04' ||
  m04Lock.executionBase !== 'd13629e0dc2d66c4f8b2e512b82ce0d11aec1a93' ||
  m04Lock.executionBranch !== 'feat/nerva-wo-005-m04-agent-wallet-permissions-evidence' ||
  m04Lock.issueNumber !== 13 ||
  Object.keys(m04Lock.criticalInputs ?? {}).length !== 64
) {
  throw new Error('NERVA-WO-005 Context Lock identity/fingerprint mismatch');
}
if (!m04Evidence.includes('070badfa79323328b11840c4eb6c0326d31e2637')) {
  throw new Error('M04 Evidence Bundle is missing the exact audited head');
}
if (!m04Evidence.includes('Verdict: `APPROVED`')) {
  throw new Error('M04 Evidence Bundle is missing the approval receipt');
}

const m05Lock = JSON.parse(fs.readFileSync('.engineering/context-locks/NERVA-WO-006.json', 'utf8'));
const m05Evidence = fs.readFileSync('.engineering/evidence/NERVA-WO-006-EVIDENCE.md', 'utf8');
if (
  m05Lock.workOrder !== 'NERVA-WO-006' ||
  m05Lock.module !== 'M05' ||
  m05Lock.status !== 'LOCKED' ||
  m05Lock.executionBase !== '5243c2808f258996c11e5e2fa9dffa5af96041cd' ||
  m05Lock.executionBranch !== 'feat/nerva-wo-006-m05-product-demo' ||
  m05Lock.issueNumber !== 15 ||
  Object.keys(m05Lock.criticalInputs ?? {}).length !== 89
) {
  throw new Error('NERVA-WO-006 Context Lock identity/fingerprint mismatch');
}
if (!m05Evidence.includes('bd0190a744befa413fac15f4f276d28b846a348e')) {
  throw new Error('M05 Evidence Bundle is missing the exact audited head');
}
if (!m05Evidence.includes('Verdict: `APPROVED`')) {
  throw new Error('M05 Evidence Bundle is missing the approval receipt');
}
if (!m05Evidence.includes('NERVA_M05_PRODUCT_DEMO_READY_FOR_AUDIT')) {
  throw new Error('M05 stop condition is missing from evidence');
}

const roadmap = fs.readFileSync('.engineering/MODULE-ROADMAP.md', 'utf8');
for (const module of ['M00', 'M01', 'M02', 'M03', 'M04', 'M05', 'M06']) {
  if (!roadmap.includes(`## ${module} —`)) {
    throw new Error(`Roadmap missing ${module}`);
  }
}

console.log(
  JSON.stringify({
    ok: true,
    requiredFiles: required.length,
    modules: 7,
    sourcePack: 'CANONICAL_V0_1',
    m05: 'APPROVED',
    nextModule: 'M06',
    nextWorkOrder: 'NOT_ADMITTED',
    implementation: 'STARTED',
  }),
);
