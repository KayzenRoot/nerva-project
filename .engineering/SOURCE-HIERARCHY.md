# NERVA Source Hierarchy

Status: CANONICAL — NERVA-WO-005

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
- Approved decisions change only through a later explicit decision/ADR.
- Checkpoint promotion occurs only after objective audit.
- External API/program facts are observations and must be revalidated when capability-sensitive.
- A new module requires a fresh Context Lock against its merged predecessor baseline.

## Current bindings
- Repository: `KayzenRoot/nerva-project`
- GEF: `@gef-bootstrap/cli@1.1.2`
- Last approved Work Order: `NERVA-WO-005`
- M00: APPROVED
- M01: APPROVED
- M02: APPROVED
- M03: APPROVED
- M04: APPROVED
- Runtime: M04 AGENT WALLET + BOUNDED PERMISSIONS + VERIFIABLE EVIDENCE
- Next implementation module: M05 — Work Order NOT_ADMITTED
