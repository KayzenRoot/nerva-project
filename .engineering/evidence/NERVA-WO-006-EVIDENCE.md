# NERVA-WO-006 Evidence Bundle

Status: APPROVED · MERGED · POST_MERGE_VALIDATED

- Work Order: NERVA-WO-006
- Issue: #15 · PR: #16
- Module: M05 · Risk: HIGH_ASSURANCE
- Execution base: `5243c2808f258996c11e5e2fa9dffa5af96041cd`
- Admission head: `7e7dd5c4173784161ab9303e81c256ce186b673f`
- Implementation code head before CD-001: `322a8b6c83d9796d29c7b6ff47cfe0aadcd1458f`
- Correction code head: `15025740199d2acd2145ff9af4d668164f678578`
- Execution branch: `feat/nerva-wo-006-m05-product-demo`
- Context Lock: `LOCKED` · 89/89 fingerprints matched at exact base before implementation; the validator rechecks all base blobs on candidate HEAD.
- Independently audited final head: `bd0190a744befa413fac15f4f276d28b846a348e`
- Audit verdict: `APPROVED` · review ID `5405457556`.
- Accepted PR #16 squash merge: `d4c34f5f57d730f42570f6a9db19dc54d72e93cb`.

## M05 implementation record

M05 is independently APPROVED and merged. The audited Checkpoint Delta is effective canonical history on `main`. The Context Lock remains immutable. M06 is `NOT_ADMITTED` and has not started. No database schema or provider/effect adapter has been added.

- Visual product shell, live read-only state header and isolated `/demo` view are implemented.
- DEMO_ONLY fixtures are immutable, versioned `nerva-m05-demo-v1` values held only in page memory.
- Guided Protection Story uses seven explicit contract windows from 0–90 seconds; exact boundaries and reset replay are asserted by Playwright.
- Stale, revoked grant, changed delegation and degraded provider scenarios refuse without proposing action.
- Synthetic outcome and local trace are labeled and cannot call APIs, providers, wallets or persistence.
- M03 policy templates use the existing compile endpoint, which reports `COMPILED_UNCONFIRMED` / `VALIDATION_ONLY`; there is no confirmation or persistence path in the M05 UI.
- The M05 admission validator keeps checking all 89 blobs against the immutable execution base and permits only a reviewed M05 file list.
- Checkpoint Delta: `.engineering/checkpoint-deltas/NERVA-WO-006-PROPOSED.md` was independently accepted and became effective on PR #16 merge.

## SonarCloud and accessibility correction delta

The first M05 candidate failed the SonarCloud quality gate on duplicated localization blocks, two identical-label branches and an unpinned `npx` browser install. The correction moved English, Brazilian Portuguese and Spanish interface copy into `apps/web/src/app/product-copy.json`, simplified locale consumers, used the pinned local Playwright executable in CI, and reduced dashboard/demo complexity. A follow-up audit then led to native read-only JSON presentation, semantic output announcements, explicit locale labels and extracted browser assertions. The final code candidate reports 2.0% duplicated lines, A reliability/security ratings, zero bugs and zero vulnerabilities in SonarCloud.

Correction files: `.github/scripts/validate-m05-admission.mjs`, `.github/scripts/verify-m05-demo-boundary.mjs`, `.github/workflows/m01-ci.yml`, `playwright.config.ts`, `apps/web/e2e/m05-demo.pw.ts`, `apps/web/src/app/product-copy.json`, the home/dashboard/demo copy modules, `apps/web/src/app/dashboard/page.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/demo/demo-model.ts`, `apps/web/src/app/demo/demo-view.tsx`, `apps/web/src/app/experience-header.tsx`, `apps/web/src/app/localization.test.ts`, `apps/web/src/app/m05.css`, `apps/web/src/app/policies/policy-workbench.tsx`, and refreshed desktop/mobile browser artifacts. No product dependency was added in the correction delta.

## Dependency and browser preflight

- `@playwright/test@1.63.0` was exact-pinned after review of Playwright installation, browser and CI guidance. Registry integrity: `sha512-oxMK4vllB9RK5NQ2l1pq1IfOf2AvnEuj/vYGDj0H2nMtmtZpKtCwt/l00GEO6xjGfpBNAvjovvYdCm50dRQkpQ==`.
- `@axe-core/playwright@4.13.0` was exact-pinned after review of the Playwright accessibility guide and Deque package documentation. Registry integrity: `sha512-6YLx+kxXu5GJceG4ozFg+33a2EMTdjYwWGloJ3sb9Kta5pp+ZNS53uxGVog5JetIY8s++P5UrtX+cri+u0VAVg==`.
- Browser coverage is Chromium only, one worker, no wallet/provider secrets, no third-party analytics and no Playwright service in production.

