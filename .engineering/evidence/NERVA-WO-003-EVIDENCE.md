# NERVA-WO-003 Evidence Bundle

- Status: `APPROVED` — governance promotion in progress
- Issue / PR: [#7](https://github.com/KayzenRoot/nerva-project/issues/7) / [#8](https://github.com/KayzenRoot/nerva-project/pull/8)
- Work Order: `NERVA-WO-003`
- Module: `M02`
- Execution branch: `feat/nerva-wo-003-m02-data-risk`
- Execution base / `origin/main`: `166789a107dff6700b7dfab8f240184be14fe3c4`
- Admitted Work Order head: `9e329e78ab4ff3ab0b0b96deed29064a6a03126a`
  The executor reports the final pushed head and exact-head GitHub checks alongside this bundle; the branch remains open for audit.

## Governance and scope

- `npm run context:validate` — PASS. Exact execution base and `origin/main` match; branch and admitted Work Order/Context Lock match; all 19 critical fingerprints and 15 immutable governance files validate. State: `M02_EXECUTION_LOCK_VALIDATED_CHECKPOINT_UNPROMOTED`.
- `npm run sourcepack:validate` — PASS. 34 required files, 7 modules; Source Pack remains canonical v0.1, M01 remains approved, next work order remains `NOT_ADMITTED`.
- `.engineering/CHECKPOINT.md` and `.engineering/CHECKPOINT.json` were not promoted. `.engineering/checkpoint-deltas/NERVA-WO-003-PROPOSED.md` is a proposed, unapplied M02 delta. No M03 work is included.
- Trading, order placement, wallet keys, transaction signing/submission, and execution were not implemented. Perpl API Ed25519 authentication is limited to the user's explicitly authorized read-only API scope `read`.

## Provider capability and source preflight

At provider-docs revision [`25ab6e2c75c8f84d0550da8c3be30af49ad631f2`](https://github.com/PerplFoundation/api-docs/tree/25ab6e2c75c8f84d0550da8c3be30af49ad631f2), the adapter implements public context and ticker GETs, authenticated position/wallet/portfolio GETs, public market and funding WebSocket subscriptions, and read-scoped account WebSocket authentication. The test suite checks request canonicalization/signature, scope refusal, bounded retry, HTTP status classes, large integer preservation, and sequence behavior. No Perpl account credentials were configured, so authenticated live reads were not attempted and are not represented as successful.

The optional public live smoke completed against Monad mainnet chain ID 143: 11 markets in context and 11 ticker market entries, using `/v1/pub/context` and `/v1/market-data/ticker`. Result: `ok=true`, `authenticated=false`. The smoke sends only public GET requests and emits no credentials.

### Dependency lock

The Perpl and Risk workspace packages add no third-party runtime dependencies; each depends only on `@nerva/domain@0.1.0`. `package-lock.json` is npm lockfile v3 and locks the workspace tree. Relevant exact installed/locked top-level versions: Next.js `16.3.8`, React `19.3.0`, `pg` `8.23.1`, `drizzle-orm` `0.45.3`, `drizzle-kit` `0.31.11`, Vitest `5.0.3`, TypeScript `6.0.3`, ESLint `10.10.0`, and `tsx` `4.23.15`. `npm ls --all` completed successfully before final verification.

The normalization boundary preserves integer lexemes, Q16 entry-price residue, provider timestamps, source block when present, received time, optional stream session/sequence, quality, correlation ID, and canonical SHA-256 content identity. Amount-to-micros conversion truncates collateral/account display units down to micros; exposure notional rounds up to micros. No financial calculation uses binary floating point.

## Freshness, sequence, reconnect, and health

- Market and account heartbeats require an established baseline and contiguous sequence/session progression. A gap, session change, disconnect, malformed frame, or stale heartbeat invalidates freshness; the stream closes/reconnects and the worker requests a fresh REST observation.
- Reconnect delays use configured bounded backoff. Subscription acknowledgement has a timeout. Reconnect count, last sequence, session ID, quality, observed time, and reason are persisted as provider checkpoints.
- Required-source age uses the older of event/source time and receive time against the injected evaluation time. A stale/unknown required source leaves the risk snapshot non-actionable.
- Public REST health is recorded independently from authenticated account REST health. Missing credentials leave public market observation available and account state `UNAVAILABLE`.
- Replay cases cover heartbeat acceptance, sequence gap, disconnect invalidation, resnapshot baseline, same-`feb` funding update, and status handling.

## Risk metrics and limits

All evaluations are pure, fixed-point/integer, deterministic for identical inputs and clock, hashed, and emitted with `actionable: false`.

| Metric                                | Method and unit                                                                                                                 | Source and limitation                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `SOURCE_FRESHNESS_MS`                 | `max(0, generatedAt - observedAt, generatedAt - receivedAt)`; milliseconds                                                      | Each required source; status is checked against the configured freshness budget.                                                         |
| `ACCOUNT_COLLATERAL_MICROS`           | Exact provider collateral converted to micro-units                                                                              | Perpl wallet/account snapshot; unavailable or no-account has no numeric value.                                                           |
| `POSITION_NOTIONAL_MICROS`            | `ceil(size × mark / 10^(sizeDecimals + priceDecimals - 6))` when scale exceeds six, otherwise exact multiplication; micro-units | Perpl position plus current market mark; rounds up conservatively.                                                                       |
| `POSITION_ADVERSE_MOVE_BPS`           | Long: `max(0, entry - mark) / entry`; short: `max(0, mark - entry) / entry`; basis points                                       | Mark-to-entry only; excludes fees, realized PnL, and accrued funding. Values above 100% are preserved as exact integer strings.          |
| `POSITION_COLLATERAL_TO_NOTIONAL_BPS` | Observed position collateral / mark notional; basis points                                                                      | Descriptive ratio only; not maintenance margin or liquidation buffer.                                                                    |
| `POSITION_CONCENTRATION_BPS`          | Position notional / total notional; basis points                                                                                | Emitted only for a common quote token; cross-token conversion is unavailable.                                                            |
| `PORTFOLIO_DRAWDOWN_BPS`              | Peak-to-current over the supplied chronological period; basis points                                                            | Requires at least two chronological equity points; no series yields `UNKNOWN`.                                                           |
| `FUNDING_RATE_MICROS`                 | Provider funding rate lexeme; micro-units                                                                                       | Current observed interval. `feb` is the interval identity and repeated updates replace the same interval.                                |
| `FUNDING_DIRECTION`                   | `UNKNOWN`                                                                                                                       | Perpl `ppl` is SPrice; account debit and position-side semantics are not proven by this API mapping. No accrued funding PnL is inferred. |
| `MARGIN_SAFETY`                       | `UNKNOWN`                                                                                                                       | Maintenance-margin inputs and scaling are not proven for the current API mapping.                                                        |
| `LIQUIDATION_DISTANCE_BPS`            | `UNKNOWN`, status `UNAVAILABLE_UNPROVEN`                                                                                        | No distance is computed or emitted as numeric because the exact Perpl API-to-SDK margin/funding mapping is unproven.                     |

The official [Monad current-facts source](https://docs.monad.xyz/ai/current-facts) identifies mainnet 143 and testnet 10143. Envio was deferred: no target-specific Perpl ABI/event evidence was established that would improve authoritative Perpl account/position/market state; indexed EVM data is advisory only. An advisory `IndexedEvidenceReferenceM02Schema` seam is covered by contract validation.

## Persistence, APIs, and dashboard

- Drizzle migration `0001_useful_hobgoblin.sql` adds append-oriented market, position, portfolio, risk snapshot/metric, and provider checkpoint evidence. Provider checkpoints are current stream state; observation and risk evidence is append-only.
- Clean PostgreSQL migration and M01-to-M02 upgrade smoke both passed. The schema verifier reports 11 tables, integrity/append-only triggers present, execution disabled by default, zero credential-shaped columns, and zero order/execution/wallet-key tables. The M01→M02 path verifies five M02 append-only triggers.
- Web APIs expose GET-only health, integration, market context, risk portfolio and position reads. No POST/PUT/PATCH/DELETE financial route exists. Responses distinguish `NO_ACCOUNT`, `NO_POSITION`, `STALE`, and `UNAVAILABLE` and never include credentials.
- Dashboard copy defaults to English; explicit supported locales are Brazilian Portuguese (`pt-BR`) and Spanish (`es`). Missing observations render unavailable states. Demo mode is visibly labeled and demo data is not called live.

## Named proof cases

All cases are covered by unit/replay/integration tests unless marked as runtime-only below:

| Work Order case                           | Evidence                                                                                                                                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M02-PERPL-001` / `DATA-001` / `DATA-002` | Context/market normalization, malformed payload rejection, deterministic provenance/hash, optional sequence/session/quality propagation.                                                                         |
| `M02-PERPL-002` / `PERPL-003` / `SEC-002` | Read scope only; trade scope refusal; credential-shaped database payload rejection; client asset secret scan. No live key was configured.                                                                        |
| `M02-REST-001..004`                       | Bounded 429 retry; 503 as degraded; 401/403 refused without retry storm; 404/no-account distinct from outage.                                                                                                    |
| `M02-WS-001..003`                         | Contiguous heartbeat accepted; gap/session mismatch invalidates freshness; disconnect invalidates old state; reconnect/resnapshot replay.                                                                        |
| `M02-FUND-001`                            | Repeated `feb` replaces the same market interval deterministically.                                                                                                                                              |
| `M02-NUM-001`                             | Exact large integer parsing, Q16 residue, micros conversion and fixed-point notional/adverse-move vectors.                                                                                                       |
| `M02-RISK-001..006`                       | Repeated inputs produce the same hashed result; stale input is non-actionable; long/short movement; peak-to-current drawdown; funding direction remains unknown; liquidation is explicitly unavailable/unproven. |
| `M02-DB-001`                              | Clean migration and M01 migration upgrade both pass.                                                                                                                                                             |
| `M02-WORKER-001`                          | Worker lifecycle test and safe-mode boot smoke; worker remains in Observation Mode with execution disabled.                                                                                                      |
| `M02-API-001`                             | GET-only unavailable/empty-state API tests, with account/position status distinctions.                                                                                                                           |
| `M02-SEC-001..002`                        | Static forbidden-path scan and client bundle scan; database verifier finds no credentials or write-path tables.                                                                                                  |
| `M02-PERF-001`                            | 1,000 timed evaluations after 100 warmups, one position per evaluation; includes canonical SHA-256 identity; p95 `0.914 ms`, target `<=100 ms`.                                                                  |

## Local verification record

| Check                                               | Result                                                                                                                                                                                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                              | PASS                                                                                                                                                                                                                                   |
| `npm run lint`                                      | PASS, zero warnings                                                                                                                                                                                                                    |
| `npm run typecheck`                                 | PASS                                                                                                                                                                                                                                   |
| `npm test -- --reporter=dot`                        | PASS, 18 files / 70 tests                                                                                                                                                                                                              |
| `npm run build`                                     | PASS, Next.js web and worker TypeScript build                                                                                                                                                                                          |
| `npm run workspace:validate`                        | PASS, 10 workspaces; acyclic dependency graph                                                                                                                                                                                          |
| `npm run deps:boundary`                             | PASS; 0 forbidden imports, 0 execution paths, Perpl REST methods `GET`, no mutating API routes                                                                                                                                         |
| `npm run db:check`                                  | PASS                                                                                                                                                                                                                                   |
| `npm run security:client-bundle`                    | PASS; 12 client assets scanned, no server secret material                                                                                                                                                                              |
| `npm run risk:benchmark`                            | PASS; 1,000 iterations, p95 `0.914 ms`                                                                                                                                                                                                 |
| `npm run perpl:smoke`                               | PASS; public mainnet read, 11 context/ticker markets; unauthenticated                                                                                                                                                                  |
| `npm run gef:package:verify` / `npm run gef:verify` | PASS; GEF package 1.1.2 and local state                                                                                                                                                                                                |
| `npm run security:audit`                            | PASS at `--audit-level=high`; zero high/critical, four moderate findings in the existing `drizzle-kit` → `@esbuild-kit`/`esbuild` toolchain; no force-upgrade applied                                                                  |
| `npm run smoke:boot`                                | PASS; standalone web server, all three locales, and Observation Mode worker start correctly. With no local database, readiness fails closed with `globalExecutionDisabled: true`; hosted Linux CI covers healthy PostgreSQL readiness. |

Hosted CI consists of Linux PostgreSQL clean/upgrade, full test/build/security/safe-mode lanes and a bounded Windows test/typecheck lane. Exact-head statuses are recorded from PR #8 checks after the push; do not reuse checks from a previous SHA.

## Changed-file inventory

The changed paths in the implementation diff are:

- `.engineering/checkpoint-deltas/NERVA-WO-003-PROPOSED.md`
- `.engineering/evidence/NERVA-WO-003-EVIDENCE.md`
- `.engineering/execution-briefs/NERVA-WO-003-CODEX.md`
- `.env.example`
- `.github/scripts/boot-smoke.mjs`
- `.github/scripts/check-no-forbidden-deps.mjs`
- `.github/scripts/migration-from-m01.mjs`
- `.github/scripts/perpl-public-smoke.mjs`
- `.github/scripts/risk-benchmark.ts`
- `.github/scripts/validate-nerva-context-lock.mjs`
- `.github/scripts/validate-source-pack.mjs`
- `.github/scripts/validate-workspaces.mjs`
- `.github/scripts/verify-db-schema.mjs`
- `.github/workflows/m01-ci.yml`
- `README.md`
- `apps/web/package.json`
- `apps/web/src/app/api/integrations/health/route.test.ts`
- `apps/web/src/app/api/integrations/health/route.ts`
- `apps/web/src/app/api/market/context/route.ts`
- `apps/web/src/app/api/risk/portfolio/route.test.ts`
- `apps/web/src/app/api/risk/portfolio/route.ts`
- `apps/web/src/app/api/risk/positions/[positionId]/route.ts`
- `apps/web/src/app/dashboard-copy.test.ts`
- `apps/web/src/app/dashboard-copy.ts`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/i18n.ts`
- `apps/web/src/app/styles.css`
- `apps/worker/package.json`
- `apps/worker/src/worker.test.ts`
- `apps/worker/src/worker.ts`
- `docs/M02-OBSERVATION-RISK.md`
- `package-lock.json`
- `package.json`
- `packages/config/src/environment.test.ts`
- `packages/config/src/index.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/observation.test.ts`
- `packages/db/migrations/0001_useful_hobgoblin.sql`
- `packages/db/migrations/meta/0001_snapshot.json`
- `packages/db/migrations/meta/_journal.json`
- `packages/db/src/index.ts`
- `packages/db/src/observations.test.ts`
- `packages/db/src/observations.ts`
- `packages/db/src/schema.test.ts`
- `packages/db/src/schema.ts`
- `packages/domain/src/index.ts`
- `packages/perpl/fixtures/empty-portfolio.json`
- `packages/perpl/fixtures/funding-updates.json`
- `packages/perpl/fixtures/malformed-market.json`
- `packages/perpl/fixtures/market.json`
- `packages/perpl/fixtures/position-long.json`
- `packages/perpl/fixtures/position-short.json`
- `packages/perpl/fixtures/rest-responses.json`
- `packages/perpl/fixtures/sequence-gap.json`
- `packages/perpl/package.json`
- `packages/perpl/src/client.test.ts`
- `packages/perpl/src/client.ts`
- `packages/perpl/src/normalizer.test.ts`
- `packages/perpl/src/normalizer.ts`
- `packages/perpl/src/replay.test.ts`
- `packages/risk/package.json`
- `packages/risk/src/engine.test.ts`
- `packages/risk/src/engine.ts`
- `packages/risk/src/index.ts`
- `tsconfig.json`

The PR #8 diff is the authoritative Git path inventory after push.

## Remaining limits and proposed stop

- Authenticated live Perpl account/position/portfolio smoke remains unverified because no read-scoped API credential was supplied. Local signature and transport contracts are tested with deterministic inputs.
- Liquidation distance and maintenance margin are `UNAVAILABLE_UNPROVEN`; funding direction and accrued funding PnL remain unknown.
- Four moderate existing toolchain audit findings remain; no high/critical finding is attributed to M02.
- Proposed Checkpoint Delta is review-only and unapplied. Canonical Checkpoint remains M01; M02 is not promoted; M03 has not started.

Stop marker: `NERVA_M02_DATA_RISK_READY_FOR_AUDIT`

## Auditor receipt — 2026-10-02

- Verdict: `APPROVED`.
- Audited head: `3d6f0e2d9b6f5558fc1c4472497f6c09056dca19`.
- Foundation run `37078915766`: `SUCCESS`.
- GEF 1.1.2 run `37078915746`: `SUCCESS`.
- Source Pack run `37078915777`: `SUCCESS`.
- Socket Security PR Alerts: `SUCCESS`.
- Socket Security Project Report: `SUCCESS`.
- Tests: 70/70 across 18 files.
- Risk benchmark p95: 0.914 ms.
- Public Perpl smoke: chain 143, 11 context markets, 11 ticker markets.
- Introduced HIGH/CRITICAL findings: 0.

### Carry-forward

- Authenticated live account reads remain unverified.
- Future Perpl credentials require enrollment evidence for intended scope.
- Local `PERPL_API_KEY_SCOPE=read` is not provider-side scope provenance.
- Four MODERATE Drizzle Kit/esbuild advisories remain below the current gate.
- Funding direction remains `UNKNOWN`.
- Maintenance margin remains `UNKNOWN`.
- Liquidation distance remains `UNAVAILABLE_UNPROVEN`.
- Envio remains deferred.

This approval authorizes M02 checkpoint promotion and merge only.
It does not admit M03.

## Post-merge Correction Delta

- Merge: `402e52922dc88bfac155260e50a0c4019ed57067`.
- The squash tree exactly matches validated promotion tree `11c52ef782c4ceabde14dc12f1c5e8f4af5c36b1`.
- Initial post-merge Linux validation failed only on Git ancestry logic.
- Cause: squash merge preserves the validated tree but not PR commit ancestry.
- Runtime, dependencies, schemas, tests, and product behavior are unchanged.
- Correction validates the accepted squash tree and permits only evidence/validator paths.
- M03 remains `NOT_ADMITTED` until this correction is merged and post-merge checks pass.
