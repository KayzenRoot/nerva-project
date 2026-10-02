# NERVA Integration Contracts

Status: CANONICAL — NERVA-WO-001

External APIs are capability dependencies, not product truth. Each owning module must re-read current provider docs before coding.

## Monad
Role: execution chain and settlement substrate.
Observed V0.1 network identity through current Perpl docs: mainnet chain ID 143; testnet 10143. M01/M02 must confirm against Monad official docs/config before freezing runtime constants.
Rules:
- environment-specific RPC/config;
- block/tx identifiers retained in evidence;
- finality/reorg semantics must be represented honestly;
- no timing guarantee is inferred from marketing performance numbers.

## Perpl
Role: primary V0.1 perpetual position/market/trading integration.
Current public API docs expose REST + WebSocket, public market data, authenticated position/order/profile surfaces and trading streams; mainnet/testnet configurations are documented.
Contract expectations:
- adapter owns provider schema translation;
- sequence/freshness/reconnect behavior is tested;
- rate limits are respected;
- API keys/signatures are never logged;
- read-only and trading capabilities are separated;
- protective execution cannot exceed NERVA Policy bounds;
- builder codes/fees, if adopted, require explicit user disclosure/consent and a separate decision.

Preflight blockers: unavailable authenticated test account; undocumented field semantics needed for liquidation/risk; trading permission model incompatible with least privilege.

## MetaMask Agent Wallet
Role: preferred external signing/agent execution surface.
Current MetaMask material describes self-custodial agent wallets, spend limits, protocol allowlists, risk configuration and transaction security pipeline, and identifies Monad among supported EVM execution targets.
Monad-specific security caveat:
- Current MetaMask Agent Wallet material supports EVM execution including Monad, but the current Transaction Shield/Blockaid coverage list does not list Monad among supported chains. NERVA MUST NOT assume Blockaid threat-scanning coverage on Monad. M04 preflight must prove exactly which simulation/threat/MEV protections apply on the target network and version; missing wallet-layer protection does not weaken NERVA's own policy/preflight requirements.

Contract expectations:
- no NERVA storage of wallet secret material;
- exact current extension/plugin/skill mechanism is verified in M04;
- NERVA authorization binds policy version + plan digest + expiry;
- wallet refusal/2FA/escalation is a first-class outcome;
- wallet security checks supplement, never replace, NERVA policy checks.

Bounty-specific "plugin" eligibility is NOT a frozen API claim until portal/current docs are verified.

## Envio
Role: preferred onchain indexing/evidence component where useful.
Current docs describe HyperIndex event indexing, GraphQL query layer, real-time tracking, reorg support, and HyperSync data access.
Contract expectations:
- indexer lag/freshness is observable;
- reorg behavior is tested;
- indexer data cannot be assumed authoritative for provider-internal Perpl state not emitted onchain;
- API token is a runtime secret;
- direct Perpl API and indexed onchain evidence may coexist with explicit provenance.

## Integration health states
UNKNOWN, HEALTHY, DEGRADED, STALE, UNAVAILABLE.
Only HEALTHY inputs may satisfy an execution-critical dependency unless a policy explicitly defines a safe degraded path proven by tests.

## General rule
No provider exception may bypass the core Policy, Simulation/Preflight, Authorization or Evidence planes.
