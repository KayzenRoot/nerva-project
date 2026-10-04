# NERVA-WO-006 Evidence Bundle

Status: EXECUTION_IN_PROGRESS

- Work Order: NERVA-WO-006
- Issue: #15 · PR: #16
- Module: M05 · Risk: HIGH_ASSURANCE
- Execution base: `5243c2808f258996c11e5e2fa9dffa5af96041cd`
- Admission head: `7e7dd5c4173784161ab9303e81c256ce186b673f`
- Execution branch: `feat/nerva-wo-006-m05-product-demo`
- Context Lock: `LOCKED` · 89/89 fingerprints matched at exact base before implementation; the validator rechecks all base blobs on candidate HEAD.

## Current implementation record

The M05 implementation is in progress. The canonical Checkpoint and Context Lock have not been promoted or rewritten. No M06 work has started. No database schema or provider/effect adapter has been added.

- Visual product shell, live read-only state header and isolated `/demo` view are implemented.
- DEMO_ONLY fixtures are immutable, versioned `nerva-m05-demo-v1` values held only in page memory.
- Guided Protection Story has eight deterministic 12-second phases (84 seconds); reset replays the same state.
- Stale, revoked grant, changed delegation and degraded provider scenarios refuse without proposing action.
- Synthetic outcome and local trace are labeled and cannot call APIs, providers, wallets or persistence.
- M03 policy templates use the existing compile endpoint, which reports `COMPILED_UNCONFIRMED` / `VALIDATION_ONLY`; there is no confirmation or persistence path in the M05 UI.
- The M05 admission validator keeps checking all 89 blobs against the immutable execution base and permits only a reviewed M05 file list.

## Dependency and browser preflight

- `@playwright/test@1.63.0` was exact-pinned after review of Playwright installation, browser and CI guidance. Registry integrity: `sha512-oxMK4vllB9RK5NQ2l1pq1IfOf2AvnEuj/vYGDj0H2nMtmtZpKtCwt/l00GEO6xjGfpBNAvjovvYdCm50dRQkpQ==`.
- `@axe-core/playwright@4.13.0` was exact-pinned after review of the Playwright accessibility guide and Deque package documentation. Registry integrity: `sha512-6YLx+kxXu5GJceG4ozFg+33a2EMTdjYwWGloJ3sb9Kta5pp+ZNS53uxGVog5JetIY8s++P5UrtX+cri+u0VAVg==`.
- Browser coverage is Chromium only, one worker, no wallet/provider secrets, no third-party analytics and no Playwright service in production.

## Proof results

| Area                                          | Result                                   | Evidence                                                                                                                                                        |
| --------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEMO_ONLY isolation                           | PASS                                     | Static boundary validator and source-level test; no API, provider, wallet or persistence access in demo code.                                                   |
| Guided demo                                   | PASS                                     | Playwright clock advances all eight phases in 84 scripted seconds; `SIMULATED OUTCOME`, `DRY_RUN_ONLY`, no provider receipt/transaction.                        |
| Reset/replay                                  | PASS                                     | Reset returns the initial fixture; repeated guided trace is byte-equivalent.                                                                                    |
| Safety refusals                               | PASS                                     | Stale feed, revoked permission, changed delegate and degraded provider each show `REFUSED` / `NO ACTION`.                                                       |
| Policy                                        | PASS                                     | Both structured examples remain bounded to admitted M03 action types; existing compiler returns `VALIDATION_ONLY`; free text remains local/untrusted.           |
| Viewports                                     | PASS                                     | Automated 1440×900 and 390×844 overflow assertions; screenshots stored below.                                                                                   |
| Accessibility                                 | PASS                                     | Axe WCAG 2.1 A/AA scan on home, demo, dashboard, policy, permissions and Flight Recorder; keyboard skip/focus and reduced-motion smoke.                         |
| Localization                                  | PASS                                     | English default plus pt-BR and Spanish critical copy demonstrated in browser.                                                                                   |
| Console                                       | PASS                                     | No console errors or page exceptions in guided run or scanned critical routes.                                                                                  |
| Unit/regression suite                         | PASS                                     | 28 files, 133 tests. M01–M04 regression tests included.                                                                                                         |
| Browser E2E                                   | PASS                                     | Clean CI-mode Chromium run: 5/5 journeys passed, including story, reset/replay, four refusals, policy validation and six-route axe scan.                        |
| Windows bounded suite                         | PASS                                     | 94 tests across 11 bounded Windows regression files.                                                                                                            |
| Migration/schema                              | PASS                                     | No M05 migration. Disposable clean migration and M02→M04 upgrade/replay/revocation smoke passed; schema has 34 tables and 28 integrity triggers.                |
| Build                                         | PASS                                     | Next.js 16.3.8 production build and worker TypeScript build completed.                                                                                          |
| Bundle/privacy                                | PASS                                     | `security:client-bundle`: 15 client assets scanned; no server secret material or env values found.                                                              |
| Performance                                   | PASS                                     | Local standalone production build, three isolated Chromium contexts: 7 initial JS resources / 145,303 encoded bytes; guided route interactive and no JS errors. |
| GEF / Context Lock / Source Pack              | PASS ON PRE-PUSH CANDIDATE               | GEF 1.1.2 package+state validation, exact 89-fingerprint check and 45-file Source Pack passed on the reviewed local candidate.                                  |
| Linux / Windows bounded / SonarCloud / Socket | PASS ON PRIOR PR HEAD; FINAL SHA PENDING | Checks were green on admission HEAD before the M05 push; exact implementation SHA rerun is required.                                                            |
| Dependency security                           | PASS WITH CARRY-FORWARD                  | `npm audit --audit-level=high`: no HIGH/CRITICAL; four existing MODERATE advisories remain.                                                                     |

