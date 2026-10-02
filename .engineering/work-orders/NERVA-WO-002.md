# NERVA-WO-002 — M01 Safety Kernel & Platform Foundation

**Status:** APPROVED — OWNER_AUDIT_NOT_INDEPENDENT  
**Risk:** HIGH_ASSURANCE  
**Module:** M01  
**Issue:** #5  
**Execution base:** `main@4dcdd3fd0cdd1ac7c8933839e7d70e60b925a955`  
**Execution branch:** `feat/nerva-wo-002-m01-safety-kernel`  
**GEF:** `@gef-bootstrap/cli@1.1.2`  
**Primary executor:** Codex  
**Review language:** pt-BR

## OBJECTIVE

Implement the complete M01 platform and safety foundation in one large governed increment so M02–M06 can add market data, risk, execution, wallet and UX capabilities without redefining core authority or safety semantics.

M01 must deliver a compiling, tested, deployable skeleton with executable safety invariants while preserving a hard boundary: **no financial execution, no live trading and no application-custodied signing capability exist at the M01 stop condition.**

## CONTEXT

M00 is APPROVED and merged. The canonical Source Pack defines NERVA as a Monad-native, non-custodial autonomous risk/policy execution product. The LLM is untrusted proposal input; deterministic structured policy validation and external least-privilege authorization own financial eligibility. Mainnet autonomous execution is prohibited until M06 release approval.

This Work Order intentionally covers almost the whole module. Safe corrections remain in this WO/PR through bounded Correction Deltas. Do not fragment M01 into feature PRs merely for convenience.

### Current technology preflight observed 2026-10-02

The executor MUST re-run registry/official-doc preflight before installation and record exact results in Evidence. No `latest`, caret or tilde ranges are allowed for direct M01 dependencies.

Expected stable baseline:
- Next.js `16.3.8` — Active LTS / current security-patched line.
- React / React DOM `19.3.0`.
- TypeScript `7.0.2`.
- Zod `4.6.5`.
- Vitest `5.0.3`.
- Drizzle ORM `0.45.3`.
- Drizzle Kit `0.31.11`.
- Pino `10.3.1`.
- ESLint `10.10.0`.
- Node.js: supported repository baseline `>=22`; hosted CI MUST exercise Node 22.
- PostgreSQL: V0.1 physical datastore; use a currently supported stable major and pin the CI/container image by explicit version/digest in evidence.

If an expected version is unavailable, incompatible or superseded by a security fix before execution, STOP before broad installation, document the discrepancy, choose the smallest compatible secure version delta, and record it in the same WO evidence. No major architectural substitution without Correction Delta.

### Monad configuration facts to revalidate before freezing constants
- Monad mainnet chain ID: `143`.
- Monad testnet chain ID: `10143`.
These are configuration facts only in M01. M01 MUST NOT add provider trading/network behavior beyond health/config seams.

## SCOPE

### 1. Monorepo / application scaffold

Use **npm workspaces**, no Turborepo/Nx in V0.1 unless objective evidence proves npm workspaces insufficient.

Required shape:

```text
apps/
  web/                  # Next.js App Router
  worker/               # Node/TypeScript background runtime skeleton
packages/
  domain/               # pure domain types, branded values, state machines, invariants
  contracts/            # Zod schemas + API/error contracts
  config/               # environment/network/feature/kill-switch configuration
  observability/        # structured logs, redaction, correlation context
  db/                   # PostgreSQL + Drizzle connection/migration foundation
  testing/              # deterministic builders/fixtures shared by modules
```

Root owns workspace scripts and shared TS/ESLint/test configuration.

Dependency direction:
- apps may depend on packages;
- `contracts` may depend on `domain`;
- `config`, `observability`, `db`, `testing` may depend only on the smallest required internal packages;
- `domain` MUST NOT import Next.js, database, provider SDK, wallet SDK, LLM SDK or application code;
- no circular workspace dependency is permitted.

### 2. Domain primitives

Implement typed, documented primitives for at least:
- `RiskSnapshot`
- `RiskMetric`
- `Policy`
- `PolicyVersion`
- `TriggerEvaluation`
- `ExecutionPlan`
- `AuthorizationContext`
- `ExecutionAttempt`
- `ExecutionReceipt`
- `IntegrationHealth`
- correlation/idempotency/plan/policy identifiers.

Rules:
- safety-relevant percentages use integer basis points or explicitly typed fixed-point representation;
- onchain quantities and monetary amounts MUST NOT use unsafe JS floating point when precision matters;
- use branded/opaque identifiers where accidental cross-use would be dangerous;
- every safety-critical serialized contract includes an explicit schema version;
- UNKNOWN is represented explicitly and is never coerced to success.

### 3. State machines / safety kernel

Implement deterministic transition guards for:

