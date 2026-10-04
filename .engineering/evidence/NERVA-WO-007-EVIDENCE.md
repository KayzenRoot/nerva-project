# NERVA-WO-007 Evidence Bundle

Status: BLOCKED_PUBLIC_DEPLOYMENT_AND_METROPOLIS_OAUTH_OWNER_APPROVAL

- Work Order: NERVA-WO-007
- Issue: #19
- Module: M06
- Risk: HIGH_ASSURANCE
- Execution base: `b778b470eff4ff997def001899530512065e5676`
- Execution branch: `feat/nerva-wo-007-m06-release-hardening`
- Context Lock: LOCKED · 98/98 exact baseline fingerprints prepared
- Primary executor: Codex
- Canonical predecessor: NERVA-WO-006 / M05 APPROVED · MERGED · POST-MERGE VALIDATED
- M06 implementation: NOT_STARTED at admission package creation
- Checkpoint promotion: NOT_APPLIED
- MAINNET EFFECT: HARD_BLOCKED
- LIVE PERPL WRITES: BLOCKED
- Known HIGH/CRITICAL at admission: 0
- Existing MODERATE dependency advisories: 4 carry-forward

## Admission source check

- `main` baseline is `b778b470eff4ff997def001899530512065e5676`.
- Before the first executor task, `GET /repos/KayzenRoot/nerva-project/rulesets` returned `[]`; the ruleset was absent at that time.
- Therefore repository ruleset hardening is admitted as the first executor task.
- Public Metropolis material observed 2026-10-04 continues to indicate an October 2026 submission window, but current public sources conflict on the exact cutoff date/time. The authenticated/current official portal is required before submission truth is frozen.
- MetaMask Agent Wallet current material continues to describe self-custodial agent execution with user-defined constraints; chain-specific Transaction Shield coverage must not be inferred for Monad.

## Evidence to append during execution

- ruleset before/after JSON + ID;
- exact implementation head;
- changed files;
- full tests/checks;
- dependency advisory dispositions;
- release security review;
- deployment receipt/health;
- rollback/roll-forward drill;
- portal/track/bounty evidence;
- submission package;
- final DoD matrix;
- limitations and blockers.

## First executor task — repository ruleset verified

- Pre-write list GET on 2026-10-04 returned `[]`; no existing or unrelated repository ruleset was overwritten.
- Applied the exact versioned payload `.engineering/repository-rulesets/nerva-main-gef-protected-flow.json` using `gh api --method POST` with API version `2026-03-10`.
- POST result: HTTP `201 Created`; GitHub assigned ruleset ID `24457588`.
- GET-after-write: `GET /repos/KayzenRoot/nerva-project/rulesets/24457588`, received 2026-10-04 at 11:21:55 -03:00. Programmatic assertions all passed: `enforcement=active`; target exactly `refs/heads/main`; PR required; approving reviews `0`; review threads resolved; allowed merge method only `squash`; linear history required; force-push blocked by `non_fast_forward`; deletion blocked; strict checks enabled with exactly the seven Work Order contexts; no bypass actors and `current_user_can_bypass=never`.
- Required status checks verified: `linux`, `windows-bounded`, `gef-validation`, `source-pack`, `SonarCloud Code Analysis`, `Socket Security: Pull Request Alerts`, and `Socket Security: Project Report`.
- GitHub materialized `require_extra_approval_for_unattributed_changes=true` in the returned PR-rule parameters, although this field is absent from the versioned request. GitHub documents that this option has no effect when the configured approval count is zero ([available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)). The requested zero-approval policy remains effective.
- GET response JSON (complete final representation):

