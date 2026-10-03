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
  '.engineering/work-orders/NERVA-WO-005.md',
  '.engineering/context-locks/NERVA-WO-005.json',
  '.engineering/evidence/NERVA-WO-005-EVIDENCE.md',
  '.engineering/checkpoint-deltas/NERVA-WO-005-PROPOSED.md',
  '.engineering/work-orders/NERVA-WO-006.md',
  '.engineering/context-locks/NERVA-WO-006.json',
  '.engineering/execution-briefs/NERVA-WO-006-CODEX.md',
  '.engineering/evidence/NERVA-WO-006-EVIDENCE.md',
  'docs/M04-AGENT-WALLET-PERMISSIONS.md',
];

const missing = required.filter((path) => !fs.existsSync(path));
if (missing.length > 0) {
  throw new Error(`Missing Source Pack/admission files: ${missing.join(', ')}`);
}

const checkpoint = JSON.parse(fs.readFileSync('.engineering/CHECKPOINT.json', 'utf8'));
for (const module of ['m00Status', 'm01Status', 'm02Status', 'm03Status', 'm04Status']) {
  if (checkpoint[module] !== 'APPROVED') {
    throw new Error(`${module} approval not promoted`);
  }
}
if (
  checkpoint.phase !== 'IMPLEMENTATION_IN_PROGRESS' ||
  checkpoint.sourcePackStatus !== 'CANONICAL_V0_1' ||
  checkpoint.activeNextModule !== 'M05' ||
  checkpoint.nextModuleWorkOrder !== 'NOT_ADMITTED' ||
  checkpoint.runtimeProductCode !== 'M04_AGENT_WALLET_BOUNDED_PERMISSIONS_VERIFIABLE_EVIDENCE' ||
  checkpoint.lastApprovedWorkOrder !== 'NERVA-WO-005' ||
  checkpoint.knownCritical !== 0 ||
  checkpoint.knownHigh !== 0
) {
  throw new Error('Canonical M04/M05 checkpoint state drift');
}

const wo = fs.readFileSync('.engineering/work-orders/NERVA-WO-006.md', 'utf8');
const lock = JSON.parse(fs.readFileSync('.engineering/context-locks/NERVA-WO-006.json', 'utf8'));
const brief = fs.readFileSync('.engineering/execution-briefs/NERVA-WO-006-CODEX.md', 'utf8');
const evidence = fs.readFileSync('.engineering/evidence/NERVA-WO-006-EVIDENCE.md', 'utf8');

if (
  lock.workOrder !== 'NERVA-WO-006' ||
  lock.module !== 'M05' ||
  lock.executionBase !== '5243c2808f258996c11e5e2fa9dffa5af96041cd' ||
  lock.executionBranch !== 'feat/nerva-wo-006-m05-product-demo' ||
  lock.issueNumber !== 15 ||
  Object.keys(lock.criticalInputs ?? {}).length !== 89
) {
  throw new Error('NERVA-WO-006 Context Lock admission identity/fingerprint mismatch');
}

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
  if (!wo.includes(`## ${heading}`)) {
    throw new Error(`NERVA-WO-006 Work Order missing ${heading}`);
  }
}

if (!wo.includes('NERVA_M05_PRODUCT_DEMO_READY_FOR_AUDIT')) {
  throw new Error('NERVA-WO-006 implementation stop condition missing');
}
if (!brief.includes('NERVA_M05_PRODUCT_DEMO_READY_FOR_AUDIT')) {
  throw new Error('NERVA-WO-006 execution brief missing stop condition');
}
if (!evidence.includes('EXECUTION_NOT_STARTED')) {
  throw new Error('NERVA-WO-006 admission Evidence Bundle makes an implementation claim');
}

console.log(
  JSON.stringify({
    ok: true,
    sourcePack: 'CANONICAL_V0_1',
    m04: 'APPROVED',
    nextModule: 'M05',
    nextWorkOrder: 'NOT_ADMITTED',
    m05Admission: 'READY_FOR_EXECUTION',
    m05Fingerprints: 89,
  }),
);
