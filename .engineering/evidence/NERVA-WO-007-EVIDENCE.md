# NERVA-WO-007 Evidence Bundle

Status: NERVA_M06_RULESET_VERIFIED

- Work Order: NERVA-WO-007
- Issue: #19
- Module: M06
- Risk: HIGH_ASSURANCE
- Execution base: `b778b470eff4ff997def001899530512065e5676`
- Execution branch: `feat/nerva-wo-007-m06-release-hardening`
- Context Lock: LOCKED · 98/98 exact baseline fingerprints prepared
- Primary executor: Codex
- Canonical predecessor: NERVA-WO-006 / M05 APPROVED · MERGED · POST-MERGE VALIDATED
- M06 implementation: NOT_STARTED at admission package creation
- Checkpoint promotion: NOT_APPLIED
- MAINNET EFFECT: HARD_BLOCKED
- LIVE PERPL WRITES: BLOCKED
- Known HIGH/CRITICAL at admission: 0
- Existing MODERATE dependency advisories: 4 carry-forward

## Admission source check

- `main` baseline is `b778b470eff4ff997def001899530512065e5676`.
- Before the first executor task, `GET /repos/KayzenRoot/nerva-project/rulesets` returned `[]`; the ruleset was absent at that time.
- Therefore repository ruleset hardening is admitted as the first executor task.
- Public Metropolis material observed 2026-10-04 continues to indicate an October 2026 submission window, but current public sources conflict on the exact cutoff date/time. The authenticated/current official portal is required before submission truth is frozen.
- MetaMask Agent Wallet current material continues to describe self-custodial agent execution with user-defined constraints; chain-specific Transaction Shield coverage must not be inferred for Monad.

## Evidence to append during execution

- ruleset before/after JSON + ID;
- exact implementation head;
- changed files;
- full tests/checks;
- dependency advisory dispositions;
- release security review;
- deployment receipt/health;
- rollback/roll-forward drill;
- portal/track/bounty evidence;
- submission package;
- final DoD matrix;
- limitations and blockers.

## First executor task — repository ruleset verified

- Pre-write list GET on 2026-10-04 returned `[]`; no existing or unrelated repository ruleset was overwritten.
- Applied the exact versioned payload `.engineering/repository-rulesets/nerva-main-gef-protected-flow.json` using `gh api --method POST` with API version `2026-03-10`.
- POST result: HTTP `201 Created`; GitHub assigned ruleset ID `24457588`.
- GET-after-write: `GET /repos/KayzenRoot/nerva-project/rulesets/24457588`, received 2026-10-04 at 11:21:55 -03:00. Programmatic assertions all passed: `enforcement=active`; target exactly `refs/heads/main`; PR required; approving reviews `0`; review threads resolved; allowed merge method only `squash`; linear history required; force-push blocked by `non_fast_forward`; deletion blocked; strict checks enabled with exactly the seven Work Order contexts; no bypass actors and `current_user_can_bypass=never`.
- Required status checks verified: `linux`, `windows-bounded`, `gef-validation`, `source-pack`, `SonarCloud Code Analysis`, `Socket Security: Pull Request Alerts`, and `Socket Security: Project Report`.
- GitHub materialized `require_extra_approval_for_unattributed_changes=true` in the returned PR-rule parameters, although this field is absent from the versioned request. GitHub documents that this option has no effect when the configured approval count is zero ([available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)). The requested zero-approval policy remains effective.
- GET response JSON (complete final representation):

```json
{"id":24457588,"name":"NERVA main / GEF protected flow","target":"branch","source_type":"Repository","source":"KayzenRoot/nerva-project","enforcement":"active","conditions":{"ref_name":{"exclude":[],"include":["refs/heads/main"]}},"rules":[{"type":"deletion"},{"type":"non_fast_forward"},{"type":"required_linear_history"},{"type":"pull_request","parameters":{"required_approving_review_count":0,"dismiss_stale_reviews_on_push":false,"required_reviewers":[],"require_code_owner_review":false,"require_last_push_approval":false,"required_review_thread_resolution":true,"require_extra_approval_for_unattributed_changes":true,"allowed_merge_methods":["squash"]}},{"type":"required_status_checks","parameters":{"strict_required_status_checks_policy":true,"do_not_enforce_on_create":false,"required_status_checks":[{"context":"linux"},{"context":"windows-bounded"},{"context":"gef-validation"},{"context":"source-pack"},{"context":"SonarCloud Code Analysis"},{"context":"Socket Security: Pull Request Alerts"},{"context":"Socket Security: Project Report"}]}}],"node_id":"RRS_lACqUmVwb3NpdG9yec5Ti3gtzgF1MXQ","created_at":"2026-10-04T11:21:55.524-03:00","updated_at":"2026-10-04T11:21:55.601-03:00","bypass_actors":[],"current_user_can_bypass":"never","_links":{"self":{"href":"https://api.github.com/repos/KayzenRoot/nerva-project/rulesets/24457588"},"html":{"href":"https://github.com/KayzenRoot/nerva-project/rules/24457588"}}
```

- First-gate implementation HEAD before this evidence closeout: `01d26b9f0039d46b177fd2a682d2e56de3aab174`; only this Evidence Bundle and the admin runbook are being updated for the gate receipt.
- This completes the first executor gate only. M06 heavy implementation and later release/submission tasks remain NOT_STARTED; do not claim release readiness.

## Ruleset application package

- Exact ruleset payload artifact: `.engineering/repository-rulesets/nerva-main-gef-protected-flow.json`.
- Admin application/verification guide: `docs/NERVA-M06-RULESET-ADMIN.md`.
- Required policy is frozen to the Work Order target and current required check names.
- Ruleset `24457588` is verified active by the GET-after-write evidence above.
