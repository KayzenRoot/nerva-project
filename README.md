# NERVA Project

NERVA is a Monad-native, non-custodial risk and policy platform. M04 is approved for promotion/merge and adds wallet/agent identity, bounded capability grants, owner-signed EIP-712 authorization, read-only EIP-7702 observation, session/revocation/replay protection and verifiable permission evidence integrated with the M03 boundary. M05 remains NOT_ADMITTED.

The current Perpl documentation grants only broad `trade` scope to order writes and requires separate on-chain order-forwarding permission; NERVA has no proven protective-only write scope, so the Perpl effect adapter stays hard-blocked. `LIQUIDATION_DISTANCE`, `MAINTENANCE_MARGIN` and `FUNDING_DIRECTION` remain unproven/unknown and cannot authorize actions. See [M02 Observation and Risk Operations](docs/M02-OBSERVATION-RISK.md) and [M03 Policy, Simulation and Execution Safety](docs/M03-POLICY-SIM-EXEC.md).

## Governance

This GREENFIELD project is governed by **GEF Bootstrap 1.1.2**.

Start here:

1. [Source Hierarchy](.engineering/SOURCE-HIERARCHY.md)
2. [Checkpoint](.engineering/CHECKPOINT.md) and [Checkpoint JSON](.engineering/CHECKPOINT.json)
3. [Decisions Ledger](.engineering/DECISIONS-LEDGER.md)
4. [Scope](.engineering/SCOPE.md)
5. [Definition of Done](.engineering/DEFINITION-OF-DONE.md)
6. [Architecture](.engineering/ARCHITECTURE.md)
7. [Requirements](.engineering/REQUIREMENTS.md)
8. [Security](.engineering/SECURITY.md)
9. [Module Roadmap](.engineering/MODULE-ROADMAP.md)

M01 evidence is in `.engineering/evidence/NERVA-WO-002-EVIDENCE.md`. M02 evidence and its promoted Checkpoint Delta are in `.engineering/evidence/NERVA-WO-003-EVIDENCE.md` and `.engineering/checkpoint-deltas/NERVA-WO-003-PROPOSED.md`. M03 evidence is maintained in `.engineering/evidence/NERVA-WO-004-EVIDENCE.md`. M04 implementation and re-audit evidence is maintained in `.engineering/evidence/NERVA-WO-005-EVIDENCE.md`.

## Local development

Requirements: Node.js 22 or newer, npm, and Docker Compose.

```powershell
npm ci
Copy-Item .env.example .env
docker compose up -d db worker
$env:DATABASE_URL = "postgresql://nerva:nerva@127.0.0.1:5432/nerva"
npm run db:smoke
npm run dev:web
```

The web shell runs at `http://localhost:3000`. `/api/health/live` reports process liveness. `/api/health/ready` returns ready only after PostgreSQL responds. The worker defaults to observation disabled. To enable Perpl public collection, configure the server-only variables in `.env` and set `PERPL_OBSERVATION_ENABLED=true`; PostgreSQL must also be configured. Account and position reads remain unavailable without the optional API key, secret, and exact `read` scope. To run the worker outside Compose, use `npm run worker:start`.

The product interface defaults to English and includes Brazilian Portuguese and Spanish. Use the `EN`, `PT`, and `ES` links in the shell to switch language; unsupported locale values fall back to English.

The `.env.example` contains `replace-me` placeholders for local development; Compose fallback credentials are local only. Replace local values before sharing an environment, keep production credentials out of source, and pass them through the deployment secret store.

## M01 safety guarantees

- Structured policies use the strict `PolicySchemaV0_1`; unknown fields and unsupported versions fail closed.
- Policy transitions validate the strict V0.1 payload, reject expired policy versions, and bind confirmation to an immutable version hash. Eligibility and execution transitions derive authority, version identity, expiry, and digest from factory-issued immutable policy and plan values instead of caller-supplied success flags.
- Canonical serialization sorts object keys; policy and plan digests use SHA-256. Basis-point values are bounded integers; notionals use decimal strings or `bigint` domain values.
- `MAINNET_EXECUTION` is rejected at process startup. Execution defaults OFF; the persisted `GLOBAL_EXECUTION_DISABLED` control is seeded enabled.
- Audit events and policy versions are append-only in PostgreSQL. M03 adds immutable policy confirmations, lifecycle/evaluation/simulation/plan/provenance/idempotency/attempt/receipt records with database mutation guards.
- Logs carry a correlation ID and redact common authorization, token, key, seed, and password fields.
- M03 admits only `REDUCE_POSITION`, `CLOSE_POSITION` and `NO_ACTION`; actor proofs bind exact policy/plan scopes, and replay nonces persist across restarts. Unproven signals, stale/unknown simulations, missing position binding, missing exact Perpl scope, kill-switch state and ambiguous outcomes fail closed.
- Mainnet financial effects are hard-blocked. The application has no wallet transaction-signing path. Perpl write submission is intentionally unavailable until official provider documentation proves a protective-only capability.

## Validation commands

```powershell
npm run context:validate
npm run workspace:validate
npm run deps:boundary
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run db:check
npm run db:smoke
npm run risk:benchmark
npm run security:audit
npm run security:client-bundle
npm run smoke:boot
npm run sourcepack:validate
npm run gef:package:verify
npm run gef:verify
npm run m03:safety:verify
npm run db:upgrade-smoke
```

Hosted CI runs the full Linux checks against an ephemeral PostgreSQL 18.6 instance, including a clean M01-to-M03 schema build and a disposable accepted-M02-to-M03 migration upgrade, deterministic replay/adversarial/recovery fixtures, and a one-position p95 risk benchmark. A bounded Windows lane covers domain, contracts, config, policy, execution, Perpl adapter and risk engine. External provider availability and credentials are not required in CI; no live testnet effect is represented by fixtures.

## Additional contracts

- [Integration Contracts](.engineering/INTEGRATION-CONTRACTS.md)
- [Data Model](.engineering/DATA-MODEL.md)
- [API Contracts](.engineering/API-CONTRACTS.md)
- [UI/UX](.engineering/UI-UX.md)
- [Migration & Recovery](.engineering/MIGRATION-RECOVERY.md)
- [Test & Benchmark Plan](.engineering/TEST-BENCHMARK-PLAN.md)
- [Deployment](.engineering/DEPLOYMENT.md)
- [Competition Strategy](.engineering/COMPETITION-STRATEGY.md)
- [Monetization](.engineering/MONETIZATION.md)
- [90-Second Demo Contract](.engineering/DEMO-CONTRACT.md)
- [Backlog](.engineering/BACKLOG.md)
