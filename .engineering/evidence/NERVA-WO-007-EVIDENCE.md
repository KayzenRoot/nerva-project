# NERVA-WO-007 Evidence Bundle

Status: BLOCKED_METROPOLIS_AUTHENTICATED_PORTAL_EVIDENCE

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

## Owner-approved deny-by-default RLS

- Owner approval received: `APPROVE_DENY_BY_DEFAULT_RLS`.
- Supabase project `gnujsdlpaznoaeijvmez`: all 34 NERVA `public` tables now have RLS enabled.
- No permissive RLS policies were created.
- `anon` and `authenticated` have no table grants and no sequence usage grants in `public`.
- The six previously reported mutable-function-`search_path` WARN findings were removed by pinning each NERVA trigger/helper function to `public, pg_temp` after verifying its current definition.
- Post-change Supabase Security Advisor reports only INFO `rls_enabled_no_policy` findings. This is the intended deny-by-default state for M06 and no WARN/ERROR remains for RLS or function `search_path`.
- Hosted state is versioned in `packages/db/migrations/0010_nerva_release_security_hardening.sql` and registered in the Drizzle migration journal.

## Current external gate state

- Supabase RLS/security owner decision is CLOSED.
- Machine-readable Supabase security receipt: `.engineering/evidence/NERVA-WO-007-SUPABASE-SECURITY-RECEIPT.json`.
- Public Vercel deployment is reachable over HTTPS and `/api/health/live` is HTTP 200 in `TESTNET_DEMO` with execution disabled.
- `/api/health/ready` remains HTTP 503 only because `DATABASE_URL` cannot yet be transferred from the authenticated Supabase context into the Vercel secret environment through the currently exposed connector surface. No credential has been printed, copied into Git, or exposed to the browser.
- Owner authorization for Metropolis GitHub OAuth was received, but this non-browser connector session cannot complete the interactive OAuth/account step. Public official portal confirms the event window as `1 Sep to 13 Oct`; authenticated deadline time zone, submission fields, track and bounty eligibility remain portal-gated.
- M06 therefore remains draft/unmerged and the Checkpoint remains unpromoted.

## Vercel/Supabase credential-bridge compatibility

- NERVA server configuration now accepts `DATABASE_URL` first and Vercel-native `POSTGRES_URL` as a fallback.
- `DATABASE_URL` remains authoritative when both are present.
- Invalid non-PostgreSQL fallback URLs fail closed.
- `publicConfig` does not expose the database URL.
- This change permits the official Vercel/Supabase integration to provide the server-side connection through its native environment-variable contract without copying a database credential into Git or chat.
- The secure integration/install step itself remains external and must still be objectively verified before `/api/health/ready` can be accepted as healthy.

## Vercel Supabase integration observed

- Owner completed the interactive Vercel/Supabase connection.
- Verification was performed without decrypting or printing any secret value.
- Vercel project `prj_jz7MxL3aphaRgB7kvhQCktiACgct` now exposes the official Supabase integration environment contract to both Preview and Production.
- Required server-side connection key `POSTGRES_URL` is present as a sensitive environment variable.
- Related integration keys are also present, including `POSTGRES_URL_NON_POOLING`, `POSTGRES_PRISMA_URL`, `POSTGRES_HOST`, `POSTGRES_DATABASE`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `SUPABASE_URL`, and Supabase key material.
- NERVA consumes only `DATABASE_URL` or the `POSTGRES_URL` fallback for database connectivity; no Supabase service-role key is exposed through `publicConfig`.
- The integration was observed after the previous preview deployment had already been built, so this evidence-only commit intentionally triggers a fresh exact-head deployment before readiness is evaluated.

## Vercel/Supabase TLS compatibility correction