### Browser artifacts

- Desktop 1440×900: `.engineering/evidence/NERVA-WO-006-artifacts/guided-demo-desktop.png`
- Mobile 390×844: `.engineering/evidence/NERVA-WO-006-artifacts/guided-demo-mobile.png`
- Browser test: `apps/web/e2e/m05-demo.pw.ts`

### Production browser and bundle methodology

Next.js 16.3.8 was built with the preserved `output: standalone` setting. Its official standalone server ran locally on `127.0.0.1:3101`; headless Chromium opened `/demo?lang=en` at 1440×900 in three fresh browser contexts and recorded `PerformanceNavigationTiming`, first contentful paint, JavaScript `encodedBodySize`, console errors and page exceptions. The samples were: DOM interactive 631/39/32 ms, first contentful paint 648/184/168 ms, load 677/216/197 ms; 7 JavaScript resources and 145,303 encoded bytes on each run (about 142 KiB, below the 250 KiB first-load budget). The cold first navigation and two subsequent contexts are reported separately because this is a local Windows sample, not a hosted latency guarantee. No large image/video asset is bundled.

The in-memory deterministic benchmark checks also passed: risk 1,000 iterations p95 0.647 ms (100 ms target); M03 evaluation p95 0.683 ms and decision-to-ready-plan p95 2.429 ms; M04 compiler 100 samples p95 1.649 ms and 500 evidence appends p95 2.873 ms. These are fixed synthetic local measurements, not provider or financial execution claims.

## Safety claims and limitations

- `MAINNET EFFECT = HARD_BLOCKED` and `LIVE PERPL WRITES = BLOCKED` remain unchanged.
- No transaction, wallet approval, provider confirmation or real-world result is fabricated.
- All scenario positions, risk states, permission states and evidence labels are synthetic. The demo trace is not cryptographically verified or added to persisted Flight Recorder evidence.
- Unknown, stale, inconsistent and unproven values remain non-authoritative. Liquidation distance, maintenance margin and funding direction remain unavailable/unproven.
- No migration is expected because demo state is never persisted.
- Four existing MODERATE dependency advisories remain carry-forward for release review; no new HIGH/CRITICAL finding is accepted.

## Final closeout

No M05 migration was added: DEMO_ONLY state is in-memory only, and policy compilation remains validation-only. Clean database migration smoke and M03→M04 upgrade smoke both passed as regression checks. M03/M04 safety validators, disposable database integrity checks, dependency boundaries, application boot smoke, format, lint, typecheck, full unit suite, browser suite, production build, client-bundle scan and benchmark gates passed locally. Exact hosted results for the evidence-bearing pushed HEAD will be available in the PR check rollup and final execution report.

The four MODERATE dependency carry-forwards remain recorded for release review; this work introduced no accepted HIGH or CRITICAL dependency finding. The candidate must remain unmerged and in draft for audit. Canonical Checkpoint remains unchanged, and M06 is not admitted or started.
