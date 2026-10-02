# NERVA Deployment

Status: CANONICAL — NERVA-WO-001

## Environments
1. LOCAL — developer fixtures, no production signing.
2. TESTNET/DEMO — primary hackathon execution environment; synthetic shock simulator permitted only here.
3. MAINNET_READONLY — production market/position observation, execution disabled.
4. MAINNET_EXECUTION — prohibited until explicit M06 release gate.

Environment identity must be visible in UI/logs and enforced in configuration, not inferred by hostname alone.

## V0.1 deployment principles
- Web/API/worker/indexer may be separate deployables if required by reliability; avoid unnecessary services.
- Immutable build from Git commit SHA.
- Secret injection at runtime.
- Health endpoints for app, data provider/indexer and worker where applicable.
- Structured logs with correlation IDs, never sensitive signing material.
- Deployment receipt records commit SHA, environment, config schema version and health result.

## Mainnet execution release gate
Requires Security proof obligations, E2E on target configuration, kill-switch proof, dependency-health checks, wallet permission review, owner release approval and rollback/forward plan.

Metropolis submission does not require MAINNET_EXECUTION if the product can be credibly demonstrated through testnet/dry-run plus real read-only data. Safety outranks spectacle.

## Rollout
Feature flags for autonomous execution and demo simulator are independent. Default on unknown config is OFF.

## Rollback
Application deployments may roll back to a known build. Already-confirmed financial transactions are never "rolled back" by application deployment; recovery uses verified compensating/forward actions only when policy and protocol semantics allow them.
