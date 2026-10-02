# NERVA-WO-002 Evidence Bundle

Status: M01 IMPLEMENTED — FINAL EXACT-HEAD GATES PASS; AUDIT CANDIDATE
Work Order: NERVA-WO-002
Module: M01
Issue: #5
Pull request: #6
Branch: `feat/nerva-wo-002-m01-safety-kernel`
Execution base: `4dcdd3fd0cdd1ac7c8933839e7d70e60b925a955`
Audited implementation head before this evidence-only correction: `0c9b1736da60f27023699b978fb05d3a5ee01365`
Stop condition: `NERVA_M01_PLATFORM_FOUNDATION_READY_FOR_AUDIT`

Exact-head implementation evidence for `0c9b1736da60f27023699b978fb05d3a5ee01365`: Linux CI `37052127423` SUCCESS; Windows bounded CI in the same run SUCCESS; GEF validation `37052127516` SUCCESS; Source Pack validation `37052127606` SUCCESS; Socket Security PR Alerts and Project Report SUCCESS. Final Codex Security scan `afaba4c1-a2bc-45f3-bf77-325520e66484` reports 0 reportable findings and 0 CRITICAL/HIGH. This correction changes evidence text only and does not alter runtime source.

## Authority and exact state

- Repository: `KayzenRoot/nerva-project`.
- Starting branch head: `f6bf501980f8afbc568fa924e333f59692a5b78b`; base merge-base matched `main@4dcdd3fd0cdd1ac7c8933839e7d70e60b925a955`.
- Context Lock: LOCKED; 17 critical-input Git blob fingerprints matched both the locked base and working tree.
- Authenticated GitHub identity: `KayzenRoot`; PR #6 was OPEN/DRAFT, targeted `main`, and pointed at the starting branch head before implementation.
- Canonical Checkpoint and Source Pack are unchanged. The branch Work Order/admission commits authorize M01; Source Pack validation still reports the pre-implementation planning values. This proposal does not promote that state.

## Live dependency and platform preflight

Observed on 2026-10-02 before broad project dependency installation:

| Package/runtime     | Selected exact version     | Evidence                                                                                                                                                                                                         |
| ------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node runtime target | 22.x                       | Work Order requires hosted Node 22; worker container is pinned to `node:22.23.3-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c`.                                          |
| Next.js             | 16.3.8                     | Security-patched Active LTS material: https://nextjs.org/blog                                                                                                                                                    |
| React / React DOM   | 19.3.0 / 19.3.0            | npm registry metadata.                                                                                                                                                                                           |
| Zod                 | 4.6.5                      | npm registry metadata.                                                                                                                                                                                           |
| Vitest              | 5.0.3                      | npm registry metadata; Node engine includes Node 22.                                                                                                                                                             |
| Drizzle ORM / Kit   | 0.45.3 / 0.31.11           | npm registry metadata.                                                                                                                                                                                           |
| Pino                | 10.3.1                     | npm registry metadata.                                                                                                                                                                                           |
| PostgreSQL image    | 18.6-bookworm              | Official image pinned by OCI index digest `sha256:3725f4e2499eef5134592b3b4ab79a543ed7f8e533b05b5b637af926630f6650`; PostgreSQL 18 is supported through Nov 2030: https://www.postgresql.org/support/versioning/ |
| Monad chain IDs     | mainnet 143; testnet 10143 | Official current facts: https://docs.monad.xyz/ai/current-facts                                                                                                                                                  |

Direct npm dependencies are exact-pinned in `package.json` and `package-lock.json`; no direct range or `latest` tag is used.

## Correction Deltas

### CD-001 — TypeScript peer compatibility

The expected TypeScript `7.0.2` conflicts with `typescript-eslint@8.71.0` / `@typescript-eslint/project-service` peer range `>=4.8.4 <6.1.0`. Selected the highest compatible TypeScript version, `6.0.3`, integrity `sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw==`. Direct ESLint 10 and TypeScript ESLint flat configuration are used; no peer override is present.

### CD-002 — ESLint peer compatibility

