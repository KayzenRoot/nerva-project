# NERVA-WO-005 — M04 Agent Wallet, Permissions & Verifiable Evidence

| Field            | Value                                                                     |
| ---------------- | ------------------------------------------------------------------------- |
| Status           | ADMITTED FOR EXECUTION — admission PR remains draft; Checkpoint unchanged |
| Risk             | HIGH_ASSURANCE                                                            |
| Module           | M04 — Agent Wallet, Permissions & Verifiable Evidence                     |
| Issue            | [#13](https://github.com/KayzenRoot/nerva-project/issues/13)              |
| Execution base   | `main@d13629e0dc2d66c4f8b2e512b82ce0d11aec1a93`                           |
| Execution branch | `feat/nerva-wo-005-m04-agent-wallet-permissions-evidence`                 |
| GEF              | `@gef-bootstrap/cli@1.1.2`                                                |
| Primary executor | Codex                                                                     |
| Review language  | pt-BR                                                                     |
| Context Lock     | `.engineering/context-locks/NERVA-WO-005.json` (64 base fingerprints)     |

This Work Order defines the future M04 product implementation. The current admission PR contains governance artifacts and narrowly scoped admission validators only; it does not implement M04 product code. The Checkpoint remains unchanged, and M04 implementation begins only under this admitted Work Order and a separately authorized execution request.

## OBJECTIVE

Implement NERVA V0.1's non-custodial Agent Wallet identity, bounded permissions, authorization and verifiable-evidence plane, integrating with the existing M03 deterministic authorization boundary and Flight Recorder. Use the current officially documented MetaMask Agent Wallet surface only after capability preflight. Compile least-privilege, expirable and revocable capabilities; require human-authorized, chain/account/agent/policy-bound EIP-712 authorization; observe and invalidate authority on EIP-7702 delegation-state changes; provide temporary/session authority; prevent cross-chain and same-chain replay with a durable nonce ledger; and make permission/evidence history tamper-evident and verifiable.

The objective is a controlled, auditable authorization capability. It does not grant autonomous financial authority, enable mainnet effects, enable live Perpl writes, or permit NERVA services to custody wallet secrets. Any unproven, unavailable or conflicting wallet, chain, delegate, grant, revocation, nonce, M03, kill-switch or evidence state fails closed.

## CONTEXT

At the exact base, the canonical Checkpoint records `M03=APPROVED`, `M04=NEXT`, and `M04 Work Order=NOT_ADMITTED`. M03 is approved as `M03_POLICY_SIMULATION_CLOSED_EFFECT_BOUNDARY`; it retains a closed live-effect boundary. This Work Order's admission must not modify that Checkpoint or alter the accepted M03 implementation.

M03's authorization port, policy/plan hashes, kill switch, durable idempotency/replay state, refusal/recovery semantics and Flight Recorder are security boundaries, not conveniences. M04 may supply verifiable wallet authorization to that boundary but may not bypass or weaken it. The accepted M03 carry-forward says live Perpl effects remain blocked pending documented protective-only provider capability and independent enrollment provenance, and any future live provider effect adapter additionally requires explicit database-level kill-switch concurrency proof and documented disable-versus-in-flight semantics.

Approved decisions D-0004 through D-0011 and D-0013, ADR-0001 and ADR-0002 remain binding. NERVA is non-custodial; natural-language and LLM output is untrusted; deterministic policy and authorization govern; unknown state fails closed; evidence is correlated; ambiguous effects are not retried blindly; and mainnet effects remain release-gated. The four MODERATE Drizzle Kit/esbuild advisories remain a release-review carry-forward.

This admission is limited to the Work Order, Context Lock, execution brief, Evidence Bundle scaffold, Issue/branch/draft PR and only the validators needed for the admission. No M04 product implementation, Checkpoint promotion, merge or M05 work is authorized in this admission.

## SCOPE

The admitted M04 implementation shall deliver the following bounded product capabilities after current-source preflight:

1. **Wallet Identity:** model only public wallet address, chain/network, wallet/provider identity, verification state and provenance. Bind an identity to an account only through a verifiable user-controlled wallet proof; reject chain/account ambiguity and stale or changed binding. Never request, receive, derive, persist, log or transmit a private key, seed phrase or mnemonic to NERVA services.
2. **Agent Identity:** define stable, versioned agent identity and issuer provenance, independent of natural-language names. Bind each identity to the user-approved wallet/account and exact chain. An agent cannot create, widen, renew or delegate its own privileges.
3. **Capability Grant:** define a strict, versioned, canonical permission grant with exact chain ID, account, agent ID/version, policy/version hash, permitted M03 action subset, protocol/market/position scope where admitted, quantitative ceilings where meaningful, expiry, revocation generation and unique nonce domain. Wildcards, unbounded limits and unknown fields are refused.
4. **Permission Compiler:** compile only declarative, allowlisted grants into deterministic canonical bytes/hash. `ARBITRARY_CALL`, unrestricted calldata, arbitrary contract targets, arbitrary selectors, privilege escalation, open-ended token approvals and actions outside the M03 allowlist are not representable. Natural-language/LLM proposals are untrusted suggestions and cannot compile directly into active grants or authorize effects.
5. **EIP-712 authorization:** integrate the supported external wallet flow after verifying its current official API and network support. Typed data must domain-separate by schema/version, exact chain ID and verifying domain, and bind wallet/account, agent, capability-grant digest, M03 policy/version, action scope, expiry, durable nonce and revocation generation. Refusal, timeout, stale data and malformed signatures are first-class fail-closed outcomes. A wallet signature is not proof that M03 simulation, policy, kill-switch or execution gates passed.
6. **EIP-7702 delegation detection/state:** observe the exact account/chain delegation state and, where verifiable, delegate address and code identity. Represent at least `ABSENT`, `ACTIVE`, `CHANGED`, `REVOKED` and `UNKNOWN`; missing, stale, reorged or unverifiable observations are `UNKNOWN` and block dependent authority. A delegate change, code-identity change or revocation invalidates pending/session authority bound to the former delegate before it can be consumed. M04 must detect and record state; it must not install or change delegation automatically.
7. **Temporary/session authority:** derive each session as a strict subset of an active grant, bound to the same wallet/account, chain, agent and policy, with a shorter explicit expiry and its own replay domain. Sessions cannot self-renew, expand scope, outlive/revive a grant, or survive revocation/delegate invalidation.
8. **Revocation engine:** support user-authorized grant/session revoke and wallet/account unbind. Persist a monotonic revocation generation or equivalent atomic state. Recheck it at authorization consumption and the M03 boundary; revocation wins races with pending signatures, queued plans, sessions and retries. Revocation does not claim to cancel an already confirmed external effect.
9. **Durable replay protection:** use a durable, append-oriented nonce/consumption ledger with unique domain-scoped constraints across chain, account, agent, grant/policy and operation. Reject duplicate, concurrent, cross-chain, cross-account, cross-agent, expired and superseded authorization. Prove concurrency and process-restart behavior; reuse or extend M03 persistence without weakening its invariants.
10. **Permission evidence chain:** create a verifiable, append-only hash-linked record chain for identity binding, grant compilation/confirmation, EIP-712 authorization digest/result, EIP-7702 observations, session issue/expiry, nonce consumption, revocation, M03 authorization decision and refusal/recovery. Canonicalization, link verification, supersession, privacy minimization and tamper detection must be specified and tested. Do not place key material, seed phrases, mnemonics, provider secrets or reusable credentials in evidence.
11. **Flight Recorder and M03 integration:** correlate permission evidence with M03's exact policy/version, plan digest, simulation/preflight state, actor and authorization provenance, environment, kill-switch decision, execution/refusal receipt and recovery state. Only the existing M03 authorization boundary may decide if its prerequisites pass. M04 must not introduce a route that submits Perpl writes or otherwise bypasses M03.
12. **Operator surfaces and APIs:** expose schema-versioned, authenticated grant, session, revoke, wallet-binding and evidence-verification operations plus read-only status. Show exact account/chain/agent/policy scope, expiry, revocation and delegate state. English is the default product language; preserve Brazilian Portuguese and Spanish. Secrets and raw sensitive wallet material never appear in client responses or logs.
13. **Persistence and recovery:** add only M04-owned schema/migrations for public identities, grants, authorization references, delegate observations, sessions, revocations and evidence links. Migrate cleanly from accepted M03. Enforce append/integrity and unique nonce constraints; never create private-key, seed-phrase or mnemonic persistence fields. Document recovery and privacy/retention behavior.
14. **CI, testing and documentation:** add deterministic unit, contract, API, integration, migration, concurrency, adversarial, replay, recovery and tamper tests; static gates; supported-wallet/network preflight evidence; operator/security documentation; benchmarks with reproducible methodology; and a completed Evidence Bundle in the later implementation execution.

## OUT OF SCOPE

- Any effectful `MAINNET` action, mainnet transaction signature/submission, deployment/activation of a delegate on mainnet, or configuration that can enable one. Mainnet effectful execution remains `HARD_BLOCKED` at configuration, capability compilation, authorization, dispatch and CI layers.
- Live Perpl writes or enabling a live Perpl effect adapter. Existing M03 live-effect blockers remain in force.
- Receiving, deriving, importing, storing, backing up, logging, transmitting or recovering private keys, seed phrases or mnemonics; wallet custody; raw private-key signer services.
- `ARBITRARY_CALL`, unrestricted calldata, arbitrary contract targets/selectors, arbitrary token approvals, open-ended spend/allowance, arbitrary transaction signing or unrestricted `eth_sendTransaction`.
- Any agent action that creates, widens, self-approves, self-renews or self-delegates a capability, policy or grant; any privilege derived from display name, local flag, prompt, LLM output or caller-supplied boolean.
- Financial authority from natural language or LLM output. LLMs may at most produce untrusted UI proposals, subject to deterministic compilation and explicit user authorization.
- Cross-chain execution or reuse of a chain-specific signature, grant, session, nonce or evidence authority on another chain.
- Treating `LIQUIDATION_DISTANCE`, `MAINTENANCE_MARGIN` or `FUNDING_DIRECTION` as authoritative. They remain non-authoritative/unproven as in the accepted M03 baseline.
- Automatically setting/changing EIP-7702 delegation, auto-upgrading a delegate, silently replacing a changed delegate, or trusting an unverified delegate/code state.
- Relaxing the M03 kill switch, policy, simulation, authorization, idempotency, replay, recovery or refusal requirements. No live provider effect adapter is enabled by this Work Order.
- M05 Product Experience, demo polish/analytics, M06 release work, new chains/protocols, Checkpoint changes/promotion, merge, or changes to the four MODERATE advisory carry-forwards except a separately admitted dependency correction.

## FILES / SOURCES TO READ

Read in the following order before future M04 implementation. Compare the 64 Context Lock fingerprints first; any base or fingerprint drift makes the lock stale and requires stop/re-admission.

1. `.engineering/CHECKPOINT.md` and `.engineering/CHECKPOINT.json`.
2. `.engineering/DECISIONS-LEDGER.md` and every approved ADR in `.engineering/decisions/`.
3. `.engineering/SOURCE-HIERARCHY.md`, `.engineering/SCOPE.md`, `.engineering/DEFINITION-OF-DONE.md`, `.engineering/ARCHITECTURE.md`, `.engineering/REQUIREMENTS.md`, `.engineering/SECURITY.md`, `.engineering/DATA-MODEL.md`, `.engineering/API-CONTRACTS.md`, `.engineering/INTEGRATION-CONTRACTS.md`, `.engineering/TEST-BENCHMARK-PLAN.md`, `.engineering/MODULE-ROADMAP.md`, `.engineering/BACKLOG.md`, `.engineering/UI-UX.md`, `.engineering/MIGRATION-RECOVERY.md`, `.engineering/DEPLOYMENT.md`, `.engineering/DEMO-CONTRACT.md`, `.engineering/EXTERNAL-EVIDENCE.md`, `.engineering/PROJECT-OVERVIEW.md`, `.engineering/COMPETITION-STRATEGY.md` and `.engineering/MONETIZATION.md`.
4. `.engineering/work-orders/NERVA-WO-003.md`, its Context Lock, execution brief, Evidence Bundle and proposed Checkpoint Delta; `.engineering/work-orders/NERVA-WO-004.md`, its Context Lock and execution brief, `.engineering/evidence/NERVA-WO-004-EVIDENCE.md`, `.engineering/checkpoint-deltas/NERVA-WO-004-PROPOSED.md`; and `docs/M03-POLICY-SIM-EXEC.md`.
5. This Work Order, `.engineering/context-locks/NERVA-WO-005.json`, `.engineering/execution-briefs/NERVA-WO-005-CODEX.md`, current M03 authorization/execution contracts, kill-switch persistence, nonce/replay ledger, Flight Recorder API/read surface, M03 migration and safety/dependency/database validators.
6. Current official MetaMask Agent Wallet docs and its official skill/API/plugin instructions; current official EIP-712 specification; current official EIP-7702 specification; current official Monad chain/RPC/network docs; relevant official wallet security/threat coverage for the exact target chain; GEF 1.1.2 package/state; current CI/workflows and dependency advisories. Record URL, retrieval date/revision and capability limitation. Do not infer wallet capability from a marketing page or stale M03 evidence.
7. Current source and schema for `packages/contracts`, `packages/execution`, `packages/db`, `apps/web` wallet/authorization/evidence surfaces and workspace boundaries. Read the owning package instructions and `AGENTS.md` files if added after admission.

## REQUIREMENTS

- **M04-GOV-001:** Use exactly the admitted base, branch, Issue and Context Lock. At admission base: M03 `APPROVED`, M04 `NEXT`, M04 Work Order `NOT_ADMITTED`. Stale base/fingerprint blocks execution.
- **M04-WID-001:** Wallet Identity is public and chain-specific; account-binding provenance is cryptographically verifiable and explicitly user-controlled. No custodial material enters NERVA.
- **M04-AID-001:** Agent Identity has a stable versioned identifier and trusted issuer provenance; an agent cannot claim or self-approve a different identity.
- **M04-CAP-001:** Capability Grant is strict, canonical, least-privilege, bounded, expirable, revocable and bound to exact chain/account/agent/policy. Unknown scope, wildcard, invalid limit or stale identity refuses.
- **M04-COMP-001:** Permission Compiler emits only the allowlisted M03 action subset and policy-bounded capabilities. It rejects `ARBITRARY_CALL`, arbitrary targets/selectors/calldata, self-escalation and all unknown fields/actions.
- **M04-EIP712-001:** Typed authorization uses exact domain/schema/chain/account/agent/grant/policy/action/expiry/revocation generation/nonce binding. Wrong domain, chain, account, signer, grant, policy, action, expiry or malformed signature fails closed.
- **M04-EIP7702-001:** Delegation state is observed and provenance-bound. `UNKNOWN`, chain mismatch, reorg uncertainty, delegate/code change or invalidated authority blocks dependent sessions/authorization. No automatic delegation change is allowed.
- **M04-SESSION-001:** Temporary/session authority is a strict subset of a live grant with earlier expiry and unique nonce domain; no self-renewal, scope expansion or resurrection.
- **M04-REVOKE-001:** Revocation and wallet unbinding persist atomically with monotonic generation. Revocation defeats every pending or concurrently consumed authorization. In-flight/confirmed effects are represented honestly.
- **M04-REPLAY-001:** Durable nonce/replay protection covers concurrency, restart and chain/account/agent/grant domains. Cross-chain replay is impossible even for otherwise identical EIP-712 payloads.
- **M04-EVID-001:** Permission/evidence chain is append-only or explicitly superseding, cryptographically verifiable and tamper-evident; records are correlated to exact M03 plan/policy and verification outcome; sensitive material is absent.
- **M04-FR-001:** Flight Recorder represents wallet/grant/auth/delegate/session/revocation/evidence states, refusals and M03 correlation without showing a pending/unknown outcome as success.
- **M04-M03-001:** M04 never bypasses the M03 authorization boundary. M03 policy, plan, simulation, kill switch, actor provenance, environment, replay/idempotency, recovery and refusal gates remain intact.
- **M04-SAFETY-001:** `MAINNET effectful execution = HARD_BLOCKED`; live Perpl effects remain blocked. `LIQUIDATION_DISTANCE`, `MAINTENANCE_MARGIN` and `FUNDING_DIRECTION` remain non-authoritative/unproven. Unknown state fails closed.
- **M04-KS-001:** Before any future live provider effect adapter may be enabled, an explicit database-level kill-switch concurrency proof and disable-versus-in-flight semantics are mandatory. This Work Order does not enable such an adapter.
- **M04-SEC-001:** No private-key, seed-phrase or mnemonic field, store, log, fixture or client payload; no secret in repository/evidence; exact redaction and bundle scans pass.
- **M04-CI-001:** GEF 1.1.2, Context Lock, Source Pack, format, lint, typecheck, workspace/dependency, Linux and bounded Windows checks, SonarCloud, Socket, security, migration, adversarial and recovery gates pass on the exact implementation candidate; no introduced CRITICAL/HIGH finding remains.
- **M04-DEP-001:** Four MODERATE Drizzle Kit/esbuild advisories remain visible carry-forwards for release review; no blanket suppression or unscoped upgrade is permitted.
- **M04-LANG-001:** English remains the default product language; Brazilian Portuguese and Spanish remain available for affected user-facing flows.
- **M04-DEPTH-001:** M05 remains blocked and unstarted. No Checkpoint promotion or merge is authorized by this Work Order.

## ARCHITECTURE RULES

- Preserve the approved non-custodial and deterministic authority boundaries. Keep wallet/provider objects behind adapters; use typed domain identities and capabilities.
- Separate Wallet Identity, Agent Identity, Capability Grant, permission compilation, user authorization, EIP-7702 observation, session authority, revocation, M03 policy/simulation/authorization, effect dispatch and evidence verification as explicit trust boundaries.
- Bind signatures and capabilities to the exact chain ID, account, agent, grant and policy versions, action scope, expiry, nonce and revocation generation. Use canonical EIP-712 domain separation; never rely on a UI label or chain name alone.
- Authority is monotonic downward at each derivation: compiler output, agent grant and temporary session cannot exceed the user's explicit grant. Scope changes require a fresh user-authorized grant and immutable evidence event.
- Treat wallet refusal, provider disconnect, code/delegate change, reorg, stale RPC, unknown chain, missing revocation state, replay ledger failure and verifier disagreement as explicit refusal/unknown states.
- Revocation is checked at the last authorization-consumption boundary, serialized with the durable replay claim, and wins races. A changed EIP-7702 delegate invalidates old-delegate-bound authority before use.
- Hash-link Flight Recorder evidence using a documented canonical encoding and verifiable predecessor link. Preserve original events; corrections append a linked superseding event.
- Mainnet effectful dispatch stays hard-blocked with no configuration override. Do not create a live Perpl write path or imply that a message signature permits an effect.
- Any future testnet/provider effect remains separately gated by M03 and independent provenance; it also requires the M03 database kill-switch concurrency proof before a live effect adapter exists.
- Keep product text English-first with `pt-BR` and Spanish translations. UI status is read-only evidence and cannot modify grant authority.

## CONSTRAINTS

- `HIGH_ASSURANCE`; any unresolved introduced CRITICAL/HIGH finding blocks readiness.
- No mainnet effect, live Perpl write, wallet custody, private key, seed phrase or mnemonic handling/storage.
- No `ARBITRARY_CALL`, unrestricted calldata, arbitrary selector/contract, unlimited allowance or chain-agnostic permission.
- No agent self-expansion, self-renewal or self-authorization. No financial authority from natural language/LLM.
- Every grant/session is bounded, expirable and revocable and exact-bound to chain/account/agent/policy.
- Durable nonce/replay protection is required. Cross-chain replay is forbidden. Revocation wins pending authorization. EIP-7702 delegate change invalidates prior-delegate authority.
- Preserve M03 safety gates and its non-authoritative/unproven risk metrics. Do not treat `UNKNOWN` as valid, safe or authorized.
- Do not enable any live provider effect without exact capability/enrollment provenance and a separately proven database-level kill-switch concurrency boundary.
- Carry forward four MODERATE dependency advisories for release review; do not hide or mislabel them.
- No M05 implementation, Checkpoint edit/promotion, merge, force-push or unrelated scope. Correct only within this Work Order/PR.

## ACCEPTANCE CRITERIA

### Admission acceptance — this execution

1. Exact base and preconditions validate; the Work Order, 60-fingerprint Context Lock, execution brief and scaffold-only Evidence Bundle are published on the exact branch and linked to Issue #13.
2. The draft PR targets `main`, records exact base/head, files, applicable checks, security impact and limitations, and remains unmerged.
3. Only the admission Context Lock and Source Pack validators plus formatting inclusion are adjusted as needed. The Checkpoint and M03 product files remain unchanged.
4. GEF 1.1.2 state/package, Context Lock, Source Pack, formatting of changed files, lint, typecheck, workspace/dependency checks, Linux, Windows-bounded, SonarCloud and Socket checks pass on the exact admission head.
5. The changed-file set contains only the four admission artifacts, the minimal required validators and their format-check path configuration. No M04 product code is implemented.
6. The Evidence Bundle says `SCAFFOLD ONLY` and makes no implementation, test or provider-readiness claim.
7. The exact admission stop marker below is recorded. Checkpoint promotion, merge and M05 do not occur.

### M04 implementation acceptance — future execution under this Work Order

8. Current official wallet/EIP/network documentation and supported API/version/capability are recorded; unsupported wallet/network features are explicitly blocked rather than inferred.
9. Wallet and agent identity bind to verifiable public/account provenance; no secret custody or sensitive key-shaped storage exists.
10. Permission Compiler emits deterministic canonical bounded grants and refuses every non-allowlisted or self-escalating capability.
11. EIP-712 signatures verify exact domain, chain/account, agent, grant/policy, action, expiry, nonce and revocation generation; replay/cross-chain/domain-confusion vectors refuse.
12. EIP-7702 delegate state is independently observed; unknown or changed delegation invalidates pending/session authority bound to the former delegate; no automatic delegation mutation exists.
13. Temporary authority cannot exceed or outlive its grant; revocation and wallet unbinding win concurrency races and invalidate pending use.
14. Durable replay prevention works across concurrent requests, process restart, duplicate events and chain/account/agent/grant domains.
15. Permission evidence links verify cryptographically, reject deletion/reorder/tampering, correlate to M03 Flight Recorder and expose no secrets.
16. M03 authorization, kill-switch, simulation, policy, idempotency, replay and recovery gates remain in place; mainnet is hard-blocked and live Perpl effects remain disabled.
17. Database-level kill-switch concurrency proof and disable-versus-in-flight semantics are recorded as a mandatory blocker for any later live provider effect adapter.
18. Clean and M03-upgrade migrations, security/adversarial/recovery tests, benchmarks and exact-head CI are evidenced; no unresolved introduced CRITICAL/HIGH finding remains.
19. Four MODERATE advisories and all provider/wallet limitations remain explicit in release-facing evidence; no unproven capability is presented as live.
20. English-default, Brazilian Portuguese and Spanish user-facing wallet/permission/evidence flows are complete and reviewed.
21. M05 remains unstarted; no Checkpoint promotion or merge is included in M04 implementation closeout.

## TESTS / PROOF OBLIGATIONS

- **Admission:** verify M03/M04/Work Order states; exact base/branch/Issue; each real Context Lock blob; allowed changed-file set; scaffold-only Evidence Bundle; GEF 1.1.2; Source Pack.
- **M04-WID-001:** valid wallet/account/chain proof; wrong chain/address; changed binding; replayed binding proof; malformed and unverifiable issuer.
- **M04-AID-001:** stable agent identity, issuer mismatch, duplicate identity, spoofed label, and attempts to replace or self-approve an agent.
- **M04-CAP-001/M04-COMP-001:** canonical hash determinism; exact scope binding; unknown field/action; wildcard; unbounded capability; arbitrary call/target/selector/calldata; privilege expansion; quantity/policy overrun; expired grant.
- **M04-EIP712-001:** positive vector plus wrong chain ID, domain, verifying contract/domain version, account, signer, agent, policy/grant hash, action, revocation generation, nonce, expiry and malformed signature.
- **M04-EIP7702-001:** absent/active/changed/revoked/unknown delegate; code hash change; stale RPC; chain mismatch; reorg/conflicting observation; invalidation before session/auth use; no automatic mutation path.
- **M04-SESSION-001:** session subset, shorter expiry, revoke/expire, attempted self-renewal, stale grant and delegate change.
- **M04-REVOKE-001/M04-REPLAY-001:** revocation-before-signature, between verification and consumption, concurrent with consumption, restart, duplicated request/event, reused nonce, cross-account/agent/grant and cross-chain replay.
- **M04-EVID-001/M04-FR-001:** append/link determinism, cryptographic verification, changed/deleted/reordered record, bad predecessor, redaction/secret scan, M03 correlation and explicit unknown/refusal state.
- **M04-M03-001/M04-SAFETY-001:** no path bypasses M03; `UNKNOWN` M03 state refuses; unproven metrics stay non-authoritative; kill switch wins; mainnet remains hard-blocked; no live Perpl writes.
- **M04-KS-001:** database-level concurrency tests and documented disable-versus-in-flight semantics must pass before any future live provider effect adapter is even considered.
- **M04-DB-001:** clean migration, upgrade from M03, restart persistence, append/integrity/uniqueness constraints, no key/seed/mnemonic columns.
- **M04-API-001:** schema/version/correlation/idempotency, authentication/refusal semantics, no-secret client payload, revocation precedence and read-only evidence verification.
- **M04-CI-001:** format, lint, typecheck, workspace/dependency boundaries, full Linux, bounded Windows, GEF 1.1.2, Source Pack, SonarCloud, Socket, migration and security gates on the exact implementation head.
- **M04-LANG-001:** English is the default; `pt-BR` and Spanish cover wallet, grant, revocation and evidence states with no untranslated critical safety warning.

## DELIVERABLES

Future M04 implementation deliverables are the Wallet Identity and Agent Identity model; Capability Grant schema; deterministic Permission Compiler; EIP-712 authorization adapter; read-only EIP-7702 delegation detector/state; temporary/session authority; revocation engine; durable replay ledger; verifiable permission-evidence chain; Flight Recorder/M03 integration; bounded APIs and status UI; append-oriented migrations; adversarial/replay/concurrency/recovery tests; CI/security/benchmark proof; operating/security documentation; and a completed Evidence Bundle.

The current admission deliverables are this Work Order, fresh Context Lock, Codex execution brief, scaffold-only Evidence Bundle, Issue #13, exact-base branch, draft PR and minimal admission validator updates. No M04 product code belongs in the admission diff.

## REVIEW FORMAT

For this admission, report in Brazilian Portuguese: exact base/head SHA; Issue/branch/PR state; precondition result; Context Lock fingerprint count; changed-file inventory; validator changes; every local/hosted check and its exact-head status; security/compatibility/dependency impacts; any non-blocking observations; explicit confirmation that no M04 product code was implemented; no merge/Checkpoint promotion/M05; and this admission STOP CONDITION.

For future M04 implementation review, also report each acceptance/proof obligation, exact official source URLs/revisions and wallet/network support, permission/signature/delegate/revocation/replay evidence, M03 boundary and mainnet/Perpl gates, migrations, security findings, four MODERATE advisories, exact testnet/live-effect status, and the implementation Evidence Bundle.

## STOP CONDITION

`NERVA_WO_005_ADMITTED_READY_FOR_EXECUTION`

Stop immediately after the admission artifacts, exact-base Context Lock, required validator recognition, exact-head applicable checks, and draft PR are complete. Do not implement M04 product code, merge, promote the Checkpoint, enable mainnet/live Perpl effects, or start M05.
