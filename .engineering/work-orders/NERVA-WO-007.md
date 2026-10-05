# NERVA-WO-007 — M06 Release Hardening, Deployment & Metropolis Submission

**Status:** ADMITTED — OWNER AUTHORIZED  
**Risk:** HIGH_ASSURANCE  
**Module:** M06  
**Issue:** #19  
**Execution base:** `main@b778b470eff4ff997def001899530512065e5676`  
**Execution branch:** `feat/nerva-wo-007-m06-release-hardening`  
**GEF:** `@gef-bootstrap/cli@1.1.2`  
**Primary executor:** Codex  
**Review language:** pt-BR

## OBJECTIVE

Take the independently approved M00–M05 NERVA baseline to a release candidate that is objectively hardened, reproducibly deployable, truthfully packaged for Monad Metropolis, and ready for final V0.1 audit.

M06 is the final module. It owns repository/release governance, regression/adversarial/recovery hardening, dependency/configuration review, deployment proof, operational/runbook completeness, competition/submission packaging, and the final Definition of Done evidence.

The target stop condition is:

`NERVA_V0_1_METROPOLIS_RELEASE_READY_FOR_AUDIT`

M06 does **not** automatically authorize MAINNET_EXECUTION or live Perpl writes. The safest admissible release is a fully working TESTNET/DEMO + MAINNET_READONLY product with deterministic dry-run/protection proof and clearly blocked effect boundaries.

## CONTEXT

M00–M05 are APPROVED. Canonical M05 closeout is on `main@b778b470eff4ff997def001899530512065e5676`.

Carry-forward gates:
1. `MAINNET EFFECT = HARD_BLOCKED`.
2. `LIVE PERPL WRITES = BLOCKED` while protective-only provider scope/enrollment provenance is unproven.
3. Production trusted-issuer configuration is not provisioned; affected mutation paths fail closed.
4. DB-level kill-switch concurrency semantics remain mandatory before any future live provider adapter.
5. Four MODERATE Drizzle Kit/esbuild transitive advisories remain for release disposition.
6. `LIQUIDATION_DISTANCE`, `MAINTENANCE_MARGIN`, and `FUNDING_DIRECTION` remain non-authoritative/unproven.
7. No MetaMask Transaction Shield coverage on Monad may be claimed without current exact evidence.
8. The 90-second DEMO_ONLY flow is accepted and must remain deterministic/truthful.

Public Metropolis information observed on 2026-10-04 is not sufficient to freeze the exact submission deadline/time or bounty eligibility because current public listings conflict. The authenticated/current official portal is authoritative and must be captured in M06 evidence before submission.

## SCOPE

### 1. Repository ruleset hardening — FIRST EXECUTION TASK

Inspect repository administration state using GitHub CLI/API. Current audit found no repository ruleset and `main` is unprotected.

Create or update one active branch ruleset for `refs/heads/main` with an idempotent configuration named:

`NERVA main / GEF protected flow`

Required policy:
- target: branch;
- enforcement: active;
- include: `refs/heads/main`;
- require changes through pull requests;
- required approving reviews: **0** so the automated GEF flow does not require manual human approval;
- require review-thread resolution;
- no force pushes;
- no branch deletion;
- require linear history;
- strict required-status-check policy;
- required checks:
  - `linux`
  - `windows-bounded`
  - `gef-validation`
  - `source-pack`
  - `SonarCloud Code Analysis`
  - `Socket Security: Pull Request Alerts`
  - `Socket Security: Project Report`
- do not require commit signatures unless objective proof shows every automated executor/merge path signs commits;
- do not add a bypass that silently defeats the policy;
- do not delete or overwrite an unrelated existing ruleset.

Use `gh api` against the repository rulesets endpoint. Read current rulesets before any write. Prefer PATCH when the named ruleset already exists; POST only when absent. Re-read and record the exact resulting ruleset JSON/ID in Evidence Bundle.

