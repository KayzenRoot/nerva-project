# NERVA-WO-005 Evidence Bundle

- Status: `M04 IMPLEMENTATION EVIDENCE — COMPLETE FOR AUDIT`
- Work Order: `NERVA-WO-005 — M04 Agent Wallet, Permissions & Verifiable Evidence`
- Risk: `HIGH_ASSURANCE`
- Issue: [#13](https://github.com/KayzenRoot/nerva-project/issues/13)
- Pull request: [#14](https://github.com/KayzenRoot/nerva-project/pull/14) — expected to remain `OPEN` / `DRAFT`
- Execution base: `d13629e0dc2d66c4f8b2e512b82ce0d11aec1a93`
- Execution branch: `feat/nerva-wo-005-m04-agent-wallet-permissions-evidence`
- Context Lock: `.engineering/context-locks/NERVA-WO-005.json` — 64 real base fingerprints
- Admission HEAD before M04 implementation: `ff14145870f0fef2a23f5f45b1324eaffc422e1a`
- Implementation HEAD: resolved from PR #14 after the final evidence commit and push; the exact SHA is repeated in the PR update and final execution report. This file is part of that tree and therefore does not embed a self-referential tree hash.
- Checkpoint: canonical files unchanged; M04 implementation evidence does not promote the module.

## Preflight and governance

- Branch matched the Work Order branch; canonical `origin/main` matched the required base before implementation.
- All 64 Context Lock fingerprints matched the exact base blobs before implementation. The Context Lock validator was also run against the candidate and checks all 64 entries at that base.
- Canonical precondition at the base was `M03=APPROVED`, `M04=NEXT`, `M04 Work Order=NOT_ADMITTED`; the Checkpoint was not modified.
- The `NERVA-WO-003` accepted Evidence Bundle and `NERVA-WO-004` accepted closeout/Checkpoint Delta were read before M04 changes.
- GEF 1.1.2 package integrity and initialized repository state checks passed locally.

## Implementation delivered

- Public-only Wallet Identity binding and versioned, trusted-issuer Agent Identity on Monad Testnet chain ID `10143`.
- Strict deterministic Capability Grant compiler bound to the current wallet, agent/version, policy digest, exact position/market, allowlisted action subset, limits, expiry, delegation observation and nonce domain.
- EIP-712 typed-data challenge/verification flows for wallet binding, grant approval, plan authorization, revocation, wallet unbinding and private read-model access. Raw signatures are verified and reduced to proof hashes; they are not persisted or returned.
- Read-only EIP-7702 finalized-block observer that verifies the delegation designator and delegate runtime bytecode at the same canonical block hash; unknown code/RPC/finality fails closed.
- Short-lived session subset derivation, wallet-owner EIP-712 individual session revocation, monotonic grant revocation and wallet unbinding, durable replay protection, unique account/wallet generation, and append-only permission evidence hash chain.
- M03 execution-boundary revalidation of the exact authorization reference, plan/action, current generation, wallet binding and recent delegation; refusal/recovery remains closed and no live effect adapter is present.
- Account status API requires a one-time, wallet-signed, account/chain-bound read proof. Flight Recorder exposes hashed M04 subject references and evidence-integrity state. Permission UI is read-only, English-default, with `pt-BR` and Spanish.
- Six M04 migrations `0003`–`0008` add permission state, durable nonces, append-only evidence, account-generation constraints and append-only individual session revocation. Existing M03 schema/effect semantics remain in place.
- Reproducible M04 compiler/evidence benchmark emits sample count, p95, runtime, platform and CPU; no wallet, network or persistence is used by the benchmark.

## Safety proof and limitations

- `MAINNET` effectful execution: `HARD_BLOCKED` by the existing M03 configuration and dispatch boundary; M04 grants admit only Monad Testnet.
- Live Perpl writes: `BLOCKED`; M04 creates no provider-write or effect adapter. Future adapters still require the explicit DB-level kill-switch concurrency proof and disable-versus-in-flight contract.
- M03 kill switch, simulation/preflight, authorization, idempotency, replay, refusal and recovery checks remain mandatory. Simulation or authority `UNKNOWN` blocks.
- Actions remain `REDUCE_POSITION`, `CLOSE_POSITION`, `NO_ACTION`; no arbitrary target, selector, calldata, unlimited approval, transaction signer or delegation writer exists.
- `LIQUIDATION_DISTANCE`, `MAINTENANCE_MARGIN` and `FUNDING_DIRECTION` remain non-authoritative/unproven.
- No app/database/log/evidence wallet private key, seed phrase or mnemonic field or value is added. Test/benchmark signer material is generated ephemerally in process memory only.
- MetaMask Agent Wallet's current documentation was retrieved on 2026-10-03. The EIP-712 guide documents `mm wallet sign-typed-data --chain-id ... --payload ...`; the supported-chain page lists Monad Testnet `10143`. The installed `mm` CLI was not available, so no Agent Wallet CLI session was run. The implementation uses a generic EIP-712-compatible external-wallet boundary and does not claim a MetaMask Agent Wallet identity or testnet Transaction Shield coverage. The MetaMask page makes its CLI-version `mm chains list` output authoritative and does not list threat-scanning coverage for Monad Testnet.
- EIP-712 and EIP-7702 canonical specifications were retrieved on 2026-10-03. EIP-712 leaves application replay rejection to the implementer, so M04 uses a durable nonce. EIP-7702 state is observed only; no delegation is installed or mutated.
- Monad EIP-7702 and Testnet docs were retrieved on 2026-10-03. Monad documents EIP-7702 support and a 10 MON delegated-EOA reserve rule; its current testnet page showed `v0.15.2` / `MONAD_NINE`. The rendered public-RPC table did not show endpoint values. A read-only point-in-time probe of the fixed endpoint returned chain ID `0x279f` (`10143`), finalized block `0x40c2a64` / hash `0xb96f54aa78e88f33f5b4e72462d2da1cad97fcf8f428d0e9eee821afc85f3b16`, and accepted EIP-1898 `eth_getCode` with `requireCanonical: true`; no wallet address was queried. This does not prove sustained endpoint health or reorg guarantees. Wallet threat coverage on the exact testnet is not inferred.
- Four MODERATE Drizzle Kit/esbuild advisories remain release-review carry-forwards. `npm audit --audit-level=high` exited successfully with four MODERATE and no HIGH/CRITICAL items; no force upgrade or blanket suppression was performed.

Official source records:

1. [MetaMask Agent Wallet — Sign messages and transactions](https://docs.metamask.io/agent-wallet/guides/sign-messages-and-transactions/) — retrieved `2026-10-03`; typed-data CLI command documented; no content revision identifier displayed.
2. [MetaMask Agent Wallet — Supported chains](https://docs.metamask.io/agent-wallet/reference/supported-chains/) — retrieved `2026-10-03`; Monad 143 / Monad Testnet 10143 listed; testnet threat-scan coverage not specified.
3. [EIP-712](https://eips.ethereum.org/EIPS/eip-712) and [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) — canonical specifications retrieved `2026-10-03`; no separate revision label displayed.
4. [Monad EIP-7702 documentation](https://docs.monad.xyz/developer-essentials/eip-7702) and [Monad Testnet network information](https://docs.monad.xyz/developer-essentials/testnet) — retrieved `2026-10-03`; testnet page reset date `2025-12-16`, revision `v0.15.2` / `MONAD_NINE`.

## Local checks

| Check                                                                                     | Result                                               | Evidence                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript strict typecheck                                                               | `PASS`                                               | `npm run typecheck`                                                                                                                                                                                                                                                                                                                        |
| Full unit / contract / adversarial suite                                                  | `PASS` — 121 tests, 24 files                         | `npm test -- --reporter=dot`; includes fail-closed tests for tied latest simulation results and stale/delegate-changed authority                                                                                                                                                                                                           |
| Focused M04 request/signature/session-revocation suite                                    | `PASS` — 20 tests, 2 files                           | `npx vitest run packages/contracts/src/m04.test.ts packages/permissions/src/index.test.ts --reporter=dot`                                                                                                                                                                                                                                  |
| ESLint                                                                                    | `PASS`                                               | `npm run lint` after correcting the migration smoke script                                                                                                                                                                                                                                                                                 |
| Changed-file formatting                                                                   | `PASS` after Prettier write                          | Targeted check on changed source/docs/metadata files                                                                                                                                                                                                                                                                                       |
| Repository-wide format check                                                              | `FAIL — pre-existing baseline files only`            | `README.md`, WO-003 evidence, WO-003 Checkpoint Delta and WO-004 evidence are byte-identical to the required base and remain outside M04 scope                                                                                                                                                                                             |
| Workspace graph / dependency boundary / M03-M04 safety                                    | `PASS`                                               | Workspace/dependency/safety validators; tied newest simulation results containing `UNKNOWN` refuse authorization                                                                                                                                                                                                                           |
| GEF state and package integrity                                                           | `PASS`                                               | `npm run gef:verify`, `npm run gef:package:verify`; `@gef-bootstrap/cli@1.1.2`                                                                                                                                                                                                                                                             |
| Drizzle migration journal                                                                 | `PASS`                                               | `npm run db:check`                                                                                                                                                                                                                                                                                                                         |
| Clean PostgreSQL migration and schema/integrity verification                              | `PASS`                                               | Disposable PostgreSQL 18.6 container, `npm run db:smoke`; 34 tables, 28 integrity triggers, zero credential columns, zero write-path tables                                                                                                                                                                                                |
| Upgrade migration / nonce concurrency / pending-revocation race                           | `PASS`                                               | `npm run db:upgrade-smoke`; 0000–0008, 34 tables, 28 triggers, one durable individual revocation/nonce, evidence verifies, replay rejects                                                                                                                                                                                                  |
| Web and worker production build                                                           | `PASS`                                               | `npm run build`                                                                                                                                                                                                                                                                                                                            |
| M04 benchmark                                                                             | `PASS`                                               | 100 compiler samples, p95 `0.158 ms`; 500 evidence appends, p95 `0.125 ms`; Windows x64, AMD Ryzen 3 4300GE, Node v24.19.0                                                                                                                                                                                                                 |
| Dependency audit                                                                          | `PASS` at configured HIGH threshold                  | `npm run security:audit`; four MODERATE carry-forwards remain visible                                                                                                                                                                                                                                                                      |
| Source Pack and candidate Context Lock                                                    | `PASS`                                               | Local validators and exact-head GEF/Source Pack runs; 64 fingerprints; [GEF](https://github.com/KayzenRoot/nerva-project/actions/runs/37149898591), [Source Pack](https://github.com/KayzenRoot/nerva-project/actions/runs/37149898543)                                                                                                    |
| Client bundle secret scan / safe-mode boot / Perpl public smoke / risk and M03 benchmarks | `PASS`                                               | Client assets clean; safe-mode boot remains execution-disabled; public Perpl smoke unauthenticated; benchmark p95s below targets                                                                                                                                                                                                           |
| SonarCloud / Socket / Linux / bounded Windows hosted CI                                   | `PASS` on `cf619a0dc62d51e84f91ce7ab43d61cb5279bc45` | [SonarCloud](https://sonarcloud.io/dashboard?id=KayzenRoot_nerva-project&pullRequest=14), [Linux/Windows](https://github.com/KayzenRoot/nerva-project/actions/runs/37149898542), [Socket](https://socket.dev/dashboard/org/nexlabs/sbom/3ad0ff20-306a-4128-a25b-abbe0a9a21bc); final Evidence-only HEAD is rechecked in the live PR rollup |

## Known observations

- The global formatter script includes four unchanged base documents that currently fail Prettier; they were not reformatted because they are outside this Work Order. All changed M04 files pass targeted formatting.
- Docker Desktop was initially starting. Migrations were subsequently tested using an ephemeral pinned PostgreSQL 18.6 container without a named volume, and that container was stopped after the tests.
- The `mm` CLI was unavailable, and no wallet address or effectful request was sent to Monad. Only the documented point-in-time read-only Testnet RPC probe above was performed; it does not establish sustained provider health or authorize a financial effect.
- The SonarCloud analysis for prior candidate `924f728673e3bb88638720e0bbeda594238a9172` failed its new-code duplication threshold (4.58%) and reliability rating (D). The locale-sensitive advisory lock ordering was replaced with deterministic lexical ordering, repeated API/UI structures were consolidated, and SonarCloud passed on `cf619a0dc62d51e84f91ce7ab43d61cb5279bc45`.
- The configured Codex Security diff-scan did not produce a scan ID because its working-tree selector became stale; no automated diff-scan result is claimed. A manual review of the M04 authorization, persistence and M03 integration paths was performed, with no confirmed finding.

## Closeout

- Final PR state: `OPEN` / `DRAFT`; candidate SHA and hosted check rollup must match the final pushed head.
- Checkpoint promotion: `NOT PERFORMED`.
- Merge: `NOT PERFORMED`.
- M05: no M05 implementation is included or authorized by this closeout.
- Mainnet effect: `HARD_BLOCKED`.
- Live Perpl effect: `BLOCKED`.
- STOP CONDITION: `NERVA_M04_AGENT_WALLET_PERMISSIONS_EVIDENCE_READY_FOR_AUDIT`

## Correction Delta — PR #14 audit

- Audit disposition: `CORRECTION REQUIRED` on the prior PR candidate; this delta adds owner authorization for session issuance, explicit session-backed authorization, M03-boundary revalidation, revoke/consume serialization and exact WalletBinding typed-data validation.
- Correction base: `a44cd7e63c2803da366ec38cc2148b1746d52757`; canonical execution base remains `d13629e0dc2d66c4f8b2e512b82ce0d11aec1a93`; Context Lock remains unchanged with 64 fingerprints.
- Code correction commit/HEAD: `25000410be53d16e367dc7c28d2ec718ff8e20e5`. Evidence Bundle is a separate follow-up commit; record its final SHA in the PR and final report.
- Changed implementation files: `.github/scripts/migration-from-m02.mjs`, `.github/scripts/validate-nerva-context-lock.mjs`, `.github/scripts/verify-db-schema.mjs`, `.github/scripts/verify-m03-safety.mjs`, `apps/web/src/app/api/permissions/authorize/route.ts`, `apps/web/src/app/api/permissions/sessions/route.test.ts`, `apps/web/src/app/api/permissions/sessions/route.ts`, `docs/M04-AGENT-WALLET-PERMISSIONS.md`, `packages/contracts/src/index.ts`, `packages/contracts/src/m04.test.ts`, `packages/db/migrations/0009_natural_oracle.sql`, `packages/db/migrations/meta/0009_snapshot.json`, `packages/db/migrations/meta/_journal.json`, `packages/db/src/index.ts`, `packages/db/src/m04.ts`, `packages/db/src/schema.ts`, `packages/permissions/src/index.test.ts` and `packages/permissions/src/index.ts`. This Evidence Bundle is the nineteenth changed file.
- Migration: `packages/db/migrations/0009_natural_oracle.sql` adds nullable legacy-compatible issuance proof/digest/nonce, revocation-generation and delegation-observation columns to sessions, plus session linkage and authorization nonce hash to M03 authorization references. New issuance requires nonzero proof hashes; legacy session rows remain non-authoritative at the execution boundary. Clean and M03→M04 upgrade smoke both applied `0000`–`0009` successfully; resulting schema has 34 tables and 28 integrity triggers.
- Session issuance now returns a write-free `SessionIssuance` EIP-712 owner-signing challenge. The currently bound wallet must sign the exact chain/account/wallet/agent/version/parent grant and hash/revocation generation/session and hash/actions/limits/expiry/nonce/domain/delegation observation. Only after signature verification and fresh parent/wallet/delegation checks does one DB transaction consume the unique nonce and append session/evidence.
- Session authorization selects `grant` or `session` explicitly and enforces session subset bounds. The M03 consumption boundary revalidates session identity/hash/status, parent grant status/generation, current wallet binding, current delegation observation, agent/policy, plan digest, action, position/market, fraction/notional/slippage limits, expiry and durable session/authorization nonces.
- Concurrency proof: `npm run db:upgrade-smoke` used separate PostgreSQL connections to race session authorization consumption against session revocation. Both lock the parent grant and session in a stable order. The in-flight authorization that serialized before revocation is rejected at M03 consumption after confirmed revoke; an authorization attempted after revoke is rejected and no pending authorization remains executable. The smoke also confirmed durable nonce replay rejection across process/session reuse.
- Adversarial tests: `npx vitest run packages/contracts/src/m04.test.ts packages/permissions/src/index.test.ts apps/web/src/app/api/permissions/sessions/route.test.ts --reporter=dot` — PASS, 24 tests in 3 files. Coverage includes unsigned challenge without persistence, wrong signer/account/chain/grant/session hash/domain/type/primaryType, grantId-only issuance, session subset success, action/limit expansion, expiry/revocation/parent revoke/wallet unbind/delegate change, nonce and cross-chain replay, and tampered WalletBinding types/primaryType. Session revoke/consume race and post-revoke M03 rejection are proven by the PostgreSQL upgrade smoke above.
- Local checks on code HEAD `25000410be53d16e367dc7c28d2ec718ff8e20e5`: targeted Prettier check `PASS` on changed source/docs/metadata files; `npm run lint` `PASS`; `npm run typecheck` `PASS`; `npm run build` `PASS`; `npm test -- --reporter=dot` `PASS`, 125 tests in 25 files; focused M04 suite `PASS`, 24 tests in 3 files; `npm run db:smoke` and `npm run db:upgrade-smoke` `PASS`; `npm run m03:safety:verify`, `npm run db:check`, `npm run security:client-bundle`, `npm run smoke:boot`, `npm run perpl:smoke`, workspace/dependency checks, benchmarks, `npm run gef:verify`, `npm run gef:package:verify`, `npm run context:validate`, `npm run sourcepack:validate` and `npm run security:audit` `PASS`. Repository-wide format remains blocked only by four historical base files explicitly kept outside this delta; targeted formatting passes.
- Exact-code-HEAD hosted checks (`25000410be53d16e367dc7c28d2ec718ff8e20e5`): GEF 1.1.2 `PASS` ([run 37156821219](https://github.com/KayzenRoot/nerva-project/actions/runs/37156821219)); Source Pack `PASS` ([run 37156821253](https://github.com/KayzenRoot/nerva-project/actions/runs/37156821253)); Linux and bounded Windows `PASS` ([run 37156821293](https://github.com/KayzenRoot/nerva-project/actions/runs/37156821293)); Socket Project Report and Pull Request Alerts `PASS` ([project report](https://socket.dev/dashboard/org/nexlabs/sbom/0f369b91-690c-4d1e-ac45-0a9ef3c83d20), [PR check](https://github.com/KayzenRoot/nerva-project/runs/111301801523)). SonarQubeCloud check suite `100646678876` remained `QUEUED` with zero check runs, and SonarCloud's public analysis history still identified the canonical base revision as its latest analysis. The local environment has no Sonar token or scanner configuration, so no candidate-specific Sonar result is claimed. These hosted checks validate the code correction commit; all applicable checks must be refreshed and reported against the final evidence-bearing HEAD as well.
- Security findings: `npm run security:audit` passed its configured HIGH threshold and reported zero HIGH / zero CRITICAL dependency advisories; four existing MODERATE Drizzle Kit/esbuild advisories remain carry-forward for release review. The configured Codex Security diff-scan did not produce a scan ID because the working-tree selector was stale, so no automated diff-scan result is claimed. Manual review of the changed session issuance, persistence, authorization and M03 boundary paths found no confirmed HIGH/CRITICAL finding. Socket results are recorded separately by hosted check and do not replace that limitation.
- PR #14 remains `OPEN` / `DRAFT`; no merge or Checkpoint promotion; M05 not started; `MAINNET effectful execution = HARD_BLOCKED`; `LIVE PERPL EFFECTS = BLOCKED`.
- STOP CONDITION: `NERVA_M04_AGENT_WALLET_PERMISSIONS_EVIDENCE_READY_FOR_AUDIT`

## Auditor receipt — re-audit after Correction Delta

- Verdict: `APPROVED`.
- Audited head: `070badfa79323328b11840c4eb6c0326d31e2637`.
- Hosted M01–M04 run: `37157179018` / `SUCCESS`.
- GEF 1.1.2 run: `37157179028` / `SUCCESS`.
- Source Pack run: `37157179049` / `SUCCESS`.
- Socket Security PR Alerts / Project Report: `SUCCESS`.
- Tests: 125/125 across 25 files.
- Clean PostgreSQL migration through 0009: `PASS`.
- M03→M04 upgrade/session/revocation/replay concurrency: `PASS`.
- Session issuance: owner-signed EIP-712 and durable nonce consumption.
- Session-backed authorization: bounded by session + parent grant and revalidated at M03 boundary.
- WalletBinding exact `primaryType` and canonical type schema: verified.
- Introduced HIGH/CRITICAL findings: 0.
- Four MODERATE dependency advisories remain.
- MAINNET effect: `HARD_BLOCKED`.
- Live Perpl effect: `BLOCKED`.
- M05: not started.

The prior `CORRECTION REQUIRED` finding is closed. This approval authorizes M04 checkpoint promotion and merge only; it does not admit M05.
