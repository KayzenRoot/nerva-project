# NERVA-WO-004 — M03 Policy Compiler, Simulation & Autonomous Execution

| Field            | Value                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| Status           | ADMITTED — OWNER AUTHORIZED                                           |
| Risk             | HIGH_ASSURANCE                                                        |
| Module           | M03                                                                   |
| Issue            | [#10](https://github.com/KayzenRoot/nerva-project/issues/10)          |
| Execution base   | `main@31cce06cf68aab0a82d3801ed6177b8a3b311869`                       |
| Execution branch | `feat/nerva-wo-004-m03-policy-sim-exec`                               |
| GEF              | `@gef-bootstrap/cli@1.1.2`                                            |
| Primary executor | Codex                                                                 |
| Review language  | pt-BR                                                                 |
| Context Lock     | `.engineering/context-locks/NERVA-WO-004.json` (36 base fingerprints) |

## OBJECTIVE

Implement the complete M03 Policy Plane and bounded simulation/execution path for NERVA V0.1, using the approved M02 observation and deterministic risk foundation. Compile strict structured policies; keep natural-language output untrusted; version and activate policies only after explicit, provenance-verifiable user confirmation; evaluate triggers and create policy-bounded protective plans; require a passing, plan-bound simulation/preflight; and record idempotent execution, refusal, failure, and unknown/recovery outcomes.

Any effectful path is restricted to an isolated controlled testnet environment. Effectful mainnet execution is technically hard-blocked. M03 does not integrate or admit M04 wallet capabilities.

## CONTEXT

At the exact execution base, canonical governance records `M02=APPROVED`, `M03=NEXT`, and `M03 Work Order=NOT_ADMITTED`. M00–M02 are approved. M01 supplies the typed domain, strict policy skeleton, fail-closed environment controls, persistence and CI foundation. M02 supplies provider-neutral snapshots and deterministic risk data; its closeout explicitly leaves `LIQUIDATION_DISTANCE`, `MAINTENANCE_MARGIN`, and `FUNDING_DIRECTION` unproven/unknown and non-actionable.

The approved decisions require deterministic financial eligibility (D-0005/D-0006), fail-closed unknown state (D-0007), correlated evidence (D-0008), immutable confirmed policy versions (D-0009), no blind retry (D-0010), and no autonomous mainnet execution before release approval (D-0011). ADR-0001 keeps LLM output outside financial authority. M04 owns Agent Wallet integration, permissions UX and the fuller verifiable-evidence surface; M04 must not be started or pulled into this Work Order.

This is the M03 implementation specification. Its admission does not change the canonical Checkpoint, promote M03, authorize mainnet effects, or authorize M04.

## SCOPE

### 1. Policy language, compiler and deterministic validator

- Freeze a versioned, strict V0.1 structured policy schema for supported positions and protective triggers. Reject unknown fields, unsupported versions, non-finite/out-of-range values, ambiguous units, invalid expiry/cooldown, unsupported market/protocol identifiers, and unsafe bounds.
- Compile only declarative, bounded predicates into a canonical representation. Do not use `eval`, dynamic code, arbitrary expressions, prompt text, or provider objects as executable policy.
- Bind each validated policy to its canonical bytes/hash, creator, allowed environment/network, markets/positions, trigger, protective action, maximum reducible quantity/notional, slippage bound, cooldown, expiry and fallback/refusal behavior.
- Natural-language input may produce an untrusted proposal and diagnostics only. Display the complete compiled constraints for explicit user review. No model output can confirm, activate, authorize, size, or submit an action.
- Require explicit confirmation for first activation and every material policy change. Confirmed versions are immutable; revision creates a new version and hash. Support deterministic pause/revoke/expire transitions.

### 2. Trigger evaluation and protective action planning

- Evaluate an active immutable policy against one consistent, fresh M02 `RiskSnapshot`; inject time and all nondeterministic dependencies.
- Emit deterministic trigger results and refusal reasons with correlation IDs, snapshot hash, policy-version hash, evaluation time and schema version.
- The complete V0.1 autonomous action set is exactly `REDUCE_POSITION`, `CLOSE_POSITION`, and `NO_ACTION`. `REDUCE_POSITION` must strictly reduce the existing exposure and stay below both policy and current-position bounds. `CLOSE_POSITION` may close only the exact eligible existing position. `NO_ACTION` has no external effect.
- Reject opening/increasing exposure, changing leverage, deposits, withdrawals, transfers, arbitrary orders, market-making, and every action outside the three-value allowlist.
- Bind every candidate `ExecutionPlan` to one policy version, one risk snapshot, one account/position, one environment/network, a bounded quantity/notional and slippage, a short expiry, a deterministic digest and a unique idempotency identity.
- Keep `LIQUIDATION_DISTANCE` at `UNAVAILABLE_UNPROVEN` and `MAINTENANCE_MARGIN` / `FUNDING_DIRECTION` at `UNKNOWN` throughout this Work Order. They are never zero, safe, adverse, or financial authority. A policy that requires any of them must refuse. Any later proof or status upgrade requires separate explicit scope admission; it is not admitted here.

### 3. Simulation and execution preflight

- Provide a deterministic replay/dry-run simulator for fixtures and historical/synthetic scenarios, plus a provider/testnet preflight only when current official provider documentation proves the exact operation and its semantics.
- A simulation result must bind the exact plan digest, policy version, source snapshot, environment/network, simulator/provider version, assumptions, result and expiry. A result for another plan, version, environment or expired input is invalid.
- `PASS` is required before authorization. `UNKNOWN`, missing, stale, inconsistent, timed-out, schema-incompatible or failed simulation/referee state blocks execution and produces a refusal/recovery record. No optimistic fallback is permitted.
- Simulation and fixtures must be visibly distinguishable from provider observations and testnet effects. Synthetic/demo data never reaches an effectful adapter.
- Revalidate current official Perpl REST/auth/trading/testnet documentation and Monad network facts before implementation. Do not assume an M02 read capability, a generic perpetuals formula, an old document snapshot, or a MetaMask/M04 capability proves an effectful operation.

### 4. Authorization and provenance boundary

- Define a narrow authorization port; do not integrate MetaMask Agent Wallet or another M04 wallet in this Work Order.
- Before any effectful testnet operation, verify attributable actor and issuer provenance, audience, environment/network, exact active policy-version hash, exact plan digest, allowed action/scope, expiry/revocation state, nonce/replay identity and proof-validation result. A caller-supplied boolean, display name, local config flag, LLM output, or unverifiable token is not provenance.
- If the trusted actor/authorization issuer or its verification method cannot be established from current documented system evidence, refuse the effect and preserve the failure reason. Do not invent an authorization provider or mark a test double as live authorization.
- Any effectful Perpl testnet credential requires provider-side enrollment and permission/scope provenance for the intended testnet account and exact protective capability. Preserve redacted evidence of issuer, account/environment binding, permissions, issue/expiry/revocation and verification method. A local `*_SCOPE` environment variable is not provider-side proof.
- Keep all credentials runtime-only in an approved secret store. Never persist, log, expose to clients, commit, include in fixtures, or put raw values into evidence. Read-only and effectful credentials/capabilities remain technically separate.

### 5. Bounded effect adapter and environment isolation

- Implement only the provider-neutral protective execution adapter needed for the admitted action set, after live capability preflight. Keep provider schemas behind the adapter and expose explicit capability/health states.
- If Perpl offers an exact protective testnet operation, implement only the documented reduce/close operations supported by the verified scope. Reject a broader permission set. No operation may create new/increased exposure.
- `LOCAL` and `TESTNET/DEMO` configurations remain isolated. The only permitted effectful environment for M03 is controlled `TESTNET` with test-only assets and the provenance gates above. `MAINNET_READONLY` remains read-only.
- `MAINNET` / `MAINNET_EXECUTION` must be hard-blocked in config parsing, plan validation, adapter dispatch and CI/adversarial tests. Runtime credentials, a passing simulation, an authorization proof, or an operator flag cannot override this block. No mainnet order, transaction signature/submission, or other financial effect is permitted; read-only observation remains separate and non-effectful.
- Full wallet connection/signing, wallet permission UX, wallet security features and onchain evidence commitments remain M04 scope and are forbidden here.

### 6. Lifecycle, idempotency, replay protection and recovery

- Implement an explicit execution state machine: `NOT_STARTED → PREFLIGHTED → AUTHORIZED → SUBMITTED → CONFIRMED`, with terminal/refusal states `REFUSED`, `FAILED`, and `UNKNOWN/RECOVERY_REQUIRED`. Unknown state never promotes to success.
- Recheck the kill switch and all critical freshness, policy, authorization, simulation and environment predicates immediately before every external effect. The kill switch wins every race and blocks creation/authorization/submission of new plans; it does not falsely claim to cancel a confirmed effect.
- Enforce unique, domain-scoped idempotency and replay protection across concurrent workers, requests, process restarts and duplicate provider events. Persist the first accepted identity and correlate all subsequent observations to it.
- Never blindly retry an operation that may have caused an effect. A timeout, disconnect or ambiguous provider response becomes `UNKNOWN/RECOVERY_REQUIRED`; only documented read-only status reconciliation or a provider operation with proven idempotency may proceed. Any new protective action after reconciliation requires fresh evaluation and a new plan identity.
- Preserve append-oriented policy, evaluation, simulation, attempt, refusal and receipt evidence. Corrections supersede by link; they do not rewrite confirmed history.

### 7. Persistence, APIs and operator visibility

- Add only M03-owned schema/migrations needed for immutable policy versions, trigger evaluations, plans, simulation results, authorization references, idempotency/effect state and receipts. Prove clean migration and upgrade from the accepted M02 schema. No secret or raw credential table/column.
- Add schema-versioned policy lifecycle, evaluation, simulation and execution APIs with explicit correlation/idempotency IDs, bounded inputs, authorization checks and a typed error algebra. Natural-language endpoints return proposals only. No endpoint may skip deterministic validation, simulation, provenance, kill switch or environment checks.
- Provide read-only status surfaces for current policy/version, evaluation, simulation, attempt state, refusals/recovery and integration health. Never expose secrets or represent an unknown result as successful.
- Record a minimum correlated M03 audit receipt for every attempted action or refusal. M04's full Flight Recorder and verifiable/onchain commitments are not implemented here.

### 8. CI, tests, replay, documentation and Evidence Bundle

- Add deterministic unit, contract, integration, migration, replay, adversarial and recovery coverage for every proof obligation below. Tests must not need external provider availability or secrets.
- Add static/configuration CI gates that prove `MAINNET` effectful execution is impossible, only the three admitted action values exist, unknown simulation/unproven metrics cannot authorize, secrets are absent, and no retry path resubmits an ambiguous effect.
- Include same-snapshot determinism, malformed/adversarial policy, prompt injection, policy revision, stale/unknown risk, action-bound, simulation mismatch/UNKNOWN, missing provenance, revoked/expired authorization, wrong credential scope, kill-switch race, duplicate/replay/concurrency, timeout-after-submit, recovery, migration and environment-crossing cases.
- Document the policy schema, supported actions, proof sources, environment gates, failure states, operator recovery, secret enrollment evidence and known limitations. State that mainnet effects and M04 are unavailable.
- Complete `.engineering/evidence/NERVA-WO-004-EVIDENCE.md` from scaffold with exact base/head, changed files, fingerprints, exact-head CI, proof results, provider/testnet evidence, dependency/security findings, limitations and stop condition. No evidence may be inferred from a fixture or previous SHA.

## OUT OF SCOPE

- Any effectful mainnet operation; mainnet order/transaction signing, submission or financial side effect.
- M04 Agent Wallet/MetaMask integration, wallet custody, seed phrase/private key handling, permission UX, full Flight Recorder or onchain evidence commitments.
- Any action besides `REDUCE_POSITION`, `CLOSE_POSITION`, `NO_ACTION`; new/increased exposure, leverage changes, transfers, deposits, withdrawals, market making, profit-seeking or arbitrary orders.
- Treating `LIQUIDATION_DISTANCE`, `MAINTENANCE_MARGIN`, or `FUNDING_DIRECTION` as proven or actionable in this Work Order. A future status change requires new authoritative Perpl-specific evidence and separate explicit scope admission.
- LLM authorization, autonomous policy confirmation, model-selected size/market/slippage, or free-form instruction execution.
- Blind retry or optimistic success after ambiguous effect state.
- Envio expansion, another protocol, cross-protocol risk, production release, M05/M06 work, Checkpoint promotion, merge, or any M04 work.

## FILES/SOURCES TO READ

Read in this exact authority order before M03 implementation; compare every locked input to the Context Lock and stop if stale:

1. `.engineering/CHECKPOINT.md` and `.engineering/CHECKPOINT.json`.
2. `.engineering/DECISIONS-LEDGER.md` and all approved ADRs.
3. `.engineering/SCOPE.md`.
4. `.engineering/DEFINITION-OF-DONE.md`.
5. `.engineering/ARCHITECTURE.md`.
6. `.engineering/REQUIREMENTS.md`.
7. `.engineering/SECURITY.md`.
8. `.engineering/DATA-MODEL.md`.
9. `.engineering/API-CONTRACTS.md`.
10. `.engineering/INTEGRATION-CONTRACTS.md`.
11. `.engineering/TEST-BENCHMARK-PLAN.md`.
12. `.engineering/MODULE-ROADMAP.md`, `.engineering/BACKLOG.md`, `.engineering/UI-UX.md`, `.engineering/MIGRATION-RECOVERY.md`, `.engineering/DEPLOYMENT.md`, `.engineering/DEMO-CONTRACT.md`, and `.engineering/EXTERNAL-EVIDENCE.md`.
13. `.engineering/work-orders/NERVA-WO-003.md`, its Context Lock, execution brief, Evidence Bundle, proposed Checkpoint Delta, and `docs/M02-OBSERVATION-RISK.md`.
14. This Work Order, `.engineering/context-locks/NERVA-WO-004.json`, and `.engineering/execution-briefs/NERVA-WO-004-CODEX.md`.
15. M01/M02 safety/domain/config/database/worker/API code, current CI and GEF 1.1.2 package/state verifiers.
16. Current official Perpl API, authentication, permission/enrollment, effect operation, idempotency, error, rate-limit and TESTNET documentation; Monad official network/configuration documentation. Capture exact URL, retrieval time/revision, account/environment and proof limitations. Revalidate before coding; current M02 evidence is historical only.

## REQUIREMENTS

- **M03-GOV-001:** Base and branch match the Context Lock exactly; canonical preconditions at the base are M02 `APPROVED`, M03 `NEXT`, M03 Work Order `NOT_ADMITTED`. Any changed base/fingerprint blocks execution.
- **M03-POL-001:** Strict versioned DSL/compiler rejects malformed, unknown, ambiguous and out-of-bound policies without dynamic evaluation.
- **M03-POL-002:** Proposal generation is untrusted. Explicit verified actor confirmation is required; confirmed versions are immutable and revisions receive new hashes.
- **M03-POL-003:** Trigger evaluation is deterministic for the same policy, normalized risk input and injected clock.
- **M03-ACT-001:** The only V0.1 autonomous action values are `REDUCE_POSITION`, `CLOSE_POSITION`, `NO_ACTION`; all other effects are refused.
- **M03-RISK-001:** Keep `LIQUIDATION_DISTANCE=UNAVAILABLE_UNPROVEN` and `MAINTENANCE_MARGIN` / `FUNDING_DIRECTION=UNKNOWN` throughout M03. These states never become favorable defaults or financial authority; a required one fails closed.
- **M03-PLAN-001:** Plans are bounded to the exact active policy, current position, fresh snapshot, environment, expiry and slippage limits; canonical digest is stable.
- **M03-SIM-001:** Simulation is plan-bound and unexpired; only a verified `PASS` can advance. `UNKNOWN` blocks.
- **M03-AUTH-001:** An effect requires verifiable actor/issuer provenance bound to the exact plan, policy, scope, environment and expiry; missing/unverifiable provenance refuses.
- **M03-PERPL-001:** Effectful Perpl credentials require redacted, provider-side enrollment/scope evidence for the exact TESTNET account/capability; local configuration alone is insufficient.
- **M03-ENV-001:** MAINNET effectful execution is hard-blocked independently at config, planning, dispatch and CI layers; controlled TESTNET is the only effectful M03 environment.
- **M03-EXEC-001:** Kill switch and all fail-closed gates are checked at the effect boundary; the kill switch prevails.
- **M03-EXEC-002:** Idempotency/replay suppression survives concurrency and restart; an ambiguous possible effect is never blindly retried.
- **M03-DB-001:** Append-oriented M03 records migrate cleanly and from M02; secrets are absent.
- **M03-API-001:** Mutations are schema-validated, authenticated/authorized and correlated; reads distinguish refusal, failed and unknown/recovery states.
- **M03-CI-001:** GEF 1.1.2, Source Pack, lint/typecheck/build/tests/security/migration and exact-head hosted checks meet their applicable gates; no introduced CRITICAL/HIGH finding remains.
- **M03-EVID-001:** Evidence accurately identifies exact-head proof and provider limitations; fixtures and previous runs are never presented as live testnet execution.
- **M03-DEP-001:** M04 remains blocked; no checkpoint promotion or merge occurs in the M03 execution work.

## ARCHITECTURE RULES

- Preserve all approved decisions, ADRs and M01/M02 invariants; keep provider-specific objects inside adapters and domain/policy/planning logic pure and deterministic.
- Keep proposal, deterministic policy validation, simulation, actor authorization and provider execution as distinct trust boundaries. No one boundary substitutes for another.
- Bind authorization to the canonical plan digest, policy version, exact action/scope, testnet identity and expiry. Do not use caller-supplied success flags.
- Revalidate environment, kill switch, data freshness, simulation identity and authorization immediately before effects.
- Persist auditable correlation and effect state; `UNKNOWN` is never success. Recovery reconciles before any new plan.
- Mainnet is observation-only. There is no configuration flag, fallback, provider exception, emergency bypass, or LLM path that can enable a mainnet effect.
- Keep the M04 wallet adapter as an unimplemented interface boundary only. No M04 runtime code or scope enters M03.

## CONSTRAINTS

- Risk class is `HIGH_ASSURANCE`; any introduced CRITICAL/HIGH defect blocks readiness.
- Effectful mainnet execution is prohibited and hard-blocked, regardless of tests, credentials or operator intent.
- Do not use the three unproven M02 metrics as authority or invent a provider formula.
- Only the three specified actions are permitted; no open/increase or unrestricted order endpoint.
- No LLM authority, blind retry, fake live evidence, stored key material, or testnet-to-mainnet configuration reuse.
- If actor provenance, Perpl scope/enrollment, provider action semantics, simulation result, idempotency, kill switch, or environment identity is unknown, fail closed and record the concrete blocker.
- Mainnet/Perpl capability claims must be revalidated from current primary documentation during implementation. Do not rely on stale local evidence or infer capability.
- Keep corrections within this Work Order/PR; no force-push or history rewrite. Do not alter the canonical Checkpoint, merge the PR or start M04.

## ACCEPTANCE CRITERIA

1. The M03 Work Order and Context Lock are validated against the exact M02-approved base and all locked fingerprints.
2. The policy schema/compiler and deterministic validator reject malformed, unsupported, ambiguous and out-of-policy input.
3. Natural-language proposals cannot activate, confirm, authorize or directly parameterize effects.
4. User-confirmed policy versions are immutable, hashed and auditable; material edits require a new confirmation.
5. Trigger evaluation and plan generation are deterministic and bound to fresh M02 snapshots.
6. Plans contain exact policy/snapshot/account/environment/action identities, hard bounds, expiry, digest and idempotency key.
7. Only `REDUCE_POSITION`, `CLOSE_POSITION`, and `NO_ACTION` are representable in the autonomous V0.1 path; new exposure is rejected.
8. The three M02 unproven metrics retain their required `UNAVAILABLE_UNPROVEN` / `UNKNOWN` states throughout M03 and cannot authorize an action.
9. `PASS` simulation for the exact current plan is required; `UNKNOWN`, stale, mismatched or failed simulation never reaches authorization/effect.
10. Actor/issuer authorization provenance is verified and bound to the exact plan; absent or unverifiable proof refuses.
11. Effectful Perpl testnet access is enabled only with independently verifiable provider enrollment/scope evidence for the exact account/environment/capability.
12. The adapter has no path for effectful `MAINNET`/`MAINNET_EXECUTION`; static and runtime tests prove hard-block behavior even when all other gates pass.
13. The kill switch stops plan authorization/submission at the last effect boundary and wins concurrent races.
14. Duplicate/replayed requests and events cannot cause duplicate effects; persisted idempotency and recovery survive restarts/concurrency.
15. Ambiguous submit/finality is `UNKNOWN/RECOVERY_REQUIRED`; no blind effect retry exists, and recovery uses only proven read/reconcile behavior.
16. M03 evidence and state persistence are append-oriented, secret-free, migrated from clean and accepted M02 schemas, and integrity-checked.
17. APIs and operator read surfaces expose correlation, provenance, freshness, policy/simulation/effect states and limitations without credential material.
18. All required deterministic, adversarial, integration, replay, migration and recovery cases pass without live secrets/provider availability.
19. Controlled TESTNET proof is either safely executed and evidenced using disposable scoped credentials or explicitly blocked with objective provider/account evidence; no fake success is accepted.
20. Applicable format/lint/typecheck/build/test/security/migration gates and exact-head Linux/Windows CI pass; introduced CRITICAL/HIGH findings equal zero.
21. Documentation and the completed Evidence Bundle match the implemented behavior, exact head and tests actually run.
22. Mainnet remains hard-blocked; no checkpoint is promoted, no PR is merged, and M04 remains unstarted.

## TESTS/PROOF OBLIGATIONS

- **M03-POL-001:** strict schema, unknown-field/version, canonicalization, invalid unit, numeric-bound and deterministic compile vectors.
- **M03-POL-002:** proposal/prompt-injection/adversarial content cannot confirm or expand a policy; material revision requires a new confirmation/hash.
- **M03-POL-003:** same policy/input/injected clock produces byte-stable trigger and plan digests.
- **M03-ACT-001:** exhaustive allowlist plus negative cases for open, increase, leverage, transfer, deposit, withdrawal, arbitrary order and unsupported action.
- **M03-RISK-001:** stale/unknown/inconsistent snapshots and every unproven metric fail closed, including zero/null/missing coercion attempts.
- **M03-PLAN-001:** quantity, notional, slippage, expiry, market, position, policy-version and snapshot binding boundaries.
- **M03-SIM-001:** passing exact simulation advances; unknown, timeout, failure, expiry, digest mismatch, wrong environment/version and replay refuse.
- **M03-AUTH-001:** valid, absent, forged, wrong-issuer, wrong-actor, wrong-audience, wrong-scope, wrong-plan, expired, revoked and replayed authorization vectors.
- **M03-PERPL-001:** provider enrollment/scope proof accepted only for exact test account, network, action and interval; local scope claims and broader credentials refuse; redaction verified.
- **M03-ENV-001:** property/contract/static tests prove mainnet hard block at configuration, planner and provider dispatch with otherwise-valid simulation and authorization.
- **M03-EXEC-001:** kill switch before evaluation, between evaluation and authorization, at submit boundary and in concurrent races always prevents a new effect.
- **M03-EXEC-002:** duplicates across API, worker, restart and stream replay map to one attempt; ambiguous submit produces UNKNOWN and no second side effect.
- **M03-REC-001:** reconcile known-confirmed, known-not-submitted, unavailable, reordered and conflicting provider results; only safe fresh reevaluation creates a new plan.
- **M03-DB-001:** clean migration, M02 upgrade, append-only/integrity constraints, no credential-shaped fields and restart persistence.
- **M03-API-001:** proposal-only natural-language route, auth/refusal semantics, idempotency, correlation and no-secret read responses.
- **M03-PERF-001:** record population, hardware and methodology; policy-evaluation p95 target <=50 ms and internal decision-to-ready-plan p95 <=250 ms excluding provider/network latency, unless measured baseline proves a documented blocker.
- **M03-TESTNET-001:** optional live proof uses current documented TESTNET and disposable, independently scoped credentials. If unavailable, capture objective limitation and leave effectful readiness blocked; CI remains deterministic and secret-free.
- Preserve M01/M02 regression proofs. Run the complete existing Linux and bounded Windows CI on the exact candidate SHA. Do not reuse results from another SHA.

## DELIVERABLES

- Strict M03 policy schema/compiler/validator, version lifecycle and deterministic trigger/planner.
- Plan-bound dry-run/simulation/preflight and a protective-only TESTNET execution adapter behind provenance, kill-switch, environment and idempotency gates.
- Append-oriented migrations, policy/evaluation/simulation/attempt/receipt persistence, APIs and status read surfaces.
- Deterministic fixtures, unit/contract/integration/adversarial/replay/recovery/migration tests, CI gates and measured benchmark evidence.
- Current-provider preflight records, operating/recovery/security documentation, and completed `.engineering/evidence/NERVA-WO-004-EVIDENCE.md`.
- Corrections within this same WO/PR only. Commit/push to the admitted branch and update the existing draft PR. Do not merge or promote the Checkpoint.

## REVIEW FORMAT

Final implementation report in Brazilian Portuguese:

- base/head SHA, Issue/PR/branch, Context Lock status and fingerprint count;
- exact scope delivered and changed-file inventory;
- policy/action model and deterministic authority boundary;
- current Perpl/Monad capability evidence and exact testnet account/scope provenance (redacted);
- proof that mainnet effectful execution is hard-blocked and the unproven M02 metrics are non-authoritative;
- simulation, kill-switch, idempotency, replay, retry and recovery results;
- tests/checks, exact-head hosted results, counts and evidence URLs;
- migrations, dependencies, security findings and introduced severity;
- limitations, required correction deltas and testnet blockers;
- confirmation that M04 and Checkpoint promotion remain untouched;
- exact STOP CONDITION.

## STOP CONDITION

`NERVA_M03_POLICY_SIM_EXEC_READY_FOR_AUDIT`

Stop after exact-head evidence, required checks, and this marker are complete. Do not merge, promote the Checkpoint, enable effectful mainnet execution, or start M04.