```json
{"id":24457588,"name":"NERVA main / GEF protected flow","target":"branch","source_type":"Repository","source":"KayzenRoot/nerva-project","enforcement":"active","conditions":{"ref_name":{"exclude":[],"include":["refs/heads/main"]}},"rules":[{"type":"deletion"},{"type":"non_fast_forward"},{"type":"required_linear_history"},{"type":"pull_request","parameters":{"required_approving_review_count":0,"dismiss_stale_reviews_on_push":false,"required_reviewers":[],"require_code_owner_review":false,"require_last_push_approval":false,"required_review_thread_resolution":true,"require_extra_approval_for_unattributed_changes":true,"allowed_merge_methods":["squash"]}},{"type":"required_status_checks","parameters":{"strict_required_status_checks_policy":true,"do_not_enforce_on_create":false,"required_status_checks":[{"context":"linux"},{"context":"windows-bounded"},{"context":"gef-validation"},{"context":"source-pack"},{"context":"SonarCloud Code Analysis"},{"context":"Socket Security: Pull Request Alerts"},{"context":"Socket Security: Project Report"}]}}],"node_id":"RRS_lACqUmVwb3NpdG9yec5Ti3gtzgF1MXQ","created_at":"2026-10-04T11:21:55.524-03:00","updated_at":"2026-10-04T11:21:55.601-03:00","bypass_actors":[],"current_user_can_bypass":"never","_links":{"self":{"href":"https://api.github.com/repos/KayzenRoot/nerva-project/rulesets/24457588"},"html":{"href":"https://github.com/KayzenRoot/nerva-project/rules/24457588"}}
```

- First-gate implementation HEAD before this evidence closeout: `01d26b9f0039d46b177fd2a682d2e56de3aab174`; only this Evidence Bundle and the admin runbook are being updated for the gate receipt.
- This completes the first executor gate only. M06 heavy implementation and later release/submission tasks remain NOT_STARTED; do not claim release readiness.

## Ruleset application package

- Exact ruleset payload artifact: `.engineering/repository-rulesets/nerva-main-gef-protected-flow.json`.
- Admin application/verification guide: `docs/NERVA-M06-RULESET-ADMIN.md`.
- Required policy is frozen to the Work Order target and current required check names.
- Ruleset `24457588` is verified active by the GET-after-write evidence above.

## Gates 2–10 closeout evidence — 2026-10-04

**Current result:** `BLOCKED_PUBLIC_DEPLOYMENT_AND_METROPOLIS_OAUTH_OWNER_APPROVAL`.
The local/repository M06 work is complete for audit. The public deployment and authenticated Metropolis portal gates remain blocked by external access/owner action. This is not a V0.1 release-ready claim.

- Canonical base: `main@b778b470eff4ff997def001899530512065e5676` (rechecked from `origin/main`).
- Product/code candidate and local deployment SHA: `fd89a2c68f0116d2fe4344e47a796cfc88f2e5ef`.
- Branch: `feat/nerva-wo-007-m06-release-hardening`.
- PR #20: `OPEN`, `DRAFT`, base `main`; no merge and no Checkpoint promotion.
- Current Gate 1 ruleset GET (ID `24457588`) again reports active `refs/heads/main`, PR required, 0 approvals, review-thread resolution, squash-only, linear history, no force-push, no deletion, no bypass actors, and exactly the seven required checks listed above.
- Repository visibility is `PUBLIC`: <https://github.com/KayzenRoot/nerva-project>.

### Gate matrix

