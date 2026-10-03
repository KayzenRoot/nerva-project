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
];

const missing = required.filter((path) => !fs.existsSync(path));
if (missing.length > 0) {
  throw new Error(`Missing Source Pack files: ${missing.join(', ')}`);
}

const checkpoint = JSON.parse(fs.readFileSync('.engineering/CHECKPOINT.json', 'utf8'));

if (checkpoint.phase !== 'IMPLEMENTATION_IN_PROGRESS') {
  throw new Error('Checkpoint phase drift');
}
for (const module of ['m00Status', 'm01Status', 'm02Status', 'm03Status', 'm04Status']) {
  if (checkpoint[module] !== 'APPROVED') {
    throw new Error(`${module} approval not promoted`);
  }
}
if (checkpoint.sourcePackStatus !== 'CANONICAL_V0_1') {
  throw new Error('Source Pack is not canonical');
}
if (checkpoint.activeNextModule !== 'M05') {
  throw new Error('Next module drift');
}
if (checkpoint.nextModuleWorkOrder !== 'NOT_ADMITTED') {
  throw new Error('M05 must remain unadmitted');
}
if (checkpoint.implementationStatus !== 'STARTED') {
  throw new Error('Implementation state drift');
}
if (checkpoint.runtimeProductCode !== 'M04_AGENT_WALLET_BOUNDED_PERMISSIONS_VERIFIABLE_EVIDENCE') {
  throw new Error('M04 runtime state drift');
}
if (checkpoint.lastApprovedWorkOrder !== 'NERVA-WO-005') {
  throw new Error('Last approved Work Order drift');
}
if (checkpoint.knownCritical !== 0 || checkpoint.knownHigh !== 0) {
  throw new Error('Checkpoint has unresolved CRITICAL/HIGH');
}

const lock = JSON.parse(fs.readFileSync('.engineering/context-locks/NERVA-WO-005.json', 'utf8'));
const evidence = fs.readFileSync('.engineering/evidence/NERVA-WO-005-EVIDENCE.md', 'utf8');
if (
  lock.workOrder !== 'NERVA-WO-005' ||
  lock.module !== 'M04' ||
  lock.executionBase !== 'd13629e0dc2d66c4f8b2e512b82ce0d11aec1a93' ||
  lock.executionBranch !== 'feat/nerva-wo-005-m04-agent-wallet-permissions-evidence' ||
  lock.issueNumber !== 13 ||
  Object.keys(lock.criticalInputs ?? {}).length !== 64
) {
  throw new Error('NERVA-WO-005 Context Lock identity/fingerprint mismatch');
}
if (!evidence.includes('070badfa79323328b11840c4eb6c0326d31e2637')) {
  throw new Error('M04 Evidence Bundle is missing the exact audited head');
}
if (!evidence.includes('Verdict: `APPROVED`')) {
  throw new Error('M04 Evidence Bundle is missing the approval receipt');
}
if (!evidence.includes('NERVA_M04_AGENT_WALLET_PERMISSIONS_EVIDENCE_READY_FOR_AUDIT')) {
  throw new Error('M04 stop condition is missing from evidence');
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
    m04: 'APPROVED',
    nextModule: 'M05',
    nextWorkOrder: 'NOT_ADMITTED',
    implementation: 'STARTED',
  }),
);
