import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const lock = JSON.parse(fs.readFileSync('.engineering/context-locks/NERVA-WO-002.json', 'utf8'));
const base = lock.executionBase;
if (lock.status !== 'LOCKED' || base !== '4dcdd3fd0cdd1ac7c8933839e7d70e60b925a955')
  throw new Error('Context Lock identity/status changed');
const main = execFileSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' }).trim();
if (main !== base)
  throw new Error(`Context Lock is stale: origin/main is ${main}, expected ${base}`);

for (const [file, expectedBlob] of Object.entries(lock.criticalInputs)) {
  const baseBlob = execFileSync('git', ['rev-parse', `${base}:${file}`], {
    encoding: 'utf8',
  }).trim();
  const worktreeBlob = execFileSync('git', ['hash-object', file], { encoding: 'utf8' }).trim();
  if (baseBlob !== expectedBlob || worktreeBlob !== expectedBlob) {
    throw new Error(
      `Context Lock fingerprint mismatch for ${file}: base=${baseBlob} worktree=${worktreeBlob} expected=${expectedBlob}`,
    );
  }
}
console.log(
  JSON.stringify({
    ok: true,
    executionBase: base,
    criticalInputs: Object.keys(lock.criticalInputs).length,
    state: 'LOCKED',
  }),
);