The expected ESLint `10.10.0` is available. `eslint-config-next@16.3.8` introduced incompatible peers through legacy `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, and `eslint-plugin-react`. Removed that preset and its unnecessary legacy plugins, then used exact-pinned `eslint@10.10.0`, `@eslint/js@10.0.1`, `typescript-eslint@8.71.0`, and `globals@17.13.0` with flat configuration. This preserves the required ESLint 10 line without peer overrides or legacy plugin downgrades.

Both changes preserve the admitted architecture and remove npm peer overrides. The TypeScript compatibility delta is the smallest compatible secure version change; ESLint remains at its expected version.

### CD-003 — Server-rendered document language

The first language selector changed page copy but left the root document language and metadata fixed to English. Added a locale-resolving Next Proxy that overwrites an internal request header from the supported `lang` query, then render `<html lang>` and title/description metadata from that locale. The boot smoke checks English default, PT-BR, and Spanish copy and document language in server-rendered HTML. Unsupported values fall back to English.

### CD-004 — Complete execution-plan authority and runtime safety context

The exact-head review of the first implementation found that `decideEligibility` accepted missing JavaScript values for required kill-switch/execution/demo controls, and `ExecutionPlan` did not carry all policy authority dimensions. Added runtime type checks that refuse an incomplete safety context. Plans now carry action family, network, protocol capability, market selector, and slippage basis points in the canonical digest; the factory validates the M01 shapes, and both eligibility and execution transitions compare those values against immutable policy action/scope, allowed protocol/market sets, and maximum slippage. Regression cases were observed failing before their respective fixes and pass after implementation.

### CD-005 — Recursive structured-log credential redaction

The exact `c34e1289d9c269a1efc1ba21b9b04c4b56f8db92` security review reproduced a nested uppercase `payload.request.Authorization` value in the Pino output. A path-only pattern and argument-only sanitizer did not cover all nesting and `logger.child()` bindings. Follow-up test-first cases also showed that common variants such as `accessToken`, `clientSecret`, and `privateKeyHex` bypass exact-key matching. Added final serialized-record sanitization that recursively normalizes credential-key names case-insensitively and redacts authorization/API-key/private-key/seed-phrase prefixes and secret/token/password suffixes before the configured stream write; Pino path redaction remains defense in depth. The new cases failed before the correction and pass after it. The focused suite passes 2 tests and the full suite passes 41 tests across 9 files.

### CD-006 — Environment template placeholders

A final literal check against NERVA-WO-002 lines 294-301 found that `.env.example` contained fixed local values where the Work Order requires placeholders only. The sample now uses matching `replace-me` placeholders for PostgreSQL and `DATABASE_URL`; Compose builds the worker URL from the same configurable database variables while retaining documented local-only fallbacks. `docker compose --env-file .env.example config --format json` confirms that DB and worker credentials resolve consistently and that PostgreSQL remains loopback-bound. The sample remains explicitly development-only; production values still belong in the deployment secret store.

### CD-007 — Final exact-head evidence reconciliation

After exact-head hosted checks completed successfully on `0c9b1736da60f27023699b978fb05d3a5ee01365`, the Evidence Bundle still contained two stale `hosted CI pending` labels. This governance-only correction records the completed Linux/Windows, GEF, Source Pack and Socket results plus the final Codex Security scan identity. No runtime/product source, dependency, migration, test or architecture behavior changes in CD-007.

## Implemented architecture

- npm workspaces: `apps/web`, `apps/worker`, and `packages/{domain,contracts,config,observability,db,testing}`.
- Domain exports branded identifiers, bounded integer basis points, bigint-safe amounts, versioned core objects, strict policy-transition validation, explicit version-bound confirmation evidence, and fail-closed state guards. Immutable PolicyVersion and ExecutionPlan objects are issued by validated factories and tracked in-process; eligibility derives policy action family, amount limits, network/protocol/market/slippage scope, policy and plan expiry, and authorization digest from those objects instead of caller-supplied booleans or copied limits.
- `PolicySchemaV0_1` is strict. It rejects unknown fields/versions, unsupported capability values, environment/network mismatch, duplicate triggers, invalid expiry/bounds, unbounded actions, and fallback behavior other than `REFUSE`. M01 admits only `generic-risk-preview-v0`, which has no provider connection or execution effect.
- Config parses critical settings at process startup; defaults to `LOCAL`, execution OFF, and `GLOBAL_EXECUTION_DISABLED=true`. `MAINNET_EXECUTION` and explicit execution enablement fail startup.
- Next.js App Router provides an English-default product shell with Brazilian Portuguese and Spanish alternatives, an environment badge, non-live placeholders, and live/readiness health routes. Readiness reports configuration plus persisted kill-switch state and fails closed when the persisted control is unavailable. Worker starts in safe mode with graceful signal shutdown. Neither has wallet, provider, LLM, signer, or submitter code.
- PostgreSQL/Drizzle owns exactly the five admitted tables: `policies`, `policy_versions`, `audit_events`, `integration_health_samples`, `runtime_controls`. Triggers make policy versions and audit events append-only; runtime-control updates emit audit events; the global execution-disable row seeds enabled.
- Pino structured logs use AsyncLocalStorage correlation and recursively redact credential-shaped authorization, API-key, private-key, seed, token, and password fields at the serialized output boundary.

## Test-first evidence and preliminary local results

Tests were written and run against missing modules before implementations. Domain safety tests were extended test-first for fail-closed transition guards; policy tests went red for unsupported capabilities and environment/network mismatch before the validator was tightened.

| Gate                                | Result                                                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean `npm ci --no-fund --no-audit` | PASS. npm reports install-script approval notices for transitive esbuild versions; builds and runtime smokes pass.                                        |
| `npm ls --all`                      | PASS; no invalid/unmet required packages. Upstream optional packages are absent by design.                                                                |
| Unit/invariant tests                | PASS, 41 tests across 9 files after CD-005.                                                                                                               |
| Typecheck / lint / format           | PASS on final source changes.                                                                                                                             |
| Web and worker production build     | PASS; Next 16.3.8 compiled routes and Proxy, then worker TypeScript build passed.                                                                         |
| Context Lock                        | PASS; exact base and 17 fingerprints.                                                                                                                     |
| Workspace graph                     | PASS; 8 workspaces, acyclic dependency graph.                                                                                                             |
| Forbidden dependency/path scan      | PASS; 9 manifests, 22 source files, 0 forbidden imports, 0 execution paths.                                                                               |
| Source Pack                         | PASS; canonical source files unchanged; validator reports pre-execution `NOT_ADMITTED`/`NOT_STARTED`.                                                     |
| GEF package/state                   | PASS; `@gef-bootstrap/cli@1.1.2` integrity and existing state/receipt.                                                                                    |
| PostgreSQL migration smoke          | PASS on clean PostgreSQL 18.6; exactly five M01 tables, append-only and runtime-control audit triggers, global disable seeded.                            |
| Boot smoke                          | PASS with local test PostgreSQL configured; web live+ready, worker safe mode, execution OFF; EN/PT-BR/ES copy and `<html lang>` verified.                 |
| Client bundle secret scan           | PASS; 12 client files and a synthetic `DATABASE_URL` checked, no server secret value present.                                                             |
| `npm audit --audit-level=high`      | PASS at the HIGH threshold; four MODERATE findings remain in Drizzle Kit's transitive `@esbuild-kit`/esbuild chain. No HIGH/CRITICAL; no force downgrade. |
| Exact-head hosted Linux/Windows CI  | Final exact-head Linux and Windows run URLs are recorded in PR #6 Checks after push.                                                                      |
| Exact-head Codex Security diff scan | Final exact-head scan identity and disposition are recorded in the PR #6 draft after push; the completed c34 review below is pre-fix evidence only.       |

## Security review and in-scope corrections

- Formal Codex Security diff scan `151f9d14-9c67-43f4-aeed-2ce2d1efe83d` completed against the original M01 working-tree snapshot at base/head `f6bf501980f8afbc568fa924e333f59692a5b78b`, digest `codex-security-snapshot/v1:sha256:6a8914f0bd386c6108d83546faa388da879eed6a0d6aa7d8e26ec56b854efb29`. It reviewed all 47 inventoried changed-file rows and reported zero findings; four domain-guard candidates were deferred because that snapshot had no M01 callers or effect sinks. The sealed scan report is recorded by Codex Security locally and is not an independent audit of the final PR head.
- Formal Codex Security diff scan `be003b78-f618-4117-8ca5-8edf8dffed5f` covered base `4dcdd3fd0cdd1ac7c8933839e7d70e60b925a955` → implementation head `9fff8aadde4acf003a8e33aa75156c9a445accf7`. It reviewed all 52 inventoried review rows plus 19 manually inspected supporting changed files and reported zero reportable findings with three deferred candidates. Two M01 completeness gaps were corrected by CD-004; authorization provenance remains an M02 proof gap. The immutable report is `C:\Users\csn19\.codex\state\plugins\codex-security\scans\nerva-project\9fff8aadde4acf003a8e33aa75156c9a445accf7_20261002T171029Z_1y8vqrw2\report.md`; the final source-head scan is pending push.
- Formal Codex Security diff scan `e117c4dd-3613-4332-8fc0-e8e962484cde` reviewed base `4dcdd3fd0cdd1ac7c8933839e7d70e60b925a955` → immutable c34 head `c34e1289d9c269a1efc1ba21b9b04c4b56f8db92`. It reviewed 52 authoritative inventory rows plus 19 supporting changed files, validated three candidates, and reported one low CWE-532 log-redaction finding, deferred one authorization-provenance candidate, and rejected the local-only Compose credential candidate. The log finding was corrected by CD-005 in this successor source tree; the sealed c34 report remains evidence of the pre-fix reproduction, not the final source result. The final exact-head scan is separately recorded in PR #6 after push.
- Targeted dynamic reproduction on the pre-correction snapshot confirmed that expiry/authority booleans and caller-created `BOUND` decisions could bypass guard logic, and omitted environment context did not fail closed. M01 corrections replaced those assertions with immutable factory-issued PolicyVersion/ExecutionPlan values, derived authority/expiry/digests, internal authorization verification, explicit LOCAL/non-demo requirements, and transition-time expiry checks.
- The readiness projection's fixed `true` value was corrected to reflect configuration and persisted control state, with unavailable reads remaining disabled. No effect-path integrations were added.
- Read-only architecture review identified the static root-document language, corrected by CD-003. The subsequent exact-head review exposed two domain gaps, corrected by CD-004: missing runtime guard fields no longer yield `ELIGIBLE`, and plans bind their action family plus full M01 network/protocol/market/slippage dimensions to policy authority. A separate integration limitation remains: `AuthorizationContext` binding/freshness is checked, but M01 has no authenticated principal, signature verifier, identity provider, or authorization-write route; callers must not interpret the data object itself as proof of actor provenance. M01 web routes remain health/read-only and no execution effect path exists.

## Proof-case results

| Work Order proof | Result       | Evidence                                                                                                                                                                     |
| ---------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M01-DOM-001`    | PASS         | Branded ID compile-time `@ts-expect-error` and runtime checks in `packages/domain/src/safety.test.ts`.                                                                       |
| `M01-POL-001`    | PASS         | Invalid policy transition refused in `packages/contracts/src/policy.test.ts`.                                                                                                |
| `M01-POL-002`    | PASS         | Material revision creates a distinct immutable version/hash in the policy test.                                                                                              |
| `M01-POL-003`    | PASS         | Strict V0.1 validator rejects unknown fields/schemas and malformed constraints in the policy test.                                                                           |
| `M01-AUTH-001`   | PASS         | Action family, amount/fraction, network, protocol capability, market selector, and slippage beyond policy authority are refused; dimensions are included in the plan digest. |
| `M01-AUTH-002`   | PASS         | Mismatched plan digest or policy version is refused in the domain test.                                                                                                      |
| `M01-STATE-001`  | PASS         | Illegal, invalid, and expired policy transitions are refused in the domain test.                                                                                             |
| `M01-STATE-002`  | PASS         | Illegal execution transitions and terminal-state retry are refused in the domain test.                                                                                       |
| `M01-DATA-001`   | PASS         | STALE/UNKNOWN observations cannot produce eligibility in the domain test.                                                                                                    |
| `M01-IDEMP-001`  | PASS         | Duplicate effect identity cannot advance twice in the domain test.                                                                                                           |
| `M01-REC-001`    | PASS         | UNKNOWN effect refuses blind retry in the same domain test.                                                                                                                  |
| `M01-KILL-001`   | PASS         | Global kill switch blocks execution progression in the domain test and readiness route test.                                                                                 |
| `M01-ENV-001`    | PASS         | `MAINNET_EXECUTION` is rejected by config; domain execution refuses mainnet.                                                                                                 |
| `M01-DEMO-001`   | PASS         | DEMO_ONLY authorization is refused in the domain test.                                                                                                                       |
| `M01-CFG-001`    | PASS         | Malformed critical configuration fails closed in `packages/config/src/environment.test.ts`.                                                                                  |
| `M01-SEC-001`    | PASS         | Correlation propagation plus nested and child-binding credential redaction in `packages/observability/src/logger.test.ts`.                                                   |
| `M01-SEC-002`    | PASS         | Client bundle scan examined 12 assets with one synthetic `DATABASE_URL` value; none appeared in client output.                                                               |
| `M01-DB-001`     | PASS         | Schema test plus clean PostgreSQL 18.6 migration smoke verified five tables, append-only/audit triggers, and disabled seed.                                                  |
| `M01-DET-001`    | PASS         | Canonical bytes/hash are key-order independent; bounded integer and bigint serialization checked in the domain test.                                                         |
| `M01-CI-001`     | PASS exact-head | Dependency boundary validator: 9 manifests, 22 source files, 0 forbidden imports and 0 financial effect paths; Linux exact-head CI passed in run `37052127423`.             |
| `M01-BOOT-001`   | PASS exact-head | Live/ready route tests, worker safe-mode test and production boot smoke passed in exact-head Linux CI run `37052127423`.                                                    |

