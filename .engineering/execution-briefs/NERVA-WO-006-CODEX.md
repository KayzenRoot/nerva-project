# NERVA-WO-006 — Codex Execution Brief

Execute the admitted **NERVA-WO-006 / Issue #15** on branch `feat/nerva-wo-006-m05-product-demo`.

1. Read the full Work Order and `.engineering/context-locks/NERVA-WO-006.json`.
2. Verify exact base `5243c2808f258996c11e5e2fa9dffa5af96041cd` and all 89 fingerprints. If stale, STOP.
3. Perform dependency/browser-tool preflight before adding any package.
4. Implement the complete M05 only: polished responsive product UX, risk/policy/permission/evidence experiences, isolated deterministic DEMO_ONLY scenario engine, Guided Demo <=90s, reset/replay, EN/PT-BR/ES, accessibility, browser E2E, performance/privacy proof and Evidence Bundle.
5. Do not add financial authority. MAINNET stays HARD_BLOCKED; live Perpl effects stay BLOCKED.
6. Synthetic/demo state must never be represented as live/provider-confirmed and must never contaminate live provider/evidence persistence.
7. Preserve M03/M04 policy, authorization, replay, revocation, kill-switch and evidence boundaries.
8. Fix failures introduced inside this WO, commit/push, update the existing PR, and stop at `NERVA_M05_PRODUCT_DEMO_READY_FOR_AUDIT`.
9. Do not merge, promote Checkpoint or start M06.
10. Final report in pt-BR.
