# NERVA API Contracts

Status: CANONICAL_CANDIDATE — M00
Planning-level interface contracts. Transport/framework and exact paths are frozen in owning Work Orders.

## Read surfaces
- getPortfolioRisk(wallet/network) → current RiskSnapshot summary + freshness.
- getPositionRisk(positionId) → metrics, status and evidence refs.
- getPolicy(policyId/version?) → structured policy + lifecycle.
- listEvents(correlation filters) → Flight Recorder timeline.
- getIntegrationHealth() → provider states and lag/freshness.

## Policy surfaces
- proposePolicy(naturalLanguage/context) → UNTRUSTED structured proposal + diagnostics. Never activates.
- validatePolicy(structuredPolicy) → deterministic validation report.
- confirmPolicy(validatedPolicy, userAuthorization) → immutable PolicyVersion activation or refusal.
- pausePolicy / revokePolicy → deterministic state transition.

## Execution surfaces
- evaluate(policyVersion, riskSnapshot) → TriggerEvaluation.
- plan(triggerEvaluation) → bounded ExecutionPlan or REFUSED.
- simulate/executionPreflight(plan) → SimulationResult.
- authorize(plan, walletContext) → external authorization result.
- execute(authorizedPlan) → ExecutionAttempt reference.
- getExecutionStatus(attemptId) → receipt/effect state.

## Contract rules
- Every mutation accepts/returns correlation and idempotency identifiers.
- Safety-critical API responses include schema version.
- Unknown/partial effects use explicit UNKNOWN/RECOVERY_REQUIRED states.
- No endpoint accepts arbitrary natural-language instruction as direct execution authority.
- Error algebra distinguishes validation, policy refusal, stale data, provider failure, authorization refusal, submission failure and unknown effect.
- Public UI APIs never expose provider/API signing secrets.
