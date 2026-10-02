# NERVA 90-Second Demo Contract

Status: CANONICAL — NERVA-WO-001

## Goal
Prove the complete NERVA idea in <=90 seconds with no hidden manual repair.

## Required flow
**0–10s — Context**
Show Monad environment, connected wallet/account and a supported Perpl position. State the problem in one line.

**10–25s — Risk**
NERVA shows live/test admitted position state, liquidation/margin safety, drawdown/exposure/funding/freshness as implemented. Open one metric to prove provenance.

**25–40s — Policy**
User asks for protection in plain language or selects a template. NERVA renders the structured rule and limits. User explicitly confirms.

**40–55s — Deterioration**
DEMO_ONLY shock simulator or controlled testnet condition moves the position into the trigger zone. Synthetic state is visibly labeled if used.

**55–70s — Safety + action**
Show trigger evaluation, bounded execution plan and simulation/preflight. Wallet authorization executes or demonstrates exact bounded execution path.

**70–82s — Result**
Show confirmed/refused outcome and changed risk state where applicable.

**82–90s — Flight Recorder**
Show evidence: source snapshot → policy version → trigger → plan → preflight → wallet → chain/provider outcome. End with one sentence on expansion/B2B.

## Demo invariants
- demo works from documented clean state;
- reset is deterministic;
- no private secret shown;
- no fake transaction passed off as real;
- if live provider is unavailable, fallback dry-run is labeled;
- recording backup exists before submission;
- every UI feature shown as shipped is actually in the release.
