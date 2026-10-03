# NERVA-WO-004 — Codex Execution Brief

Execute the admitted **NERVA-WO-004 / Issue #10** on branch `feat/nerva-wo-004-m03-policy-sim-exec`.

1. Read the complete Work Order, Context Lock, M02 Evidence Bundle and closeout first.
2. Verify `main@31cce06cf68aab0a82d3801ed6177b8a3b311869`, the exact branch, and all 36 locked fingerprints. Run `npm run context:validate`; if base or lock is stale, stop without editing product code.
3. Preserve `HIGH_ASSURANCE`; implement only the admitted M03 scope.
4. Revalidate current official Perpl and Monad primary documentation before provider-dependent implementation. M02 and Work Order observations are historical and do not prove current capabilities.
5. Mainnet effectful execution is hard-blocked. The only possible effectful M03 environment is controlled TESTNET after exact actor/authorization and provider enrollment/scope provenance is verified.
6. The autonomous V0.1 action allowlist is exactly `REDUCE_POSITION`, `CLOSE_POSITION`, and `NO_ACTION`. Keep `LIQUIDATION_DISTANCE=UNAVAILABLE_UNPROVEN` and `MAINTENANCE_MARGIN` / `FUNDING_DIRECTION=UNKNOWN` throughout this WO; any status upgrade needs separate scope admission.
7. `UNKNOWN` simulation blocks. The kill switch prevails. Idempotency/replay protection are mandatory. Never blindly retry an ambiguous possible effect.
8. Do not implement or start M04, wallet integration, mainnet effects, Checkpoint promotion, or merge.
9. Implement tests, migrations, CI, documentation and Evidence Bundle within this WO/PR; correct introduced failures in the same PR; commit and push the same branch; keep the PR draft unless explicitly told otherwise.
10. Stop only at `NERVA_M03_POLICY_SIM_EXEC_READY_FOR_AUDIT`; report in Brazilian Portuguese.
