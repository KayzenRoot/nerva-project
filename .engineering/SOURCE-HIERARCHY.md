# NERVA Source Hierarchy

Status: CANONICAL — NERVA-WO-002

When sources disagree, use this order:
1. `.engineering/CHECKPOINT.md`
2. `.engineering/DECISIONS-LEDGER.md` and approved ADRs
3. `.engineering/SCOPE.md`
4. `.engineering/DEFINITION-OF-DONE.md`
5. `.engineering/ARCHITECTURE.md`
6. `.engineering/REQUIREMENTS.md`
7. `.engineering/SECURITY.md`
8. integration/data/API/UI/recovery contracts
9. module roadmap/backlog/competition/demo/monetization material
10. Work Orders and Evidence Bundles for the active increment
11. README and explanatory material

Git, code, tests, deployed artifacts and objective provider evidence override conversational memory when they prove current behavior.

## Rules
- A lower source may refine but never silently contradict a higher source.
- Approved decisions are changed only by a later explicit decision/ADR.
- Checkpoint promotion occurs only after objective audit.
- External program/API facts are observations, not canonical product truth; capability-sensitive facts must be revalidated during each module preflight.
- If Scope, DoD, Architecture, Checkpoint or a relevant decision changes, the active Context Lock becomes STALE until rebuilt.

## Current bindings
- Repository: `KayzenRoot/nerva-project`
- GEF: `@gef-bootstrap/cli@1.1.2`
- M01 execution base: `4dcdd3fd0cdd1ac7c8933839e7d70e60b925a955`
- Last approved Work Order: `NERVA-WO-002`
- M01: APPROVED
- Next implementation module: M02 — Work Order NOT_ADMITTED
- Product implementation: STARTED / M01 PLATFORM FOUNDATION
- M01 Context Lock is historical after promotion; M02 requires a fresh Context Lock against the merged M01 baseline.
