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