## Proof results

| Area                                          | Result                  | Evidence                                                                                                                                                                                     |
| --------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEMO_ONLY isolation                           | PASS                    | Static boundary validator and source-level test; no API, provider, wallet or persistence access in demo code.                                                                                |
| Guided demo                                   | PASS                    | Playwright asserts seven deterministic windows at 0–10–25–40–55–70–82–90 seconds, synthetic account/position, bounded policy details, truthful blocked outcome and Flight Recorder closeout. |
| Reset/replay                                  | PASS                    | Reset returns the initial fixture; repeated guided trace is byte-equivalent.                                                                                                                 |
| Safety refusals                               | PASS                    | Stale feed, revoked permission, changed delegate and degraded provider each show `REFUSED` / `NO ACTION`.                                                                                    |
| Policy                                        | PASS                    | Both structured examples remain bounded to admitted M03 action types; existing compiler returns `VALIDATION_ONLY`; free text remains local/untrusted.                                        |
| Viewports                                     | PASS                    | Desktop 1440×900 and mobile 390×844; E2E checks actual primary-nav link visibility, bounds and click behavior; refreshed screenshots are stored below.                                       |
| Accessibility                                 | PASS                    | Axe WCAG 2.1 A/AA scan on home, demo, dashboard, policy, permissions and Flight Recorder; keyboard skip/focus and reduced-motion smoke.                                                      |
| Localization                                  | PASS                    | English default plus pt-BR and Spanish critical copy demonstrated in browser.                                                                                                                |
| Console                                       | PASS                    | No console errors or page exceptions in guided run or scanned critical routes.                                                                                                               |
| Unit/regression suite                         | PASS                    | 30 files, 136 tests. M01–M04 regression tests included, with focused Flight Recorder lineage assertions.                                                                                     |
| Browser E2E                                   | PASS                    | Chromium: 5/5 journeys passed, including contract clock boundaries, reset/replay, four refusals, policy validation, mobile nav clicks, language switch, and six-route axe scan.              |
| Windows bounded suite                         | PASS                    | 94 tests across 11 bounded Windows regression files.                                                                                                                                         |
| Migration/schema                              | PASS                    | No M05 migration. Disposable clean migration and M02→M04 upgrade/replay/revocation smoke passed; schema has 34 tables and 28 integrity triggers.                                             |
| Build                                         | PASS                    | Next.js 16.3.8 production build and worker TypeScript build completed.                                                                                                                       |
| Bundle/privacy                                | PASS                    | `security:client-bundle`: 15 client assets scanned; no server secret material or env values found.                                                                                           |
| Performance                                   | PASS                    | Local standalone production build, three isolated Chromium contexts: 6 JS resources / 146,739 encoded bytes (<250 KiB); no console/page errors.                                              |
| GEF / Context Lock / Source Pack              | PASS                    | GEF 1.1.2 package+state, 89 fingerprints and 45-file Source Pack passed on correction code HEAD `15025740199d2acd2145ff9af4d668164f678578`.                                                  |
| Linux / Windows bounded / SonarCloud / Socket | PASS ON CORRECTION HEAD | Exact correction code HEAD `15025740199d2acd2145ff9af4d668164f678578`; exact hosted-check results are recorded in CD-001 below.                                                              |
| Dependency security                           | PASS WITH CARRY-FORWARD | `npm audit --audit-level=high`: no HIGH/CRITICAL; four existing MODERATE advisories remain.                                                                                                  |

### Browser artifacts

- Desktop 1440×900: `.engineering/evidence/NERVA-WO-006-artifacts/guided-demo-desktop.png`
- Mobile 390×844: `.engineering/evidence/NERVA-WO-006-artifacts/guided-demo-mobile.png`
- Browser test: `apps/web/e2e/m05-demo.pw.ts`

### Production browser and bundle methodology

Next.js 16.3.8 was built with the preserved `output: standalone` setting. Its standalone server ran locally on `127.0.0.1:3120`; headless Chromium opened `/demo?lang=en` at 1440×900 in three fresh browser contexts and recorded `PerformanceNavigationTiming`, first contentful paint, JavaScript `encodedBodySize`, console errors and page exceptions. Samples: DOM interactive 494/153/143 ms, first contentful paint 468/168/172 ms, load 494/201/200 ms; 6 JavaScript resources and 146,739 encoded bytes on each run (about 143 KiB, below the 250 KiB first-load budget). These local Windows samples are not a hosted latency guarantee. No large image/video asset is bundled.