If repository plan/API permissions prevent ruleset administration, mark this subtask `BLOCKED_RULESET_ADMIN` with exact HTTP/API evidence. Do not weaken the target policy and do not claim the repository is protected.

### 2. M06 admission / historical validator transition

- Add a fresh M06 Context Lock validator against `b778b470eff4ff997def001899530512065e5676`.
- Historical M05 validation must stop treating legitimate M06 changes as M05 scope violations while continuing to verify the immutable M05 base fingerprints and accepted audit evidence.
- Source Pack validation must recognize the M06 Work Order, Context Lock, execution brief, Evidence Bundle and proposed Checkpoint Delta.
- Do not rewrite old approved evidence.

### 3. Release security hardening

Perform and evidence:
- dependency tree review and `npm audit --audit-level=high`;
- explicit disposition of all four existing MODERATE advisories: fix safely if a compatible release exists, otherwise document why deferred and why release risk remains acceptable;
- secret scan of repository and built client assets;
- CI action pin/provenance review;
- environment/config fail-closed audit;
- CSP / security-header review for deployed web surface;
- API mutation/authentication boundary review;
- no private key/seed phrase/app custody;
- no unsafe logging of signatures, nonces, credentials or wallet secrets;
- adversarial malformed/stale/replay/unknown-state regression;
- demo/live trust-domain isolation regression.

No HIGH/CRITICAL known finding may remain.

### 4. Release regression and chaos/recovery proof

Run and extend only where necessary:
- all existing unit/integration/replay/adversarial/recovery tests;
- Playwright critical journeys;
- Linux and bounded Windows;
- clean migration + accepted upgrade smoke;
- DB integrity/triggers;
- provider disconnect/degraded/stale paths;
- duplicate/idempotency paths;
- revocation concurrency;
- kill-switch behavior;
- ambiguous effect/recovery behavior;
- deterministic demo reset/replay;
- no-console-error critical routes.

Perform one documented recovery drill for the deployed/read-only release path, including rollback/roll-forward of non-financial application state.

### 5. Performance / production-build evidence

Re-run and document:
- risk p95;
- policy p95;
- decision-to-ready-plan p95;
- permission/evidence benchmark;
- production build;
- browser/bundle evidence;
- route health/ready checks;
- deployment cold/warm behavior where objectively measurable.

Do not turn local numbers into provider/network guarantees.

### 6. Deployment

Produce a reproducible immutable deployment tied to exact Git SHA.

Release posture:
- TESTNET/DEMO: allowed;
- MAINNET_READONLY: allowed if configuration is objectively proven;
- MAINNET_EXECUTION: remains OFF unless a separate explicit release decision satisfies every canonical proof obligation;
- DEMO_ONLY controls remain independent and isolated.

Requirements:
- runtime secrets injected outside Git;
- visible environment identity;
- health endpoints;
- deployment receipt with Git SHA, environment, config schema/version and health result;
- operator rollback/roll-forward procedure;
- clean-session deployed demo works without hidden repair.

Use the simplest compatible deployment path. Do not add infrastructure merely for spectacle.

### 7. README / operator / release docs

Update documentation to match shipped truth:
- README quickstart and architecture summary;
- local Docker path;
- environment variables;
- test commands;
- security model and limitations;
- deployment/runbook;
- recovery procedure;
- demo runbook;
- exact blocked capabilities;
- evidence links/references;
- release/version status.

### 8. Metropolis portal and track revalidation

Before packaging/submission:
- open the current official/authenticated Metropolis portal;
- record exact submission deadline and timezone;
- record required fields/assets/repository visibility rules;
- revalidate primary track `Onchain Finance & Trading`;
- verify every targeted sponsor bounty and its current eligibility;
- do not rely on old social posts or cached prize amounts when portal truth differs;
- preserve screenshots/receipts/references in evidence.

If official portal access requires credentials unavailable to executor, document the exact blocker. Submission cannot be declared complete without objective portal proof.

### 9. Submission package