Policy:
`DRAFT → VALIDATED → USER_CONFIRMED → ACTIVE → PAUSED | REVOKED | EXPIRED`

Execution:
`OBSERVED → ELIGIBLE → PLANNED → PREFLIGHTED → AUTHORIZED → SUBMITTED → CONFIRMED`
with terminal/exception states `REFUSED | FAILED | UNKNOWN | RECOVERY_REQUIRED`.

Mandatory executable invariants:
1. no execution eligibility without an ACTIVE immutable PolicyVersion;
2. no plan may exceed policy authority;
3. no authorization may bind a different plan digest/policy version;
4. expired policy/plan cannot advance;
5. stale/unknown required observation cannot produce executable eligibility;
6. duplicate idempotency identity cannot create a second effect transition;
7. UNKNOWN/ambiguous effect cannot auto-retry;
8. global kill switch blocks progression toward authorization/execution;
9. MAINNET_EXECUTION is denied by M01 regardless of environment-variable attempt;
10. DEMO_ONLY state can never satisfy production authorization.

No actual signing/submission is implemented in M01.

### 4. Policy DSL skeleton + deterministic validator

Freeze `PolicySchemaV0_1` as structured JSON-compatible data. At minimum model:
- schema version;
- logical policy ID/version;
- environment;
- scope: network, protocol capability, market/position selector;
- triggers supporting the V0.1 families: liquidation/margin threshold, drawdown threshold, funding threshold;
- action intent families: REDUCE_POSITION and CLOSE_POSITION as **non-executable domain intents only**;
- constraints: max action fraction/notional, max slippage bps, cooldown, expiry, allowed protocol/market;
- safety behavior: stale/unknown/inconsistent input => REFUSE;
- human-readable label/description metadata with zero authority.

Validator MUST reject:
- unknown schema major;
- negative/out-of-range basis points;
- missing/invalid expiry;
- zero/unbounded authority;
- action > configured max;
- unsupported environment/protocol capability;
- duplicate/conflicting triggers;
- unsafe fallback other than REFUSE in V0.1;
- arbitrary fields that could smuggle execution parameters.

Implement deterministic canonical serialization/hash for PolicyVersion and ExecutionPlan. Hashing must not depend on object insertion order.

### 5. Environment / configuration boundary

Implement a single typed config loader with:
- `LOCAL`
- `TESTNET_DEMO`
- `MAINNET_READONLY`
- `MAINNET_EXECUTION` (known state but hard-refused in M01)

Configuration must:
- parse once at process startup;
- validate environment variables using Zod or equivalent admitted schema;
- default execution capability to OFF;
- fail closed on unknown/malformed safety-critical settings;
- expose Monad chain IDs only through typed network configuration;
- separate public browser-safe config from server-only config;
- never serialize secrets to client bundles/logs;
- expose feature controls independently for demo simulation and autonomous execution;
- support runtime/global kill-switch semantics with OFF/deny as the unknown default.

Required invariant:
`MAINNET_EXECUTION + M01` => startup/config safety refusal, not warning.

### 6. Kill switch / runtime control model

Implement domain + persistence seam for:
- GLOBAL_EXECUTION_DISABLED default true;
- policy pause/revoke capability;
- worker safety state;
- reason, actor/source, timestamp and correlation metadata;
- read-only health/reporting path.

No M01 code may provide a route that enables real financial execution.

### 7. Persistence foundation

Use PostgreSQL + Drizzle.

M01 owns:
- DB connection boundary;
- migration generation/apply scripts;
- deterministic migration directory;
- transaction helper;
- health probe;
- test database strategy;
- minimal foundational tables only.

Admitted M01 tables:
- `policies`
- `policy_versions` with immutable version payload/hash semantics
- `audit_events` append-oriented
- `integration_health_samples`
- `runtime_controls`

Do NOT pre-create M02/M03 provider-specific position/order/execution schemas. Those modules own their persistence changes.

Database constraints should enforce invariant portions where practical: unique policy-version identity/hash, append-oriented IDs, timestamps, and runtime-control uniqueness.

### 8. Observability / evidence foundation

Implement:
- Pino structured JSON logging;
- correlation ID propagation using a Node-safe context mechanism;
- component/module/event names;
- environment marker;
- redaction of common secret/key/auth fields;
- typed audit-event emitter seam;
- health/ready state projections.

Forbidden:
- seed phrases/private keys;
- wallet signing material;
- Authorization headers/API secrets;
- full sensitive provider payload dumps.

Add tests proving redaction.

### 9. Web skeleton

Next.js App Router, Node runtime by default.

M01 web surface is intentionally minimal:
- product shell;
- visible environment badge;
- `/api/health/live`;
- `/api/health/ready`;
- placeholder routes/navigation for future dashboard/policy/flight-recorder screens;
- no fake portfolio/risk data presented as live;
- no wallet SDK;
- no provider API;
- no LLM;
- no financial mutation Server Action.