The in-memory deterministic benchmark checks also passed: risk 1,000 iterations p95 4.744 ms (100 ms target); M03 evaluation p95 1.939 ms and decision-to-ready-plan p95 6.957 ms; M04 compiler 100 samples p95 2.199 ms and 500 evidence appends p95 1.425 ms. These are fixed synthetic local measurements, not provider or financial execution claims.

## Safety claims and limitations

- `MAINNET EFFECT = HARD_BLOCKED` and `LIVE PERPL WRITES = BLOCKED` remain unchanged.
- No transaction, wallet approval, provider confirmation or real-world result is fabricated.
- All scenario positions, risk states, permission states and evidence labels are synthetic. The demo trace is not cryptographically verified or added to persisted Flight Recorder evidence.
- Unknown, stale, inconsistent and unproven values remain non-authoritative. Liquidation distance, maintenance margin and funding direction remain unavailable/unproven.
- No migration is expected because demo state is never persisted.
- Four existing MODERATE dependency advisories remain carry-forward for release review; no new HIGH/CRITICAL finding is accepted.

## Final closeout

No M05 migration was added: DEMO_ONLY state is in-memory only, and policy compilation remains validation-only. Clean database migration smoke and M03→M04 upgrade smoke both passed against a temporary PostgreSQL container with no persistent volume. M03/M04 safety validators, database integrity checks, dependency boundaries, application boot smoke, format, lint, typecheck, all 136 unit tests, all 5 browser journeys, production build, client-bundle scan, and browser/performance gates passed locally. Exact hosted checks for correction code and evidence closeout HEADs are recorded below.

The four MODERATE dependency carry-forwards remain recorded for release review; this work introduced no accepted HIGH or CRITICAL dependency finding. PR #16 is merged and the promoted M05 Checkpoint is canonical. M06 remains `NOT_ADMITTED` and unstarted.

## Correction Delta CD-001

