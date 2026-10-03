# NERVA-WO-005 — Codex Execution Brief

Execute the explicitly authorized M04 implementation under **NERVA-WO-005 / Issue #13 / PR #14** on `feat/nerva-wo-005-m04-agent-wallet-permissions-evidence`.

1. Read the Work Order, Context Lock, this brief, approved M03 Evidence Bundle and Checkpoint Delta, all named canonical files, applicable repository instructions, and current official MetaMask Agent Wallet/EIP/Monad sources before changes.
2. Confirm `main@d13629e0dc2d66c4f8b2e512b82ce0d11aec1a93`, the exact branch, Issue #13, draft PR #14 and all 64 Context Lock fingerprints. A base, branch, checkpoint or fingerprint mismatch blocks implementation and requires re-admission.
3. Preserve `HIGH_ASSURANCE`, the accepted M03 implementation and the canonical Checkpoint. No Checkpoint promotion is permitted.
4. Record official source URLs and retrieval date/revision. Preflight found that MetaMask Agent Wallet documents typed-data signing and lists Monad Testnet (10143); its installed-CLI chain list is authoritative, but `mm` is unavailable in this environment and no wallet session was exercised. Monad testnet threat-scanning coverage is not documented by the supported-chain table. Treat signed EIP-712 messages as owner authorization, not proof of M03 simulation or a provider effect.
5. Keep `MAINNET` effectful execution `HARD_BLOCKED` and live Perpl effects blocked. Create no transaction, wallet delegation mutation, provider write, `ARBITRARY_CALL`, unrestricted calldata or effect adapter.
6. Bind every capability to exact chain/account/agent/policy, bounded scope/limits, expiry and durable revocation state. Require durable nonces and cross-chain domain separation. Revocation wins pending authorization.
7. Observe EIP-7702 state at a finalized block, including delegate runtime code identity. `UNKNOWN`, stale, reorged, changed or revoked state blocks dependent authority. Never install or mutate a delegation.
8. No private key, seed phrase or mnemonic may be requested, stored, logged, returned or included in fixtures/evidence. Ephemeral test-only keys may exist only inside tests.
9. Preserve M03 policy, simulation, kill-switch, actor provenance, idempotency, replay, recovery and refusal gates. `LIQUIDATION_DISTANCE`, `MAINTENANCE_MARGIN` and `FUNDING_DIRECTION` remain non-authoritative/unproven. M03 `UNKNOWN` blocks.
10. A database-level kill-switch concurrency proof and documented disable-versus-in-flight semantics remain mandatory before any future live provider effect adapter. This Work Order does not create that adapter.
11. Keep the four MODERATE Drizzle Kit/esbuild advisories visible for release review. Do not suppress them or broaden scope to remove them.
12. Implement and verify every M04 acceptance/proof obligation, update only this WO/PR, complete the Evidence Bundle, inspect the full diff, run applicable exact-head checks, commit and push on the same branch, and update PR #14 as draft.
13. Do not merge, promote the Checkpoint, enable mainnet/live Perpl effects, force-push or start M05.

Stop only at `NERVA_M04_AGENT_WALLET_PERMISSIONS_EVIDENCE_READY_FOR_AUDIT` after the implementation and exact-head evidence are complete. Report failed or pending gates as such; never infer hosted service results or a live-chain observation.