- First exact-head deployment after the official Supabase integration exposed `POSTGRES_URL` reached the database health probe but returned `UNKNOWN`.
- A bounded temporary diagnostic reported only the driver code `SELF_SIGNED_CERT_IN_CHAIN`; no hostname, username, password, certificate, or connection string was exposed.
- The temporary diagnostic surface was removed in the same correction increment.
- The integration-provided URL requests `sslmode=require`. Current node-postgres compatibility behavior can interpret that as certificate-verifying `verify-full`, which is incompatible with this Supabase pooler chain.
- NERVA now adds `uselibpqcompat=true` only for the Vercel `POSTGRES_URL` fallback when it already requests `sslmode=require`. This keeps TLS required while honoring standard libpq `require` semantics. Explicit `DATABASE_URL` values remain untouched.
- Final public readiness must still be reverified on the deployment produced from this corrected exact HEAD before Gate 6 can pass.

## Gate 6 public deployment closed

- Product/deployment candidate SHA: `56ad064abc6df05ee8f52dc864005b250030ccf8`.
- Vercel deployment ID: `dpl_E5bUWDVuLdr1heRVdUuUFgBRSHHv`.
- Exact deployment URL: `https://nerva-project-31wbwncgs-claytons-projects-5922d27c.vercel.app`.
- Deployment state: `READY`, tied by Vercel Git metadata to exact SHA `56ad064abc6df05ee8f52dc864005b250030ccf8`.
- External `/`: HTTP 200.
- External `/demo?lang=en`: HTTP 200.
- External `/api/health/live`: HTTP 200, `TESTNET_DEMO`, `executionEnabled=false`.
- External `/api/health/ready`: HTTP 200, database `HEALTHY`, `globalExecutionDisabled=true`.
- Exact-head ruleset checks on `56ad064...`: `linux`, `windows-bounded`, `gef-validation`, `source-pack`, SonarCloud, Socket PR Alerts, and Socket Project Report all completed successfully.
- Vercel/Supabase integration secrets remain outside Git and were verified by key presence only. No database password or connection string was printed into evidence.
- The first integrated preview exposed a bounded TLS compatibility failure `SELF_SIGNED_CERT_IN_CHAIN`; the temporary diagnostic was removed, node-postgres was scoped to libpq `sslmode=require` semantics only for the Vercel `POSTGRES_URL` fallback, and the subsequent exact product candidate reached healthy readiness.
- `MAINNET EFFECT = HARD_BLOCKED`, `LIVE PERPL WRITES = BLOCKED`, `NERVA_EXECUTION_ENABLED=false`, and the global kill switch remain intact.

Gate 6 is therefore CLOSED. The remaining M06 release blocker is authenticated Metropolis portal evidence and the final submission package decision. The owner completed the interactive GitHub OAuth step, but this connector session cannot read the browser-authenticated portal state. Do not infer track/bounty eligibility or exact authenticated form requirements from the OAuth action alone.

## Visual & Demo Polish Pass — public preview evidence