Prepare truthful, final assets:
- project name/tagline;
- concise problem/solution description;
- architecture/technical highlights;
- Monad relevance;
- Perpl relevance;
- security/safety explanation;
- deployed URL;
- repository link/visibility proof;
- demo video/script/checklist;
- 90-second clean demo path;
- screenshots;
- track/bounty selections backed by current eligibility;
- limitations and future roadmap clearly separated from shipped features.

No unimplemented capability may be presented as shipped.

### 10. Final V0.1 DoD audit package

Evidence Bundle must map every applicable V0.1 DoD item to objective proof.

A final release candidate must show:
- M00–M06 NECESSARY obligations satisfied or explicitly blocked by an approved scope decision;
- no HIGH/CRITICAL known defects;
- ruleset/repository governance evidence;
- exact base/head;
- exact deployed commit;
- exact checks;
- release security evidence;
- deployment health;
- recovery drill;
- competition portal revalidation;
- submission package readiness.

## OUT OF SCOPE

- New product feature development unrelated to closing the V0.1 DoD.
- New autonomous action types.
- New trading strategy, leverage, market making or copy trading.
- Token/DAO/tokenomics.
- Custody of keys/seed phrases.
- Live Perpl write adapter unless protective-only scope and enrollment provenance become objectively proven and a separate explicit release decision admits it.
- MAINNET_EXECUTION by default.
- Broad dependency/framework rewrite.
- New sponsor integration solely for bounty optics.
- Design rework unrelated to release defects.
- Future B2B/SDK implementation beyond truthful submission narrative.
- Destructive Git operations, force push, history rewrite or ruleset bypass.

## FILES / SOURCES TO READ

Read in this order:
1. `.engineering/CHECKPOINT.md` + JSON.
2. Decisions Ledger + ADRs.
3. Scope.
4. Definition of Done.
5. Architecture.
6. Requirements.
7. Security.
8. Deployment.
9. Test/Benchmark Plan.
10. Integration/Data/API/UI/Migration contracts.
11. Competition Strategy + Demo Contract.
12. Backlog + Module Roadmap.
13. NERVA-WO-006, Context Lock, Evidence and promoted Delta.
14. Current CI/workflows/scripts.
15. Current deployment/runtime config, README and demo runbook.
16. NERVA-WO-007 + fresh Context Lock.

## REQUIREMENTS

1. Inspect repository and exact branch/base before changes.
2. Validate every M06 Context Lock fingerprint against `b778b470eff4ff997def001899530512065e5676`.
3. If `origin/main` is not exactly `b778b470eff4ff997def001899530512065e5676` at executor preflight, mark Context Lock STALE and stop before implementation.
4. Repository ruleset hardening is the first executor task.
5. Preserve automated mergeability: PR required, checks required, but no manual approval count.
6. All release claims need objective evidence.
7. MAINNET execution stays off unless separately and explicitly admitted after all Security proof obligations.
8. Live Perpl writes stay blocked without provider protective-only proof.
9. Unknown/stale/unproven states remain fail-closed.
10. No demo fixture may reach live execution/persistence.
11. No secret committed or copied to evidence.
12. Four existing MODERATE advisories must receive explicit release disposition.
13. Official/current portal evidence overrides stale competition notes.
14. No release/submission claim before deployed artifact and final exact-head checks are green.
15. No version-complete declaration before independent final audit.

## ARCHITECTURE RULES

- Keep domain, policy, authorization, execution, evidence and experience boundaries intact.
- M06 is hardening/release, not architecture reinvention.
- MAINNET_READONLY and DEMO_ONLY are separate from MAINNET_EXECUTION.
- Deployment config fails closed on missing/unknown execution flags.
- External provider capability is evidence, not inferred authority.
- Historical Work Orders/Evidence are immutable except bounded factual closeout corrections.
- Ruleset enforcement is repository governance; it must not create hidden bypass paths.

## CONSTRAINTS

