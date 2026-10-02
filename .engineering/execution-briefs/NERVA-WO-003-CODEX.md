# NERVA-WO-003 — Codex Execution Brief

Execute the admitted **NERVA-WO-003 / Issue #7** on branch `feat/nerva-wo-003-m02-data-risk`.

1. Read the full Work Order and Context Lock.
2. Verify base `166789a107dff6700b7dfab8f240184be14fe3c4` and all critical fingerprints. If stale, STOP.
3. Revalidate current Perpl/Monad docs before dependency/provider implementation.
4. Implement the entire M02 only: read-only Perpl REST/WS, normalized observations, freshness/sequence/reconnect, deterministic Risk Engine, persistence, replay fixtures, read APIs/dashboard read model, tests/CI/Evidence.
5. Perpl authentication may sign only API read requests with exact `read` scope. Do not add wallet/transaction signing, trade/order requests, or execution paths.
6. Liquidation distance may be emitted only with Perpl-specific proof; otherwise return explicit UNAVAILABLE_UNPROVEN.
7. Envio is optional/IMPORTANT and must be truthfully implemented or explicitly deferred.
8. Fix failures introduced inside this WO, commit/push, update the existing PR, and stop at `NERVA_M02_DATA_RISK_READY_FOR_AUDIT`.
9. Do not merge, promote Checkpoint or start M03.
10. Final report in pt-BR.
