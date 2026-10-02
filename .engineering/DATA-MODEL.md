# NERVA Data Model

Status: CANONICAL — NERVA-WO-001
Logical model only; physical database technology belongs to M01.

## Core entities
- UserProfile: non-sensitive product preferences and account linkage identifiers.
- WalletBinding: public address/network/provider references; no seed/private key.
- IntegrationConnection: provider, capability set, health/freshness metadata.
- PositionSnapshot: normalized position state with provider provenance.
- MarketSnapshot: normalized market state with provenance/sequence/time.
- RiskSnapshot: immutable correlation of admitted position/market observations.
- RiskMetric: typed metric, value/unit, confidence/quality/freshness.
- Policy: stable logical identity.
- PolicyVersion: immutable structured rules, hash, activation state, timestamps.
- TriggerEvaluation: snapshot + policy version + deterministic result/reason.
- ExecutionPlan: bounded intended effect, plan digest, expiry, constraints.
- SimulationResult: plan digest, predicted/checked effects, status.
- AuthorizationRecord: external signer/wallet decision reference and scope.
- ExecutionAttempt: idempotency identity and lifecycle state.
- ExecutionReceipt: final/unknown/refused result with chain/provider references.
- IntegrationHealthSample: provider health/lag/error observation.
- AuditEvent: append-oriented product evidence event.

## Data invariants
- Financial evidence records are append-oriented; corrections create linked superseding records.
- PolicyVersion content does not mutate after USER_CONFIRMED.
- ExecutionPlan binds exactly one PolicyVersion and one RiskSnapshot.
- AuthorizationRecord binds one plan digest.
- ExecutionAttempt idempotency key is unique within its execution domain.
- Sensitive credential material is not a persisted domain entity.

## Retention
V0.1 retains enough evidence to reproduce demo and investigate executions. Exact retention durations become a deployment/privacy decision before public production use.

## Privacy
Store the minimum user-identifying data needed for product operation. Public wallet addresses are still treated as privacy-relevant application data and are not sold or repurposed for advertising.
