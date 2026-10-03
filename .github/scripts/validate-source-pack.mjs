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
];

const missing = required.filter((path) => !fs.existsSync(path));
if (missing.length > 0) throw new Error(`Missing Source Pack files: ${missing.join(', ')}`);

const checkpoint = JSON.parse(fs.readFileSync('.engineering/CHECKPOINT.json', 'utf8'));
if (checkpoint.phase !== 'IMPLEMENTATION_IN_PROGRESS') throw new Error('Checkpoint phase drift');
for (const module of ['m00Status','m01Status','m02Status','m03Status']) {
  if (checkpoint[module] !== 'APPROVED') throw new Error(`${module} approval not promoted`);
}
if (checkpoint.sourcePackStatus !== 'CANONICAL_V0_1') throw new Error('Source Pack is not canonical');
if (checkpoint.activeNextModule !== 'M04') throw new Error('Next module drift');
if (checkpoint.nextModuleWorkOrder !== 'NOT_ADMITTED') throw new Error('M04 must remain unadmitted');
if (checkpoint.implementationStatus !== 'STARTED') throw new Error('Implementation state drift');
if (checkpoint.runtimeProductCode !== 'M03_POLICY_SIMULATION_CLOSED_EFFECT_BOUNDARY')
  throw new Error('M03 runtime state drift');
if (checkpoint.lastApprovedWorkOrder !== 'NERVA-WO-004')
  throw new Error('Last approved Work Order drift');
if (checkpoint.knownCritical !== 0 || checkpoint.knownHigh !== 0)
  throw new Error('Checkpoint has unresolved CRITICAL/HIGH');

const wo5 = fs.readFileSync('.engineering/work-orders/NERVA-WO-005.md', 'utf8');
const wo5Lock = JSON.parse(fs.readFileSync('.engineering/context-locks/NERVA-WO-005.json', 'utf8'));
const wo5Brief = fs.readFileSync('.engineering/execution-briefs/NERVA-WO-005-CODEX.md', 'utf8');
const wo5Evidence = fs.readFileSync('.engineering/evidence/NERVA-WO-005-EVIDENCE.md', 'utf8');
if (
  wo5Lock.workOrder !== 'NERVA-WO-005' ||
  wo5Lock.module !== 'M04' ||
  wo5Lock.executionBase !== 'd13629e0dc2d66c4f8b2e512b82ce0d11aec1a93' ||
  wo5Lock.executionBranch !== 'feat/nerva-wo-005-m04-agent-wallet-permissions-evidence' ||
  wo5Lock.issueNumber !== 13 ||
  Object.keys(wo5Lock.criticalInputs ?? {}).length !== 64
)
  throw new Error('NERVA-WO-005 Context Lock admission identity/fingerprint mismatch');
for (const section of [
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
  if (!wo5.includes(`## ${section}`)) throw new Error(`NERVA-WO-005 Work Order missing ${section}`);
}
for (const marker of ['Wallet Identity', 'Agent Identity', 'Capability Grant', 'Permission Compiler', 'EIP-712', 'EIP-7702', 'Temporary/session authority', 'revocation engine', 'durable replay protection', 'Permission evidence chain', 'Flight Recorder', 'M03 authorization boundary']) {
  if (!wo5.includes(marker) && !wo5Brief.includes(marker))
    throw new Error(`NERVA-WO-005 admission package missing ${marker}`);
}
if (!wo5.includes('NERVA_WO_005_ADMITTED_READY_FOR_EXECUTION'))
  throw new Error('NERVA-WO-005 admission stop condition missing');
if (!wo5Evidence.includes('SCAFFOLD ONLY — NO M04 IMPLEMENTATION EVIDENCE'))
  throw new Error('NERVA-WO-005 Evidence Bundle must remain a scaffold');
if (!wo5Evidence.includes('NOT STARTED — this file is an admission scaffold only'))
  throw new Error('NERVA-WO-005 Evidence Bundle claims implementation');
if (!wo5Brief.includes('implements no M04 product code'))
  throw new Error('NERVA-WO-005 execution brief must preserve admission-only scope');

const roadmap = fs.readFileSync('.engineering/MODULE-ROADMAP.md', 'utf8');
for (const module of ['M00','M01','M02','M03','M04','M05','M06']) {
  if (!roadmap.includes(`## ${module} —`)) throw new Error(`Roadmap missing ${module}`);
}
const hierarchy = fs.readFileSync('.engineering/SOURCE-HIERARCHY.md', 'utf8');
for (const anchor of ['CHECKPOINT.md','DECISIONS-LEDGER.md','SCOPE.md','DEFINITION-OF-DONE.md','ARCHITECTURE.md','REQUIREMENTS.md']) {
  if (!hierarchy.includes(anchor)) throw new Error(`Source hierarchy missing ${anchor}`);
}
const decisions = fs.readFileSync('.engineering/DECISIONS-LEDGER.md', 'utf8');
for (const id of ['D-0004','D-0005','D-0006','D-0011','D-0016','D-0018','D-0020']) {
  if (!decisions.includes(id)) throw new Error(`Critical decision missing ${id}`);
}

console.log(JSON.stringify({
  ok:true,
  requiredFiles:required.length,
  modules:7,
  sourcePack:'CANONICAL_V0_1',
  m03:'APPROVED',
  nextModule:'M04',
  nextWorkOrder:'NOT_ADMITTED',
  m04AdmissionPackage:'NERVA_WO_005_ADMISSION_PACKAGE_VALIDATED',
  m04Fingerprints:Object.keys(wo5Lock.criticalInputs).length,
  implementation:'STARTED',
}));
