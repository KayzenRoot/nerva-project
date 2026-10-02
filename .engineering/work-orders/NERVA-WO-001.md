# NERVA-WO-001 — M00 Product, Competition & Source Pack Lock

**Status:** ADMITTED  
**Risk:** HIGH_ASSURANCE  
**Module:** M00  
**Mode:** PLANNING_ONLY  
**Issue:** #3  
**Execution base:** `main@d9f20cdd6d7bcc024d5c13ead2eceeb7c73eab6c`  
**Execution branch:** `plan/nerva-wo-001-m00-source-pack`  
**GEF:** `@gef-bootstrap/cli@1.1.2`

## OBJECTIVE
Create and freeze NERVA's first canonical product truth before implementation, converting the broader Guardian thesis into a Monad-native, non-custodial Risk Autopilot V0.1 optimized for a real Metropolis submission and a sustainable post-hackathon business.

## CONTEXT
NERVA inherits Guardian's broad autonomous-finance concept but narrows V0.1 to a defensible, demoable product: continuous risk observation, deterministic user-authored policy enforcement, bounded autonomous protective actions, and verifiable execution evidence. Perpl is the primary V0.1 trading integration. MetaMask Agent Wallet and Envio are strategic integrations subject to live capability verification.

Metropolis public portal currently states 1 Sep–13 Oct 2026 and $250,000+ prize pool. Public program material describes Onchain Finance & Trading as market/asset infrastructure enabled by fast settlement. Current public ecosystem posts advertise Perpl API and Analytics/Risk bounties and a MetaMask Agent Wallet trading-plugin bounty. Sponsor eligibility remains a verification gate, never an assumption.

## SCOPE
- Product/competition lock.
- Complete canonical Source Pack.
- High-assurance security and proof obligations.
- Architecture/integration/data/API/UI planning contracts.
- Monetization principles.
- M00-M06 roadmap with large Work Orders.
- Demo contract and Metropolis release gates.
- Explicit uncertainties and preflight gates.

## OUT OF SCOPE
Runtime code, smart contracts, real signing, live fund movement, deployment, hackathon submission, sponsor SDK installation, token issuance, speculative bounty claims.

## FILES / SOURCES TO READ
- Context Lock for this Work Order.
- NERVA main at the execution base.
- Accepted NERVA-WO-000 and Evidence Bundle.
- Current Monad Metropolis public portal/track material.
- Current Monad developer docs.
- Current Perpl API docs.
- Current MetaMask Agent Wallet docs.
- Current Envio docs.

## REQUIREMENTS
1. New-project Source Pack minimum set must exist before M01.
2. NERVA is non-custodial.
3. AI may interpret/propose; deterministic code must validate/authorize.
4. Unknown, stale or divergent safety-critical state fails closed.
5. No unlimited authority by default.
6. Autonomous actions are bounded, attributable, explainable and receipt-driven.
7. Demo-only behavior is explicitly isolated.
8. Monetization is transparent and does not profit from user loss.
9. Planning distinguishes NECESSARY, IMPORTANT, FUTURE and OUT OF SCOPE.
10. Each implementation module should normally map to one large primary Work Order/PR.
11. No product implementation receives credit in M00.

## ARCHITECTURE RULES
- Separate observation, decision, authorization and execution planes.
- Signing/key boundary is external and least-privilege.
- Every risk input carries source and freshness.
- Every execution has idempotency, preconditions, simulation/preflight and receipt.
- Active policy revisions are immutable; changes create a new authorized version.
- Circuit breakers, manual kill switch and fail-closed defaults are mandatory.
- Mainnet execution remains disabled until an explicit release gate.
- Sponsor adapters cannot become the core domain model.

## CONSTRAINTS
- Deadline-sensitive: internal submission target is 12 Oct 2026; public portal states 13 Oct 2026.
- Product must remain valuable if no bounty is won.
- No hidden manual operation may be required for the core 90-second demo.
- No security shortcut solely to meet the hackathon deadline.

## ACCEPTANCE CRITERIA
1. Canonical source hierarchy exists.
2. Required Source Pack minimum files exist.
3. Competition, integration, monetization, UI, data and recovery contracts exist where needed.
4. Guardian→NERVA relationship is unambiguous.
5. V0.1 scope and post-hackathon boundaries are explicit.
6. Security covers agentic/Web3/autonomous-execution threats.
7. Requirements trace into Architecture, Test Plan and DoD.
8. M00-M06 dependency graph is acyclic and has stop conditions.
9. Demo contract is <=90 seconds and reproducible.
10. Checkpoint says implementation NOT_STARTED.
11. Git diff is planning/docs only.
12. CRITICAL/HIGH inconsistencies = 0.

## TESTS
- Source hierarchy and contradiction audit.
- Requirements/architecture/test/DoD traceability.
- Scope-class audit.
- Threat coverage audit.
- Module DAG/cycle audit.
- Competition overfitting audit.
- Planning-only Git diff audit.
- GEF validation remains green.

## DELIVERABLES
Source Pack, module roadmap, competition strategy, integration contracts, monetization, demo contract, Context Lock, Evidence Bundle, proposed Checkpoint Delta, audit-ready PR.

## REVIEW FORMAT
Português brasileiro. Audit exact head against Scope, Requirements, Architecture, Security, Integration Contracts and DoD; report CRITICAL/HIGH and one verdict.

## STOP CONDITION
`NERVA_M00_SOURCE_PACK_READY_FOR_AUDIT`

No M01 implementation Work Order may be admitted before APPROVED + merge.