- HIGH_ASSURANCE.
- Same M06 branch/PR for primary implementation; bounded Correction Deltas stay in the same PR when safe.
- No force push/history rewrite.
- No unrelated cleanup.
- Prefer deterministic tools/tests/Git hashes over prose assertions.
- Exact-pin any necessary new direct dependency only after preflight.
- No CI dependency on wallet/provider secrets.
- If official submission requires a human credential/action unavailable to executor, preserve the blocker rather than fabricate completion.

## ACCEPTANCE CRITERIA

1. Fresh M06 Context Lock validates against exact M05 merged base.
2. Repository `main` is protected by the specified active ruleset, or release remains BLOCKED with exact admin/API evidence.
3. Existing M00–M05 checks remain green.
4. M06 regression/adversarial/recovery suite is green on exact candidate HEAD.
5. No unresolved HIGH/CRITICAL security/dependency finding.
6. Four current MODERATE advisories are fixed or explicitly dispositioned with evidence.
7. Secret/client-bundle scans pass.
8. Environment/config execution defaults fail closed.
9. MAINNET execution remains disabled unless separately admitted.
10. Live Perpl effects remain blocked unless independently proven and admitted.
11. Recovery drill passes and is documented.
12. Production build and deterministic performance evidence meet existing budgets or deviations are explicitly justified.
13. Reproducible deployment is tied to exact Git SHA and health checks pass.
14. README/operator/deployment/recovery docs match the deployed artifact.
15. 90-second demo works from a clean deployed session.
16. Official/current Metropolis deadline/track/submission fields are reverified and captured.
17. Selected sponsor bounty eligibility is objectively verified before being claimed.
18. Submission package contains only shipped/proven capabilities.
19. Evidence Bundle maps every applicable V0.1 DoD item to proof.
20. Exact-head Linux, Windows bounded, GEF 1.1.2, Source Pack, Context Lock, SonarCloud and Socket checks pass.
21. PR remains unmerged and Checkpoint unpromoted until independent audit.
22. Final executor stop marker is exactly `NERVA_V0_1_METROPOLIS_RELEASE_READY_FOR_AUDIT`.

## TESTS / PROOF OBLIGATIONS

At minimum:
- context/source-pack/GEF validators;
- format/lint/typecheck/build;
- full Vitest;
- bounded Windows;
- Playwright critical route/demo/accessibility;
- M03/M04 safety validators;
- DEMO_ONLY isolation;
- workspace/dependency boundaries;
- dependency audit HIGH + MODERATE disposition report;
- clean migration + accepted upgrade;
- DB integrity/replay/revocation/concurrency;
- safe-mode boot;
- client bundle secret scan;
- deployment health;
- recovery drill;
- ruleset GET-after-write evidence;
- portal/eligibility evidence;
- release DoD matrix.

## DELIVERABLES

- repository ruleset evidence/config receipt;
- `.engineering/evidence/NERVA-WO-007-EVIDENCE.md`;
- `.engineering/checkpoint-deltas/NERVA-WO-007-PROPOSED.md`;
- release/deployment/recovery docs;
- current README;
- deployment receipt;
- Metropolis submission package/checklist;
- any narrowly necessary release-hardening code/tests/config;
- final pt-BR execution report.

## REVIEW FORMAT

Report:
- exact base/head SHA;
- ruleset ID/config/evidence;
- files changed;
- tests/checks with counts;
- security/dependency dispositions;
- deployment URL/environment/SHA and health proof;
- recovery drill;
- portal deadline/track/bounty evidence;
- DoD matrix status;
- risks/limitations;
- proposed Checkpoint Delta;
- explicit statement that PR is unmerged and M06 Checkpoint is not promoted.

## STOP CONDITION

Stop only at:

`NERVA_V0_1_METROPOLIS_RELEASE_READY_FOR_AUDIT`

or an explicit `BLOCKED_<REASON>` if an external/admin/submission gate cannot be satisfied.

Do not merge or promote the final Checkpoint.
