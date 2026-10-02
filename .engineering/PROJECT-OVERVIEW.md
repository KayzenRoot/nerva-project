# NERVA Project Overview

Status: CANONICAL — NERVA-WO-001

## Product
NERVA is a non-custodial autonomous risk and policy execution layer for onchain finance, initially built for Monad.

Guardian is the broader thesis: a horizontal autonomous-finance protection layer spanning protocols, portfolios and agents. NERVA is the productized first implementation of that thesis. The names are not competing products. Guardian describes the long-horizon architecture; NERVA is the product and company surface.

## V0.1 problem
Leveraged and fast-moving onchain positions can deteriorate faster than a human can monitor them. Existing wallets can enforce signing/security constraints, but the user still needs a system that continuously observes position risk, evaluates explicit user policies, prepares bounded defensive actions and produces evidence explaining why an action was or was not executed.

## V0.1 promise
"Define the risk you will tolerate. NERVA watches continuously and acts only inside the rules you approved."

NERVA does not promise profit, predict markets, or guarantee prevention of losses/liquidations.

## V0.1 target
Primary user: active Monad trader with Perpl positions.
Secondary user: sophisticated DeFi user who wants explainable automated protection.
Future customer: wallets, exchanges, fintechs and protocols integrating NERVA risk/policy APIs.

## Product principles
- self-custody;
- user-defined authority;
- AI-assisted, never AI-trusted for authorization;
- deterministic fail-closed safety;
- explainability and receipts;
- transparent monetization;
- Monad-native low-latency UX;
- architecture that can expand beyond one protocol without making sponsor adapters the domain model.

## Success for Metropolis
A judge can understand the problem in seconds and see a real end-to-end sequence: live/controlled market state → risk deterioration → policy trigger → deterministic validation/simulation → bounded execution or safe refusal → receipt/Flight Recorder.

## Long-term direction
Perps → lending → spot/liquidity → yield/portfolio risk → B2B risk/policy SDK/API, retaining a common policy and evidence core.
