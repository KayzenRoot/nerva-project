# NERVA-WO-007 — Codex Execution Brief

Execute the admitted M06 Work Order in issue #19 on branch `feat/nerva-wo-007-m06-release-hardening`.

1. Read the full Work Order and fresh Context Lock first.
2. Confirm `origin/main == b778b470eff4ff997def001899530512065e5676`; otherwise stop `BLOCKED_CONTEXT_STALE`.
3. First task: configure the repository ruleset exactly as specified using `gh api`, re-read it, and record the ruleset ID/config. Do not weaken it to make CI easier.
4. Then execute only M06 release-hardening/deployment/submission scope.
5. Preserve `MAINNET EFFECT = HARD_BLOCKED` and `LIVE PERPL WRITES = BLOCKED` unless a separate explicit release decision objectively proves and admits otherwise.
6. Revalidate the current official/authenticated Metropolis portal before any deadline/track/bounty claim.
7. Run all HIGH_ASSURANCE proof obligations, fix failures introduced by this WO, update Evidence Bundle and proposed Checkpoint Delta, commit/push and update the same PR.
8. No force push. No merge. No Checkpoint promotion.
9. Final report in pt-BR.

STOP: `NERVA_V0_1_METROPOLIS_RELEASE_READY_FOR_AUDIT`.