### Complete changed-file inventory

Against `main@4dcdd3fd0cdd1ac7c8933839e7d70e60b925a955`, this branch changes **71 paths**:

```text
.dockerignore
.engineering/checkpoint-deltas/NERVA-WO-002-PROPOSED.md
.engineering/context-locks/NERVA-WO-002.json
.engineering/evidence/NERVA-WO-002-EVIDENCE.md
.engineering/execution-briefs/NERVA-WO-002-CODEX.md
.engineering/work-orders/NERVA-WO-002.md
.env.example
.github/scripts/boot-smoke.mjs
.github/scripts/check-client-bundle.mjs
.github/scripts/check-no-forbidden-deps.mjs
.github/scripts/validate-nerva-context-lock.mjs
.github/scripts/validate-workspaces.mjs
.github/scripts/verify-db-schema.mjs
.github/workflows/m01-ci.yml
.github/workflows/source-pack-validation.yml
.gitignore
.prettierignore
.prettierrc.json
Dockerfile.worker
README.md
apps/web/next-env.d.ts
apps/web/next.config.ts
apps/web/package.json
apps/web/src/app/api/health/live/route.test.ts
apps/web/src/app/api/health/live/route.ts
apps/web/src/app/api/health/ready/route.test.ts
apps/web/src/app/api/health/ready/route.ts
apps/web/src/app/dashboard/page.tsx
apps/web/src/app/flight-recorder/page.tsx
apps/web/src/app/i18n.test.ts
apps/web/src/app/i18n.ts
apps/web/src/app/layout.tsx
apps/web/src/app/page.tsx
apps/web/src/app/placeholder-screen.tsx
apps/web/src/app/policies/page.tsx
apps/web/src/app/styles.css
apps/web/src/proxy.ts
apps/web/tsconfig.json
apps/worker/package.json
apps/worker/src/main.ts
apps/worker/src/worker.test.ts
apps/worker/src/worker.ts
apps/worker/tsconfig.json
compose.yaml
eslint.config.mjs
package-lock.json
package.json
packages/config/package.json
packages/config/src/environment.test.ts
packages/config/src/index.ts
packages/contracts/package.json
packages/contracts/src/index.ts
packages/contracts/src/policy.test.ts
packages/db/drizzle.config.ts
packages/db/migrations/0000_elite_tempest.sql
packages/db/migrations/meta/0000_snapshot.json
packages/db/migrations/meta/_journal.json
packages/db/package.json
packages/db/src/index.ts
packages/db/src/schema.test.ts
packages/db/src/schema.ts
packages/domain/package.json
packages/domain/src/index.ts
packages/domain/src/safety.test.ts
packages/observability/package.json
packages/observability/src/index.ts
packages/observability/src/logger.test.ts
packages/testing/package.json
packages/testing/src/index.ts
tsconfig.json
vitest.config.ts
```

