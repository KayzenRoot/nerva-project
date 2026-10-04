# NERVA — Metropolis V0.1 Submission Draft

Status: PREPARED · NOT SUBMITTED · public deployment healthy · authenticated-portal evidence pending

## Project profile

- **Name:** NERVA
- **Tagline:** Read-only risk context and bounded policy simulation for perpetual markets.
- **Candidate track:** Onchain Finance & Trading. Final track selection must be confirmed in the authenticated Metropolis portal.
- **Repository:** https://github.com/KayzenRoot/nerva-project
- **Deployed demo:** https://nerva-project-31wbwncgs-claytons-projects-5922d27c.vercel.app — exact Vercel deployment of `56ad064abc6df05ee8f52dc864005b250030ccf8`; liveness and readiness are HTTP 200, database is `HEALTHY`, execution remains disabled.
- **Portal deadline/timezone and eligibility:** owner completed GitHub OAuth. Public Monad material says submissions close October 13 and recent Monad developer announcements state 11:59 PM ET, but authenticated portal readback is still required before freezing deadline/timezone, fields, track, and bounty eligibility.
- **Sponsor bounty selections:** NONE claimed yet. Public Metropolis material currently advertises Perpl bounties for Best Use of Perpl API and Best Analytics / Risk Tool; both are strong NERVA candidates, but authenticated portal eligibility must be confirmed before either is selected.

## Problem and solution

Perpetual-market risk decisions are difficult to inspect when market freshness, account state, policy bounds, permissions, and execution state are split across tools. NERVA presents deterministic risk context and bounded policy decisions with explicit stale/unknown handling, owner-authorized permission evidence, a durable audit trail, and a guided synthetic demo.

NERVA's V0.1 safety boundary makes read-only observation and policy simulation demonstrable while keeping financial effects blocked. It does not claim to prevent all liquidations, predict price movement, or guarantee execution outcomes.

## Monad and Perpl relevance

NERVA targets Monad's EVM environment for bounded wallet identity and permission evidence, including read-only EIP-7702 delegation observation. Account/position observation from Perpl uses the explicitly scoped read-only API path when credentials and source data are provisioned. It does not submit Perpl orders or claim protective-only order permissions.

## Security and limitations

- `MAINNET` effectful execution is `HARD_BLOCKED`.
- Live Perpl writes are `BLOCKED`.
- Only `REDUCE_POSITION`, `CLOSE_POSITION`, and `NO_ACTION` exist in the autonomous V0.1 action allowlist; trusted authorization, simulation, revocation, kill-switch, nonce, idempotency, and recovery controls remain mandatory.
- `LIQUIDATION_DISTANCE`, `MAINTENANCE_MARGIN`, and `FUNDING_DIRECTION` remain `UNAVAILABLE_UNPROVEN` / non-authoritative.
- The language model has no financial authority. No private key, seed phrase, or mnemonic is stored by NERVA.
- DEMO_ONLY data is synthetic, persistently labeled, deterministic, isolated from provider persistence, and cannot be represented as an actual execution.
- Four MODERATE development-tooling dependency advisories are carried forward with a bounded risk disposition in the Evidence Bundle. No known HIGH or CRITICAL audit finding remains.

## 90-second demo outline

1. Open the deployed NERVA URL in a clean session and confirm the visible `TESTNET_DEMO` identity and safety labels.
2. Start the guided demo; show deterministic observation and risk context, then inspect the bounded policy and read-only permissions experience.
3. Trigger the synthetic deterioration scenario and show that a simulation result is explicitly `SIMULATED OUTCOME` / `DRY_RUN_ONLY` with no provider receipt or transaction.
4. Open Flight Recorder lineage, reset, and replay to the same deterministic closeout.

The guided scenario and refusal paths are covered by the M05 Playwright journey. Do not record or publish the demo until the public URL, current portal requirements, and final screenshots are verified.

## Submission checklist

- [x] Project name, tagline, problem/solution, technical highlights, Monad and Perpl relevance, security limitations, and demo script drafted.
- [x] Public repository URL recorded.
- [x] Immutable public deployment URL and health receipt.
- [ ] Authenticated portal deadline/timezone, required fields/assets, visibility rules, track confirmation, and sponsor eligibility proof.
- [ ] Final screenshots captured against the deployed candidate.
- [ ] Human review and submission through the official portal.

Do not treat this draft as a submitted entry or a bounty claim.