| Gate                     | State                                   | Objective evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Ruleset               | APPROVED, historical gate               | Owner audit approved Gate 1 on `de4eebb9ae2c6f856a47797b1493f8e5f9e2ccaa`. The fresh GET above confirms the approved ruleset remains active. Gate 1 evidence and JSON receipt are retained unchanged below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2. Admission/Source Pack | PASS                                    | `npm run context:validate`: M06 base + 98/98 fingerprints; historical M05 89 and M04 64 fingerprints pass. `npm run sourcepack:validate`: 56 required files, 7 modules, M05 approved, M06 implementation started. `npm run gef:verify` and `npm run gef:package:verify`: `@gef-bootstrap/cli@1.1.2`, locked integrity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 3. Security/dependencies | PASS with MODERATE carry-forward        | `npm run security:audit`: 0 HIGH/CRITICAL, 4 MODERATE in `drizzle-kit` / legacy `@esbuild-kit` / esbuild. The only suggested automatic remediation downgrades `drizzle-kit` to breaking `0.18.1`; no compatible safe fix was selected. The standalone runtime inspection found no `drizzle-kit`, `esbuild`, or `@esbuild-kit` modules. Production CSP has a per-request nonce and no `unsafe-inline`/`unsafe-eval`; production E2E verifies response headers, nonce rotation, nonce-bound scripts, read-only health, and zero console errors. The client-bundle scan passed for 15 files with 0 environment values. The staged source/path scan found no credential file paths or private-key/token patterns. DB verification found 0 credential-shaped columns; M03 safety verification reports no key custody. No dependency was added for browser testing; existing `@playwright/test@1.63.0` remains pinned by the lockfile. |
| 4. Regression/recovery   | PASS locally                            | Full Vitest: 31 files / 139 tests passed. Production Playwright on the exact candidate container: 6/6, covering the 90-second deterministic demo/reset, stale/revoked/delegate/provider refusal, EN/PT-BR/ES, mobile/keyboard/accessibility, production CSP/security, and no console errors. Clean migration: 34 tables, 28 M03/M04 integrity triggers, 0 credential columns, 0 non-M03 write-path tables. M02→M04 upgrade proof: concurrent revoke/replay, session revocation, expiry/scope limits, wallet/delegate/grant invalidation all passed. `npm run smoke:boot`: web liveness + fail-closed readiness and worker observation mode passed. Recovery drill below passed on the exact candidate image.                                                                                                                                                                                                                     |
| 5. Performance/build     | PASS locally                            | Final `npm run build` passed (web + worker). Risk p95 `0.238 ms / 100 ms`; M03 evaluation `0.235 ms / 50 ms`, decision-to-ready-plan `0.699 ms / 250 ms`; M04 permission compiler `0.127 ms`, evidence append `0.155 ms` for 500 receipts. Static browser assets: 14 JS files / 658,916 bytes and 1 CSS / 23,068 bytes. Local release cold restart→liveness `3,084.4 ms`; warm home-route p95 `46.8 ms`, median `18.3 ms` across 25 requests. These are local deterministic/synthetic/loopback measurements, not network/provider guarantees.                                                                                                                                                                                                                                                                                                                                                                                    |
| 6. Public deployment     | BLOCKED_PUBLIC_DEPLOYMENT_CREDENTIALS   | A production-like local deployment was built from exact SHA `fd89a2c68f0116d2fe4344e47a796cfc88f2e5ef` using pinned image index digest `sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c`; image ID `sha256:c3279c1fbd76b4a857cdbbc41baba8456247052027ceffd8c10421329a47bfc5`. Loopback-only web/DB ports were `3138/5438`; image label `org.opencontainers.image.revision` matches the SHA. `/api/health/live`: `TESTNET_DEMO`, `executionEnabled=false`; `/api/health/ready`: database `HEALTHY`, `globalExecutionDisabled=true`; labels say `MAINNET=HARD_BLOCKED`, live Perpl `BLOCKED`. This is not a public deployment or registry-published receipt. GitHub environments, deployments, and repository Action-secret names all returned `[]`; no deployment-provider CLI or deploy-token environment variable was configured. No public HTTPS URL or runtime secret store is available.             |
| 7. README/runbook        | PASS                                    | README reflects M00–M05 approved, M06 draft/unmerged, safety gates, test commands and local-only deployment status. `docs/NERVA-M06-RELEASE-RUNBOOK.md` documents exact-SHA local Compose, health, runtime secret injection, recovery and external gates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 8. Metropolis portal     | BLOCKED_METROPOLIS_OAUTH_OWNER_APPROVAL | Official portal <https://hackathon.monad.xyz/> requires authentication. Choosing GitHub reached an OAuth authorization page for `monad-developers` / Metropolis, requesting read-only profile and email access (`read:user`, `user:email`) to account `KayzenRoot`, then redirecting to the portal. Authorization was not granted. Without the owner-approved OAuth grant, the authenticated submission form, exact deadline/timezone, fields, track and bounty eligibility cannot be verified. Public deadline listings conflict; none is treated as authoritative.                                                                                                                                                                                                                                                                                                                                                             |
| 9. Submission package    | PREPARED, NOT SUBMITTED                 | `.engineering/submissions/NERVA-METROPOLIS-V0.1-DRAFT.md` contains only shipped/proven claims, marks the track as a candidate, claims no sponsor bounty, and records the missing public URL/portal proof. Production-candidate desktop/mobile screenshots are under `.engineering/evidence/NERVA-WO-007-artifacts-production-final/`; they are local TESTNET_DEMO proof, not a public deployment. No submission was sent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 10. V0.1 DoD             | BLOCKED_BY_GATES_6_8_9                  | The evidence map covers repository governance, exact base/code SHA, exact-head checks, security, local build/health, recovery and the truthful submission draft. Public deployment, authenticated portal revalidation, and final submission evidence remain unavailable; independent final audit and release readiness are not claimed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Earlier first-candidate production screenshots on `3505f1621ee292e6258f8fcd6e30b1116906e35d` are retained under `.engineering/evidence/NERVA-WO-007-artifacts-production/` as superseded intermediate evidence. The final-candidate evidence remains only in `artifacts-production-final/`.

