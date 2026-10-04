# NERVA M06 Ruleset Administration Gate

Status: BLOCKED_RULESET_ADMIN

The connected ChatGPT GitHub App can verify repository state but does not expose Administration-write ruleset mutations for this repository. This file pins the exact intended ruleset payload so an admin-capable GitHub CLI/API session can apply it without interpretation drift.

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
