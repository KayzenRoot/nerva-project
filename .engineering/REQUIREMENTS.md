# NERVA Requirements

Status: CANONICAL — NERVA-WO-001

## Functional requirements
- FR-001 Observe supported positions and market state with source/freshness metadata.
- FR-002 Compute deterministic risk metrics for supported positions.
- FR-003 Allow a user to create a structured protection policy.
- FR-004 Optionally translate natural language into a proposed structured policy; proposal has zero execution authority until validated and explicitly accepted.
- FR-005 Version/hash an activated policy and preserve its audit lineage.
- FR-006 Evaluate policy triggers against a consistent risk snapshot.
- FR-007 Produce an execution plan with bounded action size, slippage, protocol, market and expiry constraints.
- FR-008 Run required preflight/simulation checks before signing/execution.
- FR-009 Execute only through an admitted wallet/signing adapter with least privilege.
- FR-010 Support dry-run mode with no asset movement.
- FR-011 Generate an immutable execution/refusal receipt and human-readable explanation.
- FR-012 Provide an emergency kill switch and policy pause/revoke path.
- FR-013 Provide a portfolio/risk dashboard and event timeline.
- FR-014 Support a controlled demo shock simulator that is visibly DEMO_ONLY and cannot be confused with production market data.
- FR-015 Track integration health/freshness and refuse unsafe execution when dependencies are degraded.

## V0.1 risk signals
NECESSARY: liquidation distance/margin safety where available, drawdown, exposure, funding state, data freshness, action/slippage bounds.
IMPORTANT: volatility regime and multi-source price divergence when technically justified.
FUTURE: cross-protocol concentration, depeg/oracle/bridge/protocol risk scoring.

## Non-functional requirements
- NFR-001 HIGH_ASSURANCE security posture.
- NFR-002 No private key/seed phrase stored by NERVA application services.
- NFR-003 Deterministic safety decisions must be testable without an LLM.
- NFR-004 Idempotent execution planning and duplicate suppression.
- NFR-005 Fail closed on unknown/stale/inconsistent authorization-critical state.
- NFR-006 End-to-end traceability from observed snapshot through policy to receipt.
- NFR-007 Responsive web UI and WCAG-minded core flows.
- NFR-008 Explicit mainnet/testnet/environment separation.
- NFR-009 Secrets never committed; least-privilege runtime credentials.
- NFR-010 Observable latency, dependency health and execution outcome.

## Commercial requirements
- CR-001 Free monitoring surface may exist without creating forced trading fees.
- CR-002 Paid features/fees must be disclosed before authorization.
- CR-003 NERVA must not monetize by increasing churn, leverage, liquidation risk or hidden spread.
- CR-004 Architecture supports future B2B SDK/API licensing.

## Competition requirements
- COMP-001 Product remains useful if all sponsor bounties disappear.
- COMP-002 Sponsor integrations deepen the product rather than becoming decorative.
- COMP-003 Submission rules and bounty eligibility are reverified before submission.
- COMP-004 Core demo requires no hidden manual transaction.