The dedicated local deployment receipt is `.engineering/evidence/NERVA-WO-007-LOCAL-DEPLOYMENT-RECEIPT.json`; it records the exact image/configuration/health, explicitly marks `registryPush=NOT_PERFORMED`, and distinguishes the local image digest from a public deployment.

### Exact candidate hosted checks

On code candidate `fd89a2c68f0116d2fe4344e47a796cfc88f2e5ef`, all seven ruleset-required contexts completed successfully:

- `linux`, `windows-bounded`: <https://github.com/KayzenRoot/nerva-project/actions/runs/37214219668>
- `gef-validation`: <https://github.com/KayzenRoot/nerva-project/actions/runs/37214219664>
- `source-pack`: <https://github.com/KayzenRoot/nerva-project/actions/runs/37214219656>
- `SonarCloud Code Analysis`: <https://sonarcloud.io/dashboard?id=KayzenRoot_nerva-project&pullRequest=20>
- `Socket Security: Pull Request Alerts`: <https://socket.dev>
- `Socket Security: Project Report`: <https://socket.dev/dashboard/org/nexlabs/sbom/6320e232-53b9-4a18-ab6f-3aadb8675102>

The Evidence Bundle / proposed Delta update was then committed as documentation-only HEAD `d20a422ec382ada9d01c04a554a4ca1d005e1db1`. All seven required checks passed again on that exact PR head (linux + windows-bounded: <https://github.com/KayzenRoot/nerva-project/actions/runs/37215677855>; gef-validation: <https://github.com/KayzenRoot/nerva-project/actions/runs/37215677856>; source-pack: <https://github.com/KayzenRoot/nerva-project/actions/runs/37215677850>; SonarCloud: <https://sonarcloud.io/dashboard?id=KayzenRoot_nerva-project&pullRequest=20>; Socket Alerts: <https://socket.dev>; Socket Project Report: <https://socket.dev/dashboard/org/nexlabs/sbom/2ee64cf1-b6eb-4559-996d-c382c35b0ef7>). The tested product/image candidate remains `fd89a2c`; `d20a422` changes evidence and the proposed Delta only.

The first candidate analysis exposed one SonarCloud vulnerability, `docker:S6505`, plus six code-quality findings. `fd89a2c` fixed them by using the base-image digest without a tag, setting `npm ci --ignore-scripts`, avoiding repeated `Array#push`, making Next's `headers()` return a Promise directly, and using `String.raw` for Windows Git paths. SonarCloud passed on the corrected candidate. No lifecycle-script compatibility regression was observed: the corrected Docker image built successfully and all production journeys passed.

### Local TESTNET_DEMO recovery drill

On exact image/candidate `fd89a2c68f0116d2fe4344e47a796cfc88f2e5ef`, the disposable local DB received only one synthetic, non-financial policy marker. A PostgreSQL custom-format snapshot was restored into a new isolated database; marker count after restore was exactly `1`; forward migration and all schema/integrity checks passed; the same exact image reached `/api/health/ready = ready` against the restored database with execution disabled and the global kill switch on. The temporary restore DB/dump and recovery web container were removed. The procedure rehearsed data restore + migration-forward; it did not claim rollback of a public deployment or a financial effect.

### Residual security disposition and hard boundaries

- Four MODERATE transitive advisories remain a release-review carry-forward: <https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99>. Drizzle's package dependency and releases are documented at <https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-kit/package.json> and <https://github.com/drizzle-team/drizzle-orm/releases>. They are absent from the final standalone image, but remain in the developer install/audit graph and are not reported as fixed.
- `MAINNET EFFECT = HARD_BLOCKED`; `LIVE PERPL WRITES = BLOCKED`; no private key/seed/mnemonic custody; no new financial authority; no unproven risk metric authority; no submission or bounty claim.
- PR #20 remains `OPEN` and `DRAFT`; no merge; M06 Checkpoint not promoted.

## Stop marker

`BLOCKED_PUBLIC_DEPLOYMENT_AND_METROPOLIS_OAUTH_OWNER_APPROVAL`


## Public deployment target provisioning

- Vercel team: `team_OE3MNboVFDX58OGsMNGPLAnf`.
- Vercel project: `nerva-project` / `prj_jz7MxL3aphaRgB7kvhQCktiACgct`.
- Git repository linked: `KayzenRoot/nerva-project`.
- Root directory: `apps/web`.
- The initial Vercel bootstrap deployment tracks `main@b778b470eff4ff997def001899530512065e5676` and is **not** accepted as M06 deployment evidence.
- This evidence commit is intentionally pushed on `feat/nerva-wo-007-m06-release-hardening` after Git linkage to trigger a branch preview deployment of the actual M06 candidate. Acceptance requires the resulting deployment metadata to prove the branch/SHA and public health behavior.


## Vercel deployment correction history

- First Vercel branch preview attempt: deployment `dpl_9r1vQG9pv1Dgn1y9UbuYk3GY8EBg`, branch `feat/nerva-wo-007-m06-release-hardening`, commit `c005d39b6231a71d1e387394033e1a99daa217b6`.
- That attempt failed during Next TypeScript validation because Vercel installed only the workspace-local dependency graph from `apps/web`, leaving the root-pinned `@types/react` development dependency unavailable.
- Vercel project `prj_jz7MxL3aphaRgB7kvhQCktiACgct` was corrected to Node `22.x`, framework `nextjs`, root-workspace install command `cd ../.. && npm ci --ignore-scripts --no-audit --no-fund`, and `sourceFilesOutsideRootDirectory=true`.
- The failed deployment is retained as correction evidence and is not accepted as release proof.
- This commit triggers a new branch preview using the corrected project configuration.


## Public Vercel preview proof — deployment target now exists

- Vercel deployment `dpl_E1Znw4Jt7GurFJNaBe14TuBJ5df6` reached `READY` for branch commit `3203ca9672f0d0df8bfb5dfdfab1f66ba6a3c9cf`.
- Public HTTPS URL: `https://nerva-project-hu8ggjhfz-claytons-projects-5922d27c.vercel.app`.
- External GET `/`: HTTP 200 with production CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy and Permissions-Policy.
- External GET `/api/health/live`: HTTP 200, `executionEnabled=false`.
- External GET `/api/health/ready`: HTTP 503 because `DATABASE_URL` was not yet configured; `globalExecutionDisabled=true`.
- This first successful public preview is **not** the final Gate 6 proof because it was created before Vercel TESTNET_DEMO safety environment variables were attached and has no deployment database.
- Vercel project protection was disabled for the demo project so the preview is publicly reachable over HTTPS; no secret or financial authority was added.
- Vercel project environment now explicitly sets `NERVA_ENVIRONMENT=TESTNET_DEMO`, `NERVA_EXECUTION_ENABLED=false`, `NERVA_KILL_SWITCH_ENABLED=true`, `NERVA_DEMO_SIMULATION_ENABLED=true`, `PERPL_OBSERVATION_ENABLED=false`, and telemetry disabled for subsequent deployments.
- This evidence commit triggers a new preview with the explicit safety environment. Final Gate 6 acceptance still requires database-backed readiness HTTP 200.


## Supabase deployment database provisioned

- Supabase organization: `Goodz Labs` (`buruzdxxxrljzqrfawev`).
- Project: `nerva` / `gnujsdlpaznoaeijvmez`.
- Region: `sa-east-1`.
- Cost accepted by owner before provisioning: `US$0/month`.
- Project status after creation: `ACTIVE_HEALTHY`.
- Repository migrations `0000` through `0009` were applied sequentially through the Supabase migration API; all ten returned success.
- Resulting public schema contains 34 NERVA tables and the seeded `runtime_controls` row.

### Supabase security preflight blocker

The Supabase security advisor reports **RLS disabled on all 34 tables in the exposed `public` schema**. Supabase classifies this as an externally facing ERROR and warns that anon/authenticated Data API roles could access these tables if a publishable/anon key is used. Per the advisor contract, this remediation was **not auto-applied** because enabling RLS without an explicit policy decision changes access semantics.

The security advisor also reports six WARN findings for mutable function `search_path`.

No final deployment/database readiness or M06 approval may be claimed until the RLS exposure is explicitly dispositioned and the Vercel runtime database connection is established without weakening the fail-closed execution posture.
