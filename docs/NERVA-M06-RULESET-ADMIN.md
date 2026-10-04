# NERVA M06 Ruleset Administration Gate

Status: VERIFIED_ACTIVE

On 2026-10-04, the versioned payload below was applied through the authenticated GitHub CLI. GitHub returned HTTP `201 Created`; a GET-after-write verified the active ruleset `24457588` at `refs/heads/main`. The Evidence Bundle records the full final JSON. The earlier connector limitation is resolved for this gate.

## Target

- Repository: `KayzenRoot/nerva-project`
- Ruleset name: `NERVA main / GEF protected flow`
- Target ref: `refs/heads/main`
- Enforcement: `active`
- Human approvals required: `0`
- Merge method: `squash`
- Review-thread resolution: required
- Strict status checks: required
- Force push: blocked
- Deletion: blocked
- Linear history: required
- Bypass actors: none

## Exact required checks

- `linux`
- `windows-bounded`
- `gef-validation`
- `source-pack`
- `SonarCloud Code Analysis`
- `Socket Security: Pull Request Alerts`
- `Socket Security: Project Report`

## Admin-capable GitHub CLI application

From a session where `gh auth status` shows a token with repository **Administration: write** permission:

```bash
gh api --method POST \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  /repos/KayzenRoot/nerva-project/rulesets \
  --input .engineering/repository-rulesets/nerva-main-gef-protected-flow.json
```

If a ruleset with the exact name already exists, do not POST a duplicate. Read its ID and PATCH that ruleset with the same payload.

## Mandatory verification

```bash
gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  /repos/KayzenRoot/nerva-project/rulesets
```

Then GET the exact ruleset by ID and confirm the response matches the checked-in payload semantically.

Do not continue M06 heavy implementation until the active ruleset is verified.
