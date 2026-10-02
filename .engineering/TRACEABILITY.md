# NERVA V0.1 Traceability Matrix

Status: CANONICAL_CANDIDATE — M00

| Requirement cluster | Owner module | Architecture plane | Primary proof |
|---|---|---|---|
| FR-001/002 observations + risk | M02 | Observation/Risk | DATA-01, RISK-01/02, replay/integration |
| FR-003/005 policy lifecycle | M01/M03 | Policy | POL-01/03, schema/version tests |
| FR-004 AI proposal boundary | M03 | Policy | AI-01 adversarial tests |
| FR-006 trigger evaluation | M03 | Policy | deterministic policy fixtures |
| FR-007 planning bounds | M03 | Planning | POL-02 |
| FR-008 simulation/preflight | M03 | Planning | EXEC-02 |
| FR-009 external signing | M04 | Authorization | permission/authorization contract tests |
| FR-010 dry-run | M03 | Planning/Execution | E2E no-effect proof |
| FR-011 evidence/receipt | M03/M04 | Evidence | correlation/receipt E2E |
| FR-012 kill/pause/revoke | M01/M04 | Policy/Authorization | EXEC-04 |
| FR-013 dashboard/timeline | M05 | Experience | UI E2E/accessibility |
| FR-014 demo isolation | M05 | Experience | DEMO-01 |
| FR-015 integration health | M02/M04 | Observation | provider outage/staleness tests |
| NFR-001..006 safety | M01-M04 | cross-cutting | high-assurance regression/adversarial |
| NFR-007 UX | M05 | Experience | responsive/accessibility checks |
| NFR-008/009 env/secrets | M01/M06 | deployment | config/secrets/deploy tests |
| NFR-010 observability | M01/M06 | evidence/ops | telemetry/health evidence |
| CR-001..004 monetization | M05/M06 | product/business | UI disclosure + pitch/product audit |
| COMP-001..004 competition | M05/M06 | release | demo/submission audit |

Every NECESSARY requirement must have an implemented owner and proof before V0.1 may be declared complete.