- Correction base: `322a8b6c83d9796d29c7b6ff47cfe0aadcd1458f`.
- Correction code HEAD: `15025740199d2acd2145ff9af4d668164f678578`.
- Scope: close only the three MEDIUM audit findings M05-RESP-001/AC27, Guided Demo Contract/AC9–10, and M05-FR-001/AC21.
- Files: `.engineering/checkpoint-deltas/NERVA-WO-006-PROPOSED.md`, refreshed desktop/mobile guided-demo screenshots, `.github/scripts/validate-m05-admission.mjs`, `apps/web/e2e/m05-demo.pw.ts`, `apps/web/src/app/demo/demo-model.ts`, `apps/web/src/app/demo/demo-model.test.ts`, `apps/web/src/app/demo/demo-view.tsx`, new `apps/web/src/app/flight-recorder-lineage.ts`, `apps/web/src/app/localization.test.ts`, new `apps/web/src/app/m03-readonly-view.test.ts`, `apps/web/src/app/m03-readonly-view.tsx`, `apps/web/src/app/m05.css`, `apps/web/src/app/product-copy.json`, and `docs/NERVA-M05-DEMO-RUNBOOK.md`.
- Finding 1 closed: mobile primary navigation wraps within the viewport. Playwright measures real primary-nav links' visibility and bounding boxes at 390×844, verifies link clicks, and refreshes the mobile screenshot; desktop remains covered at 1440×900.
- Finding 2 closed: the story follows explicit windows 0–10, 10–25, 25–40, 40–55, 55–70, 70–82 and 82–90 seconds. Browser tests assert boundary transitions, synthetic account/position, bounded policy constraints, explicit non-authoritative confirmation representation, blocked simulated outcome, Flight Recorder lineage and closing sentence. Reset/replay remains deterministic.
- Finding 3 closed: the Flight Recorder read view presents policy-version ID/hash and available trigger/evaluation ID, snapshot, result/reason, correlation and time lineage. Two focused read-model tests cover the lineage fields and UNKNOWN state.
- Local exact-code validation: format, lint, strict typecheck, build, full Vitest 30 files/136 tests, Playwright 5/5, Windows bounded 11 files/94 tests, demo-isolation and M03/M04 safety validators, workspace/dependency-boundary checks, database integrity + clean migration + M02→M04 upgrade/revocation-concurrency smoke, safe-mode boot, client-bundle scan and `npm audit --audit-level=high` passed. Dependency audit reports no HIGH/CRITICAL and four existing MODERATE carry-forwards.
- Context/governance: Context Lock remains locked at the canonical base with 89/89 fingerprints. Context validation, Source Pack and GEF 1.1.2 package/state passed on the audited/promotion heads. No migration or dependency was added. The Checkpoint Delta was promoted only after independent APPROVED audit.
- Hosted checks on correction code HEAD `15025740199d2acd2145ff9af4d668164f678578`: Linux and Windows bounded PASS ([workflow run](https://github.com/KayzenRoot/nerva-project/actions/runs/37174782355)); Source Pack PASS ([run](https://github.com/KayzenRoot/nerva-project/actions/runs/37174782366)); GEF 1.1.2 PASS ([run](https://github.com/KayzenRoot/nerva-project/actions/runs/37174782359)); SonarCloud PASS ([analysis](https://sonarcloud.io/dashboard?id=KayzenRoot_nerva-project&pullRequest=16)); Socket PR Alerts and Project Report PASS ([PR alerts](https://socket.dev), [project report](https://socket.dev/dashboard/org/nexlabs/sbom/6289a6bf-96c9-49cd-ae77-c78c207936d7)). CodeRabbit reports review skipped because the PR remains draft; it is not an approval.
- This Evidence Bundle closeout is a documentation-only commit; all CI and hosted security checks are rerun against its exact pushed HEAD before stopping.
- Remaining risk: four existing MODERATE dependency advisories remain for release review; performance is a local Windows sample, not a hosted latency guarantee. No actual wallet/provider effect is exercised. M06 remains `NOT_ADMITTED`; no M06 work has started.


## Independent audit approval and Checkpoint promotion

- Exact audited head: `bd0190a744befa413fac15f4f276d28b846a348e`.
- Verdict: `APPROVED`.
- Audit review ID: `5405457556`.
- The previous three MEDIUM findings were closed: mobile navigation/AC27, canonical 90-second Guided Demo Contract/AC9–10, and persisted Flight Recorder lineage/M05-FR-001/AC21.
- Promotion scope after the audited head is governance-only: canonical Checkpoint, Backlog, this Evidence Bundle, the accepted Checkpoint Delta and validators required to recognize the promoted M05 state.
- M05 promotion preserves `MAINNET EFFECT = HARD_BLOCKED`, `LIVE PERPL WRITES = BLOCKED`, 0 known CRITICAL/HIGH defects and the four existing MODERATE dependency carry-forwards.
- M06 is only the next module and remains `NOT_ADMITTED`; no M06 implementation is authorized by this promotion.

- Preserved executor STOP CONDITION: `NERVA_M05_PRODUCT_DEMO_READY_FOR_AUDIT`.


## Post-merge Correction Delta CD-002

- Accepted M05 squash merge: `d4c34f5f57d730f42570f6a9db19dc54d72e93cb`.
- Post-merge Source Pack run `37195493665`: PASS.
- Post-merge GEF 1.1.2 run `37195493706`: PASS.
- Initial post-merge M01–M05 run `37195493764`: Linux failed during context validation only; the M05 validator had already reported `NERVA_M05_POST_MERGE_CONTEXT_LOCK_HISTORICAL`.
- Root cause: the historical M04 validator treated every later push to `main` as though it were the original M04 squash-merge event, then incorrectly required the current HEAD parent to equal the old M03 baseline.
- Correction: restrict the special M04 promotion-push path to the direct M04 promotion shape; later descendants fall through to the already-defined historical Context Lock path.
- Scope is governance-validator + evidence only. No product/runtime code, database schema, dependency, provider adapter or authority is changed.
- `MAINNET EFFECT = HARD_BLOCKED` and `LIVE PERPL WRITES = BLOCKED` remain unchanged.
- M06 remains `NOT_ADMITTED` and unstarted.


## Canonical truth closeout

- Final post-merge validation head before this documentation-only truth sync: `2f314582f54f3a4f1425b10b923fb77695f9cc52`.
- M01–M05 validation run `37195788203`: PASS.
- GEF 1.1.2 run `37195788213`: PASS.
- Source Pack run `37195788263`: PASS.
- SonarCloud and Socket Project Report: PASS.
- Canonical Checkpoint, Checkpoint JSON, Source Hierarchy and accepted Checkpoint Delta were synchronized after audit found stale pre-merge/current-binding language.
- This closeout changes governance/documentation truth only. It does not alter product/runtime code, database schema, dependencies, provider adapters, signing authority or M06 admission.
- M06 remains `NOT_ADMITTED`.