Server Components are default. Client Components only where interaction requires them.

### 10. Worker skeleton

Provide a worker process with:
- startup config validation;
- correlation/logging bootstrap;
- kill-switch state observation seam;
- health lifecycle;
- deterministic graceful shutdown;
- no provider connection;
- no signer;
- no transaction executor.

### 11. Deterministic fixtures / test harness

Create reusable builders/fixtures for:
- active/paused/expired policy versions;
- fresh/stale/unknown observations;
- execution plan inside/outside authority;
- duplicate idempotency identity;
- demo-only environment;
- integration HEALTHY/DEGRADED/STALE/UNKNOWN states.

Fixtures must be deterministic and not depend on wall-clock time without injected clock.

### 12. CI / quality / security gates

Preserve existing GEF and Source Pack validation.

Add M01 repository validation with:
- clean `npm ci`;
- exact dependency/version sanity;
- workspace boundary/cycle check;
- formatting/lint;
- TypeScript strict typecheck;
- unit tests;
- invariant/adversarial tests;
- build of web and worker;
- DB migration generation consistency check;
- ephemeral PostgreSQL migration smoke;
- npm audit at HIGH;
- secret-sensitive logging tests;
- no provider/wallet/LLM forbidden dependency import check;
- exact mainnet execution disabled assertion.

CI must run on Linux; include a bounded Windows test lane for domain/config/test suites because the primary developer workstation is Windows. Do not duplicate expensive browser/deployment checks in M01.

### 13. Deployment skeleton

Add:
- reproducible local startup instructions;
- container/dev-compose skeleton for PostgreSQL and worker as appropriate;
- Next.js output/config compatible with later Vercel or container deployment;
- environment template with placeholders only;
- health/readiness documentation;
- no production secret values;
- no production/mainnet autonomous deployment.

## OUT OF SCOPE

- Perpl REST/WebSocket integration.
- Live Monad RPC reads beyond optional non-authoritative config/health smoke.
- Envio implementation.
- Risk metric computation from real positions.
- LLM integration.
- Natural-language policy proposal.
- Policy activation UX.
- Wallet connection/signing.
- MetaMask Agent Wallet.
- Transaction simulation against live protocol.
- Transaction construction/submission.
- Autonomous execution.
- Mainnet execution enablement.
- Full dashboard UX.
- Hackathon demo shock simulator.
- Token/DAO.
- Broad refactor of GEF/governance files.

## FILES / SOURCES TO READ

Read in this order before modification:
1. `.engineering/CHECKPOINT.md` and `CHECKPOINT.json`
2. `.engineering/DECISIONS-LEDGER.md`
3. approved ADR-0001 and ADR-0002
4. `.engineering/SCOPE.md`
5. `.engineering/DEFINITION-OF-DONE.md`
6. `.engineering/ARCHITECTURE.md`
7. `.engineering/REQUIREMENTS.md`
8. `.engineering/SECURITY.md`
9. `.engineering/DATA-MODEL.md`
10. `.engineering/API-CONTRACTS.md`
11. `.engineering/INTEGRATION-CONTRACTS.md`
12. `.engineering/TEST-BENCHMARK-PLAN.md`
13. `.engineering/DEPLOYMENT.md`
14. `.engineering/MODULE-ROADMAP.md`
15. this Work Order + Context Lock.

Before dependency installation also read current official Next.js security/LTS material, npm registry metadata for direct packages, and current Monad network-information docs.

## ARCHITECTURE RULES

- Preserve all M00 decisions D-0001..D-0022.
- Provider/sponsor schemas cannot leak into core domain contracts.
- Domain package has zero framework/provider/database dependency.
- Financial authority is deterministic and structured.
- AI has zero authorization role in M01.
- No key custody.
- Fail closed.
- Immutable active policy versions.
- Explicit UNKNOWN/RECOVERY_REQUIRED.
- No blind retry.
- Mainnet execution disabled.
- Demo and production trust domains remain separated.
- Prefer the fewest deployables/dependencies that satisfy the DoD.
- No dependency is added merely because it may be useful later.

## CONSTRAINTS

- Deadline: M01 is intended as the 03 Oct implementation increment.
- This WO must remain one large module-level PR.
- Do not expand into M02 because time remains.
- Direct dependencies must be exact-pinned after preflight and lockfile committed.
- New dependency with install scripts/native build/known security concern requires explicit evidence.
- No secrets or credentials committed.
- No force-push/history rewrite.
- Executor may correct failures it introduced inside this WO.
- If canonical Checkpoint/Scope/DoD/Architecture/decision changed after execution base, mark Context Lock STALE and STOP for recompile/rebase.

## ACCEPTANCE CRITERIA