The final implementation head SHA, exact-head Linux/Windows CI URLs, and final security-scan result are cross-linked in the PR #6 draft and GitHub Checks. No source changes follow those exact-head checks.

Inherited read-only GEF observations from the baseline: `drift.changed=true`, `drift.class=UNEXPECTED`, `operator.stale=true`, and `GOVERNANCE_CHECKPOINT_SCHEMA_UNSUPPORTED:1.0` appeared while package/state/receipt checks succeeded. No GEF initialization, reindex, or Checkpoint mutation is performed in this Work Order.

## Remaining risks and governance boundary

- M01 validates authorization bindings; it contains no wallet, signer, provider, or execution adapter.
- Authorization provenance is not authenticated in this foundation: no identity provider or authorization issuer is implemented. Future integration must supply verified least-privilege authorization before allowing a transition to `AUTHORIZED`.
- Plan authority now includes immutable action family, network, protocol capability, market selector, slippage, amount, fraction, and expiry bindings. No execution caller exists in M01.
- `generic-risk-preview-v0` is not evidence that a protocol is integrated or that market data is current.
- Moderate transitive audit findings remain below the required HIGH/CRITICAL gate and will be checked again on the final lock.
- Independent audit and governance promotion remain pending after this evidence-only correction.
- No merge, Checkpoint promotion, M01 approval, or M02 work is included.

## Proposed Checkpoint Delta

See `.engineering/checkpoint-deltas/NERVA-WO-002-PROPOSED.md`. It proposes only `NERVA_M01_PLATFORM_FOUNDATION_READY_FOR_AUDIT` as the executor stop marker after exact-head gates pass. It does not modify canonical Checkpoint files.
