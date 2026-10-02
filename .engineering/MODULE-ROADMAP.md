# NERVA V0.1 Module Roadmap

Status: CANONICAL_CANDIDATE — M00

The roadmap intentionally uses a small number of large modules. Each M01-M06 should normally be implemented through one large primary Work Order/PR, with bounded Correction Deltas rather than fragmented follow-up PRs.

## M00 — Product, Competition & Source Pack Lock
Planning only. Freeze product truth, security, architecture, scope, DoD, integrations, demo and module contracts.
Stop: `NERVA_M00_SOURCE_PACK_READY_FOR_AUDIT`.

## M01 — Safety Kernel & Platform Foundation
Large WO scope: application/monorepo scaffold; typed core domain schemas; config/environment separation; Policy DSL skeleton + validator; safety invariants; logging/correlation; CI quality/security gates; test fixtures; deployment skeleton; kill-switch/config model.
Dependency: M00.
Stop: platform compiles/tests, core invariants executable, no financial execution yet.

## M02 — Monad/Perpl Data & Risk Intelligence
Large WO scope: Perpl REST/WebSocket adapter; position/market ingestion; Envio/indexer integration where admitted; freshness/sequence/reconnect handling; normalized RiskSnapshot; liquidation/margin/drawdown/exposure/funding metrics; deterministic Risk Engine; replay fixtures; dashboard read model.
Dependency: M01.
Stop: real/test data produces deterministic risk evidence; no autonomous signing.

## M03 — Policy Compiler, Simulation & Autonomous Execution
Large WO scope: natural-language proposal boundary; structured policy compiler/validator; activation/versioning; trigger evaluator; candidate action planner; dry-run/preflight; Perpl protective action adapter; idempotency/effect-state machine; bounded retries; refusal/recovery receipts.
Dependency: M02.
Stop: end-to-end dry-run and controlled testnet execution evidence with safety gates.

## M04 — Agent Wallet, Permissions & Verifiable Evidence
Large WO scope: live-doc-verified MetaMask Agent Wallet integration/plugin/skill surface; scoped permissions; authorization binding; human escalation where needed; Flight Recorder; Envio/onchain evidence commitments if admitted; revoke/pause/kill-switch UX; integration contract hardening.
Dependency: M03.
Stop: least-privilege autonomous flow with verifiable receipt; no app-custodied keys.

## M05 — Product Experience & Competition Demo
Large WO scope: polished responsive UI; onboarding; risk dashboard; policy builder; explainability; event timeline; alert UX; safe DEMO_ONLY shock simulator; 90-second demo journey; accessibility/performance polish; product analytics without sensitive tracking.
Dependency: M04.
Stop: feature freeze candidate; clean-session demo reproducible.

## M06 — Release Hardening, Deployment & Metropolis Submission
Large WO scope: regression/adversarial/chaos tests; dependency and smart-contract/config security review; performance evidence; production/read-only deployment; gated execution environment; recovery drill; README/ops docs; pitch/video/submission assets; track/bounty eligibility revalidation; final DoD audit.
Dependency: M05.
Stop: `NERVA_V0_1_METROPOLIS_RELEASE_APPROVED`.

## Dependency graph
M00 → M01 → M02 → M03 → M04 → M05 → M06.
No parallel module may bypass an unresolved predecessor gate.

## Schedule intent
- 02 Oct: M00
- 03 Oct: M01
- 04–05 Oct: M02
- 06–07 Oct: M03
- 08 Oct: M04
- 09–10 Oct: M05 / feature freeze
- 10–12 Oct: M06 / release candidate
- 13 Oct: contingency only, not feature development