1. npm-workspace structure exists exactly or with documented equivalent.
2. Root clean install succeeds from lockfile.
3. All direct M01 dependencies are exact-pinned and preflight evidence exists.
4. Next.js web app builds successfully on the security-patched admitted version.
5. Worker compiles/starts in no-provider safe mode.
6. Domain package contains required core objects and no forbidden dependency.
7. Policy and execution state-transition guards are executable and tested.
8. PolicySchemaV0_1 validates accepted examples and rejects adversarial/unknown fields.
9. Canonical PolicyVersion/ExecutionPlan hash is deterministic across key order.
10. Unsafe numeric representations are prevented/tested for admitted financial values.
11. Config separates browser/server and all four environments.
12. MAINNET_EXECUTION is deterministically blocked in M01.
13. Autonomous execution defaults OFF.
14. Kill switch denies advancement and has typed/auditable reason metadata.
15. Demo-only context cannot satisfy production authorization.
16. PostgreSQL/Drizzle migration foundation works on a clean DB.
17. M01 foundational tables and integrity constraints exist; no provider-specific premature schema.
18. Structured correlation logging works and sensitive-field redaction tests pass.
19. Health/live and health/ready surfaces work.
20. Deterministic fixtures use injected time.
21. Workspace dependency graph has no cycles.
22. lint/typecheck/unit/invariant/build/migration tests pass.
23. Windows bounded domain/config suite passes.
24. npm audit has no unresolved HIGH/CRITICAL attributable to M01.
25. No wallet/LLM/Perpl/Envio trading dependency exists.
26. No financial transaction construction/submission path exists.
27. Existing GEF 1.1.2 validation remains green.
28. Source Pack validation remains green.
29. Evidence Bundle records base/head, exact package versions, changed files, test counts, CI runs, security/dependency findings, known risks and Checkpoint Delta proposal.
30. Exact-head audit finds CRITICAL/HIGH = 0.

## TESTS / PROOF OBLIGATIONS

Minimum named proof cases:
- `M01-DOM-001` branded identifiers reject cross-domain accidental use at compile-time/test fixture boundary.
- `M01-POL-001` invalid policy cannot reach VALIDATED.
- `M01-POL-002` material revision produces new version/hash.
- `M01-POL-003` unknown fields/schemas fail closed.
- `M01-AUTH-001` plan beyond policy authority is REFUSED.
- `M01-AUTH-002` mismatched plan digest/policy version is REFUSED.
- `M01-STATE-001` illegal policy transition is refused.
- `M01-STATE-002` illegal execution transition is refused.
- `M01-DATA-001` STALE/UNKNOWN required state cannot become ELIGIBLE.
- `M01-IDEMP-001` duplicate idempotency/effect identity cannot advance twice.
- `M01-REC-001` UNKNOWN effect cannot auto-retry.
- `M01-KILL-001` kill switch blocks progression.
- `M01-ENV-001` MAINNET_EXECUTION is blocked.
- `M01-DEMO-001` demo context cannot authorize production.
- `M01-CFG-001` malformed critical config fails startup.
- `M01-SEC-001` logger redacts sensitive fields.
- `M01-SEC-002` browser bundle/config cannot expose server secrets.
- `M01-DB-001` migrations apply to empty PostgreSQL and constraints hold.
- `M01-DET-001` canonical serialization/hash is deterministic.
- `M01-CI-001` forbidden provider/wallet/LLM imports are absent.
- `M01-BOOT-001` web/worker health paths boot without external integrations.

## DELIVERABLES

- complete M01 source tree;
- exact dependency lock;
- migrations;
- tests/fixtures;
- CI/security workflow(s);
- local/deployment skeleton;
- updated developer README/runbook sections required by actual behavior;
- `.engineering/evidence/NERVA-WO-002-EVIDENCE.md`;
- `.engineering/checkpoint-deltas/NERVA-WO-002-PROPOSED.md`;
- any necessary M01 ADR only if implementation discovers a decision not already covered;
- updated PR # generated for this branch.

Executor MUST commit and push implementation/evidence to this branch and update the existing PR. Do not merge.

## REVIEW FORMAT

Final executor report in pt-BR:
- base SHA / head SHA;
- objective scope completed;
- files/packages;
- architecture decisions actually implemented;
- all tests/checks with counts/status;
- security/dependency results;
- failures found and corrections performed;
- remaining risks;
- Evidence Bundle location;
- proposed Checkpoint Delta;
- explicit STOP CONDITION.

Auditor compares exact head against Source Pack + this WO, not against conversation memory.

## STOP CONDITION

Stop satisfied at:

`NERVA_M01_PLATFORM_FOUNDATION_READY_FOR_AUDIT`

Do not begin M02. Do not merge. Do not promote canonical Checkpoint. Any unresolved CRITICAL/HIGH => `CORRECTION_REQUIRED` or `BLOCKED`, never completion.
