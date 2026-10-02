# NERVA Test & Benchmark Plan

Status: CANONICAL_CANDIDATE — M00

## Test strategy by risk
All implementation modules are at least STANDARD. M03/M04/M06 are HIGH_ASSURANCE.

### Required layers
- unit tests for deterministic risk/policy/planning logic;
- contract tests for every external adapter;
- integration tests for data → risk → policy → plan → receipt;
- E2E for core user flows;
- adversarial/security tests for high-assurance boundaries;
- deterministic fixtures/replay for market scenarios;
- mainnet/testnet configuration separation tests;
- failure/recovery tests for timeouts, stale data and ambiguous effects.

## Core proof matrix
- RISK-01 same snapshot → same metrics.
- RISK-02 stale/missing required data → no executable decision.
- POL-01 invalid policy cannot activate.
- POL-02 candidate action cannot exceed policy bounds.
- POL-03 material policy revision requires new confirmation/version.
- EXEC-01 duplicate plan does not create duplicate effect.
- EXEC-02 failed preflight cannot reach signing.
- EXEC-03 ambiguous submission/finality is UNKNOWN, not retried blindly.
- EXEC-04 kill switch prevents new executions.
- AI-01 malformed/adversarial LLM output cannot bypass schema/authorization.
- DATA-01 provider disconnect/reorder/reconnect does not fabricate freshness.
- DEMO-01 synthetic demo data cannot reach production executor.
- SEC-01 no secret/private key appears in repository/log evidence.

## Performance targets
Targets are V0.1 engineering budgets, not marketing claims:
- Risk evaluation p95 target: <=100 ms for a single supported position after data is in memory.
- Policy evaluation p95 target: <=50 ms after RiskSnapshot.
- Internal decision-to-ready-plan p95 target: <=250 ms excluding provider/network latency.
- UI risk-state update target: <=1 s after admitted source update in normal conditions.
- No claim that NERVA beats chain finality or prevents all liquidations.

Benchmark methodology, hardware, sample size and provider conditions must be recorded. A benchmark without population/context is not accepted.

## Quality gates
- lint/typecheck/build: PASS;
- module-directed tests: PASS;
- regression suite: PASS;
- dependency/security scan: no unresolved HIGH/CRITICAL;
- HIGH_ASSURANCE modules: adversarial + recovery + integration proof required;
- exact-head hosted checks: green before merge.

## Hackathon release tests
- reproducible 90-second demo from documented seed/state;
- clean deployment from documented config;
- no hidden manual repair;
- fallback demo recording and deterministic dry-run path;
- links/README/submission assets verified before submission.
