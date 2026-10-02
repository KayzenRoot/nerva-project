import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const lock = JSON.parse(fs.readFileSync('.engineering/context-locks/NERVA-WO-002.json', 'utf8'));
const base = lock.executionBase;
const auditedHead = '068120fd423b3b01ec2c2b5f17b5df6ad94586a0';

if (lock.status !== 'LOCKED' || base !== '4dcdd3fd0cdd1ac7c8933839e7d70e60b925a955') {
  throw new Error('Context Lock identity/status changed');
}

const main = execFileSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' }).trim();
if (main !== base) {
  throw new Error(`Context Lock base moved before merge: origin/main is ${main}, expected ${base}`);
}

function blobAt(ref, file) {
  return execFileSync('git', ['rev-parse', `${ref}:${file}`], { encoding: 'utf8' }).trim();
}

let executionLockStillCurrent = true;
for (const [file, expectedBlob] of Object.entries(lock.criticalInputs)) {
  const baseBlob = blobAt(base, file);
  if (baseBlob !== expectedBlob) {
    throw new Error(
      `Context Lock base fingerprint mismatch for ${file}: base=${baseBlob} expected=${expectedBlob}`,
    );
  }

  const worktreeBlob = execFileSync('git', ['hash-object', file], { encoding: 'utf8' }).trim();
  if (worktreeBlob !== expectedBlob) executionLockStillCurrent = false;
}

if (executionLockStillCurrent) {
  console.log(
    JSON.stringify({
      ok: true,
      executionBase: base,
      criticalInputs: Object.keys(lock.criticalInputs).length,
      state: 'LOCKED',
    }),
  );
  process.exit(0);
}

// After an objective M01 audit, promotion necessarily changes canonical checkpoint inputs.
// Prove the lock was intact at the exact audited head, then permit only governance-promotion paths.
execFileSync('git', ['merge-base', '--is-ancestor', auditedHead, 'HEAD']);
for (const [file, expectedBlob] of Object.entries(lock.criticalInputs)) {
  const auditedBlob = blobAt(auditedHead, file);
  if (auditedBlob !== expectedBlob) {
    throw new Error(
      `Audited-head Context Lock fingerprint mismatch for ${file}: audited=${auditedBlob} expected=${expectedBlob}`,
    );
  }
}

const allowedPromotionPaths = new Set([
  '.engineering/BACKLOG.md',
  '.engineering/CHECKPOINT.json',
  '.engineering/CHECKPOINT.md',
  '.engineering/SOURCE-HIERARCHY.md',
  '.engineering/checkpoint-deltas/NERVA-WO-002-PROPOSED.md',
  '.engineering/evidence/NERVA-WO-002-EVIDENCE.md',
  '.engineering/work-orders/NERVA-WO-002.md',
  '.github/scripts/validate-nerva-context-lock.mjs',
  '.github/scripts/validate-source-pack.mjs',
  'README.md',
]);

const promotionDiff = execFileSync('git', ['diff', '--name-only', `${auditedHead}..HEAD`], {
  encoding: 'utf8',
})
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .filter(Boolean);

if (promotionDiff.length === 0) {
  throw new Error('Context Lock drift exists but no audited promotion delta is present');
}

const forbidden = promotionDiff.filter((file) => !allowedPromotionPaths.has(file));
if (forbidden.length > 0) {
  throw new Error(
    `Post-audit Context Lock drift includes non-promotion paths: ${forbidden.join(', ')}`,
  );
}

console.log(
  JSON.stringify({
    ok: true,
    executionBase: base,
    auditedHead,
    criticalInputs: Object.keys(lock.criticalInputs).length,
    promotionFiles: promotionDiff.length,
    state: 'PROMOTION_ONLY_AFTER_APPROVED_AUDIT',
  }),
);
