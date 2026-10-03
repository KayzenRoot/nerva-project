# NERVA-WO-004 Evidence Bundle

- Status: `IMPLEMENTATION EVIDENCE — READY FOR AUDIT WITH PRESERVED BASELINE FORMAT FAILURE`
- Issue: [#10](https://github.com/KayzenRoot/nerva-project/issues/10)
- Pull request: [#11](https://github.com/KayzenRoot/nerva-project/pull/11) (draft; no merge)
- Work Order: `NERVA-WO-004`
- Module: `M03 — Policy Compiler, Simulation & Autonomous Execution`
- Execution branch: `feat/nerva-wo-004-m03-policy-sim-exec`
- Execution base SHA: `31cce06cf68aab0a82d3801ed6177b8a3b311869`
- Candidate HEAD SHA: recorded in the exact current PR #11 revision/body; no source change follows this evidence closeout.
- Context Lock fingerprints: `36`; pre-code validation passed on the execution branch against the exact base.
- Checkpoint: unchanged; M03 was not promoted.

## Scope implemented

- Strict M03 policy and actor-proof schemas; canonical compiler; proposal-only natural-language input; immutable confirmed versions; pause/revoke lifecycle; deterministic trigger evaluation, cooldown, bounded planning and dry-run simulation.
- Only `REDUCE_POSITION`, `CLOSE_POSITION` and `NO_ACTION` compile. `MAINNET_EXECUTION` is rejected; `MAINNET_READONLY` is `NO_ACTION` only. Unproven liquidation distance, maintenance margin and funding direction cannot trigger or authorize a plan.
- Ed25519 issuer verification uses an explicit trusted public-key registry. Policy, control, execution-authorization and enrollment nonces use the durable hashed nonce ledger. Invalid/unknown issuer state fails closed.
- Durable plans, synthetic simulations, idempotency claims, attempt events, receipts and recovery status use append-only M03 migrations and mutation guards. Kill-switch changes serialize with the effect-admission boundary; missing state disables admission.
- API routes expose proposal, compile, confirmation, policy control, evaluation, planning, simulation, refusal, recovery and read-only status. `/policies` and `/flight-recorder` show status in English by default, with Brazilian Portuguese and Spanish.
- M03 execution engine provides a bounded testnet-only adapter port with mainnet checks, exact-plan preflight, actor authorization, provider enrollment, nonce replay protection, durable idempotency, atomic kill-switch admission and no-retry recovery.

## Provider/network preflight and effect status

Current primary documentation was reviewed on `2026-10-03`:

- [Perpl API documentation](https://github.com/PerplFoundation/api-docs)
- [Perpl authentication](https://github.com/PerplFoundation/api-docs/blob/main/authentication.md)
- [Perpl API-key scopes and integrations](https://github.com/PerplFoundation/api-docs/blob/main/integrations.md)
- [Perpl REST endpoints](https://github.com/PerplFoundation/api-docs/blob/main/rest-endpoints.md)
- [Monad testnet documentation](https://docs.monad.xyz/developer-essentials/testnet)
- [Monad testnet RPC](https://testnet-rpc.monad.xyz), read-only `eth_chainId` returned `0x279f` (`10143`).

Perpl documents `read`, `trade`, and `read | trade` API scopes. `trade` permits placing, changing and cancelling orders and implies read. REST writes use `POST /api/v1/trading/orders`; trading WebSocket writes also require `trade`. API order forwarding additionally requires a separate account-level on-chain permission. No protective-only Perpl write scope or provider simulation operation was documented by the review. The implementation therefore allowlists no Perpl write scope and ships no live Perpl effect adapter. The engine and tests do not claim a live effect.

- Provider/environment: Perpl TESTNET, Monad chain `10143` — documented identity only.
- Disposable test account: `NOT PROVIDED`.
- Provider-side enrollment and protective-only scope proof: `UNAVAILABLE_UNPROVEN`.
- M02 position snapshots do not contain an authenticated account-ownership binding. Protective plan/simulation APIs refuse and append a correlated planning-refusal receipt until a provider-backed binding verifier is available.
- Trusted production actor issuer configuration: `NOT PROVIDED`; API mutation paths return typed unavailable/refusal until configured.
- Live provider preflight or financial effect: `NOT RUN`; no credentials, API-key private key, wallet key or account were supplied. No order, transaction signature, mainnet call or financial effect was attempted.
- Effectful readiness: `BLOCKED_NO_DOCUMENTED_PROTECTIVE_ONLY_PERPL_SCOPE`.

## Security and limitation results

- `HIGH_ASSURANCE`: maintained.
- Mainnet effectful execution: hard-blocked in configuration, policy validation/planning, dispatch boundary and static CI gate.
- LLM authority: none; proposals are untrusted and do not activate policies.
- `LIQUIDATION_DISTANCE`, `MAINTENANCE_MARGIN`, `FUNDING_DIRECTION`: `UNAVAILABLE_UNPROVEN` / `UNKNOWN`; not execution authority.
- Unknown/stale/mismatched simulation: refuses; dry run is labeled `DRY_RUN_ONLY` and cannot satisfy provider preflight.
- Kill switch: rechecked before authorization and immediately at an atomic admission gate; unavailable state refuses.
- Ambiguous result: `UNKNOWN` / `RECOVERY_REQUIRED`; no blind retry; recovery endpoint records unresolved state without provider resubmission.
- Perpl capability: only the port and closed refusal path are implemented. No live effect adapter is enabled because current provider documentation does not prove protective-only write semantics or scope.
- M04: not started. Checkpoint promotion: not performed. Merge: not performed.

## Tests, checks and hosted evidence

The following results were collected on the complete candidate source tree before commit. Exact hosted status is linked to the current PR head; results from the M02 SHA or an earlier M03 candidate do not transfer.

| Check                                                    | Command / source                                                                        | Result                                                                                                                          |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Context Lock and base fingerprints                       | `npm run context:validate`                                                              | `PASS` — exact base; 36 fingerprints                                                                                            |
| Source Pack and GEF 1.1.2                                | `npm run sourcepack:validate`, `npm run gef:package:verify`, `npm run gef:verify`       | `PASS` — canonical Source Pack; GEF 1.1.2 package and state                                                                     |
| Workspace/dependency/safety gates                        | `npm run workspace:validate`, `npm run deps:boundary`, `npm run m03:safety:verify`      | `PASS` — 12 workspaces, no forbidden imports, mainnet hard block and closed Perpl write scope                                   |
| Format/lint/types                                        | `npm run format:check`, `npm run lint`, `npm run typecheck`                             | `PARTIAL` — lint/types `PASS`; formatter reports only two untouched, locked M02 artifacts                                       |
| Unit/contract/adversarial/replay/recovery tests          | `npm test -- --reporter=dot`                                                            | `PASS` — 95 tests across 21 files                                                                                               |
| Build, client bundle, dependency security audit          | `npm run build`, `npm run security:client-bundle`, `npm run security:audit`             | `PASS` — build and bundle scan; audit exits at HIGH threshold with 4 MODERATE advisories, no HIGH/CRITICAL findings             |
| Migration integrity and upgrade from accepted M02 schema | `npm run db:check`, `npm run db:smoke`, `npm run db:verify`, `npm run db:upgrade-smoke` | `PASS` — disposable PostgreSQL; clean migration and M02 upgrade; 22 tables, 16 append-only triggers, replay and mutation probes |
| Risk and M03 decision-to-plan benchmarks                 | `npm run risk:benchmark`, `npm run m03:benchmark`                                       | `PASS` — risk p95 `16.478 ms` / `100 ms`; M03 evaluation p95 `8.55 ms` / `50 ms`; decision-to-plan p95 `23.642 ms` / `250 ms`   |
| Safe-mode boot                                           | `npm run smoke:boot`                                                                    | `PASS` — web live but fail-closed/not-ready; worker observation mode; execution disabled                                        |
| Exact-head Linux/Windows hosted checks                   | [PR #11 checks](https://github.com/KayzenRoot/nerva-project/pull/11/checks)             | `LIVE LINK` — inspect current exact PR head; final result is reported in the PR body                                            |
| Dependency scan / CRITICAL-HIGH findings                 | `npm run security:audit` and hosted PR checks                                           | `PASS LOCAL` — no HIGH/CRITICAL npm audit finding; hosted exact-head results are linked above                                   |

The formatter-only failure is limited to the unchanged, locked M02 records `.engineering/evidence/NERVA-WO-003-EVIDENCE.md` and `.engineering/checkpoint-deltas/NERVA-WO-003-PROPOSED.md`. Both remain intact as accepted M02 records outside this Work Order's scope.

## Changed-file inventory and review

The PR body records the exact base and pushed HEAD, full changed-file inventory and hosted check status. This bundle does not treat fixtures, local mocks or historical checks as provider execution evidence.

The review should verify the changed-file inventory and exact base/HEAD from PR #11, provider limitation evidence, test/check URLs, database migration result, and absence of secrets/credential material. No Checkpoint promotion or merge is requested here.

## STOP CONDITION

`NERVA_M03_POLICY_SIM_EXEC_READY_FOR_AUDIT`