- Work Order: `NERVA-WO-007`; branch: `feat/nerva-wo-007-m06-release-hardening`; PR #20 remains `OPEN`, `DRAFT`, and unmerged.
- Product redesign commit: `2d7201fc0bc688a9a42b3f045f3a37562399b717`.
- Validation/test correction HEAD: `c5ac6a1428ef8fc569289ed5523693334e83e93b`.
- Base remains `main@b778b470eff4ff997def001899530512065e5676`; Context Lock validation reports 98 fingerprints.
- Exact Vercel Preview deployment `7rYX8Tujqj9UUsKys9Bp8krbMGSb` is `READY` for `c5ac6a1428ef8fc569289ed5523693334e83e93b` at [https://nerva-project-q7nmt5mko-claytons-projects-5922d27c.vercel.app](https://nerva-project-q7nmt5mko-claytons-projects-5922d27c.vercel.app).
- Direct HTTPS checks on that deployment returned `/metropolis/technical-demo` = HTTP 200 and `/metropolis/pitch-video` = HTTP 200. Both contain the exact page title and requested summary, `Temporary submission placeholder`, the video-production notice, demo CTA, `TESTNET_DEMO`, `MAINNET EFFECT = HARD_BLOCKED`, and `LIVE PERPL WRITES = BLOCKED`; neither embeds or claims to be a video.
- `/api/health/live` returned HTTP 200 with `environment=TESTNET_DEMO` and `executionEnabled=false`.
- `/api/health/ready` returned HTTP 200 with database `HEALTHY` and `globalExecutionDisabled=true`. The separate `/api/flight-recorder` read model returned HTTP 503 / `UNAVAILABLE` with empty event collections; the page presents this unavailable state rather than inventing live evidence. The Guided Demo's synthetic lineage remains explicitly local and `DEMO_ONLY`.
- Full Playwright suite against the exact deployment: 10/10 passed, including M05 fail-closed guided flow, M06 security headers, placeholder content/safety, 1440×900 and 390×844 layouts, axe critical/serious checks, and Flight Recorder narration. The Playwright Vercel-preview-only `x-vercel-skip-toolbar: 1` request header prevents Vercel Toolbar console noise, as described by [Vercel's Toolbar automation documentation](https://vercel.com/docs/vercel-toolbar/managing-toolbar#disable-toolbar-for-automation); the application's strict CSP was not changed.

### Validation on the visual candidate

- `npm run lint`, `npm run typecheck`, `npm run build`, targeted Prettier check, and `git diff --check`: PASS.
- `npm test`: 31 files / 140 tests PASS.
- `npm run smoke:boot`: PASS with database variables omitted; web health is live, readiness fails closed as not configured, worker starts in observation mode, execution disabled; English, Brazilian Portuguese, and Spanish home copy verified.
- `npm run context:validate`: PASS; M06 Context Lock 98/98 and historical M05/M04 locks validate.
- `npm run sourcepack:validate`: PASS; 56 required files / 7 modules; M06 implementation remains on the admitted branch.
- `npm run m03:safety:verify`, `npm run m05:demo:verify`, `npm run deps:boundary`, and `npm run security:client-bundle`: PASS. Mainnet effect remains hard-blocked, live Perpl writes remain blocked, unproven metrics remain non-authoritative, DEMO_ONLY remains isolated, and no client secret material is present.
- `npm run security:audit`: PASS at the configured HIGH threshold; zero HIGH/CRITICAL findings. Four pre-existing MODERATE transitive advisories remain carried forward; no forced dependency downgrade was applied.
- Exact-HEAD hosted checks on `c5ac6a1`: Linux, Windows bounded, GEF 1.1.2, Source Pack, SonarCloud, Socket Pull Request Alerts, Socket Project Report, and Vercel all succeeded. See [Linux and Windows run](https://github.com/KayzenRoot/nerva-project/actions/runs/37233984409), [GEF](https://github.com/KayzenRoot/nerva-project/actions/runs/37233984347), [Source Pack](https://github.com/KayzenRoot/nerva-project/actions/runs/37233984345), [SonarCloud](https://sonarcloud.io/dashboard?id=KayzenRoot_nerva-project&pullRequest=20), [Socket Alerts](https://socket.dev), [Socket Project Report](https://socket.dev/dashboard/org/nexlabs/sbom/51fefa67-8365-4bb6-a3f3-c4286f206460), and [Vercel deployment](https://vercel.com/claytons-projects-5922d27c/nerva-project/7rYX8Tujqj9UUsKys9Bp8krbMGSb).

### Responsive screenshots and performance/privacy evidence

The exact-preview screenshots are stored in `.engineering/evidence/NERVA-WO-007-artifacts-visual-polish/`:

- `home-desktop.png`, `home-mobile.png`;
- `risk-dashboard-desktop.png`, `policy-builder-desktop.png`, `flight-recorder-desktop.png`;
- `guided-demo-desktop.png`, `guided-demo-mobile.png`;
- `technical-demo-desktop.png`, `technical-demo-mobile.png`;
- `pitch-video-desktop.png`, `pitch-video-mobile.png`.

Screenshots use 1440×900 desktop and 390×844 mobile viewports. A single unthrottled Chromium navigation sample on the public preview measured DOMContentLoaded at 568–902 ms and load at 722–977 ms for the dashboard, policy builder, and Flight Recorder; transferSize for the HTML document was 4.6–5.7 KB. This is an observational sample, not a Lighthouse score or a throttled performance benchmark. The Next production output contained 11 JavaScript chunks totaling 661,272 bytes and one CSS chunk of 55,478 bytes; `visual-polish.css` source is 41,610 bytes. The polish introduced no package dependency, analytics integration, external font, or secret. Client-bundle inspection found no server secret material.

### Remaining release status and known limitation

- `MAINNET EFFECT = HARD_BLOCKED`; `LIVE PERPL WRITES = BLOCKED`; no new financial authority, transaction, real provider outcome, or synthetic-to-live path was added.
- M06 is not approved and V0.1 is not declared release-ready. The latest owner-provided authenticated Metropolis evidence says project `NERVA` exists but the full description, repository, tracks/bounties, progress update, and final submission remain incomplete; no submission or bounty claim was made. Keep the proposed Checkpoint Delta unpromoted.
- Flight Recorder live records remain unavailable in this preview as captured above; this is an explicit availability limitation, not a financial-safety bypass.
- No approved logo asset was present in the repository or the supplied text. The UI uses the new inline violet NERVA SVG mark, but its identity as the separately approved official logo is unverified; replace the mark when that approved source asset is available.
- Global `npm run format:check` is not claimed as passing: the earlier global check reported five unrelated historical formatting files outside this visual-polish diff. The changed files pass targeted formatting and are not broadened to reformat those files.

## NERVA-WO-007-CD-001 — video-readiness correction

Status: implementation prepared for audit. This correction addresses only the three video-readiness findings from the latest PR #20 review; independent re-audit remains pending. The candidate is based on the reviewed branch head `4992569a5826ff2af7ca92ba7825f45a99110f68`, with the canonical base `main@b778b470eff4ff997def001899530512065e5676` and the M06 Context Lock still validating at 98/98 fingerprints.

This section supersedes the earlier Visual & Demo Polish note that the approved logo was unavailable. That note describes the prior candidate; the owner-provided asset is integrated in this correction.

### Finding responses

1. **Approved logo integrated.** The owner-provided official NERVA PNG is installed at `apps/web/public/branding/nerva-logo.png` and used by the header/hero, favicon and Apple icon route, Open Graph image and Twitter card. `apps/web/src/app/icon.png` is the same official asset. Source and repository copies have SHA-256 `A66A716C907C2DD178E40898C4A220C6B351E6BA1977B62236BD221EF02A62E6`, at `1254 × 1254`. The old provisional inline SVG mark and generated SVG social image were removed. E2E checks the public image response and social metadata path and dimensions.
2. **Flight Recorder recording surface added.** `/demo/recording/flight-recorder` renders a seven-stage, static synthetic narrative labeled `DEMO_ONLY · SYNTHETIC DATA · NOT PERSISTED`. It states that the stages are not provider evidence and that no database write, provider request, wallet, transaction or receipt exists. The route is a server-rendered display-only surface with no API request; `/flight-recorder` remains the truthful live read-only surface and continues to show its real unavailable state when the live read model is unavailable.
3. **Risk and Policy recording surfaces populated.** `/demo/recording/risk` and `/demo/recording/policy` reuse the accepted `nerva-m05-demo-v1` / `protection-story` Guided Demo fixture. The risk view shows synthetic provenance and keeps `LIQUIDATION_DISTANCE`, `MAINTENANCE_MARGIN` and `FUNDING_DIRECTION` as `UNAVAILABLE_UNPROVEN`. The policy view presents trigger, `REDUCE_POSITION`, fraction, notional, slippage, market/position, cooldown, expiry and refusal in human-readable form, with display-only JSON available for inspection.

### Isolation and safety evidence

- The new routes make no `/api/*` requests, call no live/provider path, and persist no fixture or lineage. `npm run m05:demo:verify` confirms no provider, database, wallet or effect path in demo source.
- The live Dashboard, Policies and Flight Recorder retain their `LIVE READ ONLY` labeling and do not contain the synthetic `DEMO-SNAPSHOT-01` fixture.
- `npm run m03:safety:verify` confirms the action allowlist stays `REDUCE_POSITION`, `CLOSE_POSITION`, `NO_ACTION`; unproven metrics cannot authorize; mainnet effects are hard-blocked; live Perpl writes are blocked; custody remains none; and ambiguous retry stays blocked.
- `NERVA_EXECUTION_ENABLED=false` remains visible on the recording surfaces. No migration, dependency, analytics integration, financial authority or M07 work was added.

### Files and visual evidence

Runtime changes are limited to `apps/web/src/app/nerva-brand.tsx`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/demo/demo-view.tsx`, `apps/web/src/app/visual-polish.css`, the new `apps/web/src/app/demo/recording/` display-only route/model/copy/test files, and the public brand/icon assets. Test changes are in `apps/web/e2e/cd001-video-readiness.pw.ts` and the route list in `apps/web/e2e/visual-polish.pw.ts`. The new screenshot bundle is `.engineering/evidence/NERVA-WO-007-CD-001-artifacts/`:

- `home-desktop.png` — 1440 × 900;
- `home-mobile.png` — 390 × 844;
- `risk-demo-desktop.png` and `policy-demo-desktop.png` — 1440 × 900;
- `guided-demo-desktop.png` — 1440 × 900;
- `guided-demo-mobile.png` — 390 × 844;
- `flight-recorder-demo-desktop.png` — 1440 × 900.

The E2E capture test verifies HTTP 200, natural image dimensions, no horizontal overflow, reduced-motion behavior, and zero serious/critical axe findings on all three recording surfaces at both required viewport sizes. The correction-specific Guided Demo captures show the approved brand asset.

### Local validation

- `npm test`: 32 files / 143 tests passed.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed.
- `npm run test:e2e -- --grep "CD-001:"`: 4/4 passed; screenshots regenerated at the stated viewports and English, Brazilian Portuguese and Spanish copy verified on all three routes.
- The most recent full local `npm run test:e2e`: 12/13 passed; all CD-001, M05 and visual-polish cases passed, while the existing M06 security test exceeded the 30-second timeout during context teardown in the Windows Next development server. `npm run test:e2e -- --grep "M06 security headers"` passed 1/1 in isolation. This is recorded as a local runner timing limitation; exact-preview/hosted validation remains pending.
- Targeted Prettier check passed. Global `npm run format:check` remains blocked by five pre-existing, untouched files: `packages/config/src/environment.test.ts`, `packages/config/src/index.ts`, `packages/db/migrations/meta/_journal.json`, `docs/NERVA-M06-RELEASE-RUNBOOK.md`, and `docs/NERVA-M06-SUPABASE-RLS-PROPOSAL.md`.
- `npm run context:validate`, `npm run sourcepack:validate`, `npm run gef:verify`, `npm run gef:package:verify`, `npm run workspace:validate`, `npm run deps:boundary`, `npm run m03:safety:verify`, `npm run m05:demo:verify`, `npm run security:client-bundle`, and `npm run security:audit`: passed. The audit reports zero HIGH/CRITICAL and the same four MODERATE transitive advisories already carried forward above.

### Production CSP correction found during preview validation

- Initial correction candidate `46582e7a728ba98a3b2c012260d6bae4da6f9adc` deployed READY as Vercel deployment `4d6G5TEN6QW1NU5L6cuUhjkzW7Ae`. Its public branch preview returned HTTP 200 for all three `/demo/recording/{risk,policy,flight-recorder}` pages and `/api/health/live` + `/api/health/ready`.
- The full browser suite against that production preview ran 14 tests: 9 passed and 5 failed because the production CSP reported blocked inline style attributes. The logo's Next `Image` output included an inline style; the reduced-motion test also injected an inline style. No CSP relaxation was made.
- `NervaSymbol` now uses a same-origin `<img>` with explicit intrinsic dimensions, avoiding Next Image's inline style. The reduced-motion E2E now inspects computed CSS and `scroll-behavior` without mutating the page. This correction preserves the existing production CSP.
- Post-correction local evidence: lint, typecheck and production build passed; CD-001 E2E passed 4/4. Exact-preview retest and required checks for the corrected candidate are pending push.

### Exact-head hosted validation

Pending push of the CSP correction candidate. Record its final SHA, exact-head required checks, Vercel deployment identity/URL, complete preview E2E result, and public HTTP evidence here before declaring this correction ready for audit. PR #20 must remain open/draft/unmerged; the Checkpoint remains unpromoted.
