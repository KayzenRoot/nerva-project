# NERVA Architecture

Status: CANONICAL_CANDIDATE — M00

## Architectural style
Modular TypeScript-first application with explicit domain boundaries. Exact framework/package versions are selected in the owning implementation Work Order after live-doc preflight.

## Planes
1. **Observation Plane** — adapters ingest market, position and onchain data; every observation carries source, timestamp/block/sequence and freshness state.
2. **Risk Plane** — deterministic functions transform a consistent snapshot into normalized metrics and risk state.
3. **Policy Plane** — structured versioned policies, validation, activation, trigger evaluation and explainability.
4. **Planning/Simulation Plane** — creates bounded candidate actions and verifies preconditions/simulation.
5. **Authorization/Signing Plane** — external wallet/signing capability; NERVA never treats an LLM or backend secret as unconditional authority.
6. **Execution Plane** — protocol adapter submits permitted actions with idempotency and bounded retries.
7. **Evidence Plane** — Flight Recorder correlates snapshot, policy, decision, simulation, execution/refusal and final state.
8. **Experience Plane** — dashboard/policy builder/demo and operational controls.

## Core domain objects
`RiskSnapshot`, `RiskMetric`, `Policy`, `PolicyVersion`, `TriggerEvaluation`, `ExecutionPlan`, `AuthorizationContext`, `ExecutionAttempt`, `ExecutionReceipt`, `IntegrationHealth`.

Sponsor/provider objects cannot leak into these core interfaces; adapters translate provider-specific models.

## Trust boundaries
- Browser/user ↔ NERVA app.
- NERVA services ↔ external APIs/indexers.
- NERVA policy/planner ↔ wallet signer.
- Wallet signer ↔ Monad.
- Monad ↔ protocol contracts.
- Demo simulator is a separate trust domain marked synthetic.

## Required state machine
Policy: DRAFT → VALIDATED → USER_CONFIRMED → ACTIVE → PAUSED/REVOKED/EXPIRED.
Execution: OBSERVED → ELIGIBLE → PLANNED → PREFLIGHTED → AUTHORIZED → SUBMITTED → CONFIRMED or REFUSED/FAILED/UNKNOWN.
UNKNOWN never auto-promotes to success.

## Safety invariants
- No execution without an active policy version.
- Observations used for financial decisions meet freshness rules.
- Plan must be a subset of policy authority.
- Authorization must bind plan digest + policy version + expiry.
- Duplicate plan identity cannot create duplicate financial effect.
- Any ambiguous final effect becomes UNKNOWN/RECOVERY_REQUIRED, never blind retry.
- Mainnet execution is disabled until release gate is explicitly satisfied.

## Deployment shape V0.1
Web app + server/API + workers/risk evaluator + indexer + datastore as needed. Keep components minimal for deadline, but preserve domain seams so workers/indexer/providers can be replaced later.
