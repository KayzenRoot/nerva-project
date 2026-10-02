# NERVA-WO-000 — Evidence Bundle

**Work Order:** NERVA-WO-000  
**Issue:** #1  
**PR:** #2  
**Admission base:** `main@f43d88241a71dfaee305653953a6c9e1f0fab492`  
**Execution branch:** `chore/nerva-wo-000-gef-1.1.2-bootstrap`  
**GEF:** `@gef-bootstrap/cli@1.1.2`  
**Status:** READY_FOR_FINAL_EXACT_HEAD_VALIDATION

## Release identity
- Immutable GEF tag: `v1.1.2`
- Immutable source target: `af1fe9371a3883cbd8a4aafcbb405ddcd4c2ca82`
- npm package: `@gef-bootstrap/cli@1.1.2`
- Release tarball SHA-256: `331a5d035188ef1dc1c92e5c4e5317edcdbf45956dc07703231bbc64dbb7ab97`
- Registry SRI: `sha512-zLu0oaBWqwIPviZgN0PTk1/5QlsHK8r7aCNOkMop0MnlzqFZ1um3zfkRO2l8hx005nd/2xZ/Ll/lDzYUbH01uw==`

## Generated consumer state
The hosted bootstrap generated and committed, without manual editing:
- `package-lock.json`
- `.gef/init-state.json`
- `.gef/receipts/run-1-a2be9ac4152d.json`

Observed generated state:
- `kind = gef.init.state`
- `commandId = gef.init.run`
- `productVersion = 1.1.2`
- `runId = run-1-a2be9ac4152d`
- `transaction.outcome = APPLIED`

Observed generated receipt:
- `kind = gef.cli.receipt`
- `commandId = gef.init.run`
- `productVersion = 1.1.2`
- `effectStatus = CONFIRMED`
- `transaction.outcome = APPLIED`

## Hosted execution history
### Run 37006387129 — first harness attempt
- package install: PASS
- exact version/SRI identity: PASS
- GREENFIELD init harness: FAIL before GEF apply because of a Bash syntax defect in the workflow block
- classification: harness defect, not GEF/package/product defect
- correction: same Work Order/PR, no product scope expansion

### Run 37006554044 — corrected harness / concurrent execution
- install exact dependency: PASS
- immutable package identity: PASS
- governed GREENFIELD init: PASS
- generated state verification: PASS
- doctor + deterministic status + dependency audit: PASS
- final push step: FAIL because the remote branch had already advanced from the concurrent hosted bootstrap
- remote reconciliation: the winning hosted execution committed `package-lock.json` and generated `.gef/` state; remote HEAD became `9471db892a3c367a418263b98d150a6b4d71d611`

## Current file evidence
- `package.json` pins `@gef-bootstrap/cli` exactly to `1.1.2`
- `package-lock.json` resolves `https://registry.npmjs.org/@gef-bootstrap/cli/-/cli-1.1.2.tgz`
- lockfile integrity equals the immutable release SRI above
- `.gitignore` excludes `node_modules/` and `.gef-private/`
- generated `.gef/` state is tracked
- product implementation remains NOT_STARTED

## Tests / checks proven before final exact-head run
- Node 22 hosted runtime: PASS
- npm registry install: PASS
- CLI version 1.1.2: PASS
- release SRI equality: PASS
- `gef init` preview: PASS
- `gef init --apply`: PASS
- generated state/receipt verifier: PASS
- `gef doctor --json`: PASS
- repeated `gef status --json` byte comparison: PASS
- `npm audit --audit-level=high`: PASS
- repository cleanliness after generated-state commit: PASS before the concurrent push race

## Findings / corrections
- CRITICAL: 0
- HIGH: 0
- Harness correction: Bash block syntax fixed by moving deterministic package/state assertions into `.github/scripts/verify-gef-bootstrap.mjs`.
- Concurrency observation: two hosted runs attempted bootstrap materialization. One advanced the remote branch; the other failed only at non-fast-forward push after all GEF validations had passed. No force-push or history rewrite was used.

## Final audit gate
A fresh PR-triggered run on the Evidence Bundle head MUST:
1. use the already committed lockfile;
2. use the already committed generated GEF state/receipt;
3. perform no bootstrap regeneration;
4. pass package identity, state verification, doctor, deterministic status, npm audit and clean-tree checks;
5. complete push as a no-op/up-to-date operation.

Final exact head and hosted run ID are recorded in the PR audit comment after the run completes so the repository head is not changed merely to write its own check-run ID.

## STOP CONDITION
`NERVA_WO_000_EXACT_HEAD_READY_FOR_AUDIT`
