# NERVA M06 Release and Recovery Runbook

Status: M06 candidate operations procedure · HIGH_ASSURANCE

## Release boundaries

- The supported local release rehearsal is `TESTNET_DEMO`; it binds to `127.0.0.1` only.
- `NERVA_EXECUTION_ENABLED=false` and `NERVA_KILL_SWITCH_ENABLED=true` are fixed in the release Compose profile. The web image also labels its Git revision and `MAINNET` / live Perpl blocks.
- `MAINNET_EXECUTION` is rejected by configuration. Live Perpl writes remain unavailable; observation is disabled in the release profile.
- The demo is deterministic and synthetic. It never proves an actual provider fill, account state, wallet authorization, or financial outcome.
- Public release deployment requires a separately provisioned deployment target, TLS termination, runtime secret store, exact-SHA image push/receipt, and external health verification. No public deployment claim follows from the local rehearsal.

## Build and run the exact-SHA local image

Run from a clean checkout on the candidate commit. Keep the generated database password only in the shell environment; never place it in `.env`, source control, or evidence. The published ports default to loopback-only `3137` (web) and `5437` (PostgreSQL).

```powershell
$env:NERVA_RELEASE_SHA = (git rev-parse HEAD).Trim()
$secretBytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($secretBytes)
$env:NERVA_DB_PASSWORD = -join ($secretBytes | ForEach-Object { $_.ToString('x2') })
$releaseProject = "nerva-m06-$($env:NERVA_RELEASE_SHA.Substring(0, 7))"

docker compose -p $releaseProject -f compose.m06-release.yaml up -d --build
$env:DATABASE_URL = "postgresql://nerva:$($env:NERVA_DB_PASSWORD)@127.0.0.1:5437/nerva"
npm run db:smoke

(Invoke-RestMethod http://127.0.0.1:3137/api/health/live).executionEnabled
(Invoke-RestMethod http://127.0.0.1:3137/api/health/ready).safety.globalExecutionDisabled
docker image inspect "nerva-web:$($env:NERVA_RELEASE_SHA)" --format '{{.Id}} {{index .Config.Labels "org.opencontainers.image.revision"}}'
$env:NERVA_E2E_BASE_URL = 'http://127.0.0.1:3137'
$env:NERVA_E2E_EXPECTED_ENV = 'TESTNET_DEMO'
$env:NERVA_EVIDENCE_SCREENSHOT_DIR = '.engineering/evidence/NERVA-WO-007-artifacts'
npm run test:e2e
```

Expected health output is `executionEnabled = false`, `globalExecutionDisabled = true`, ready status, and the exact requested revision label. Record the local image ID, health response, commit SHA, and environment in the deployment receipt. The image is locally immutable by image ID; it is not a registry-published digest.

The local container does not enable authenticated Perpl observation, wallet/provider effects, transaction signing, or external execution. The disposable development database credential is not a production secret or enrollment proof.

## Health and recovery

- `/api/health/live` is process liveness; `/api/health/ready` also checks PostgreSQL and reports fail-closed global execution state.
- Server-side database configuration accepts `DATABASE_URL` first and Vercel-native `POSTGRES_URL` as a fallback. Neither value is exposed through `publicConfig` or browser bundles. This supports the official Vercel/Supabase integration without copying database credentials into Git.
- Before a public rollout, snapshot non-financial database state and verify the backup by restoring it into a new isolated database. Run migrations forward against the restored copy and recheck health. Do not treat an application rollback as reversal of any blockchain transaction.
- The M06 recovery drill is recorded in the Evidence Bundle with snapshot/restore and clean-schema migration results. Its marker data is synthetic, isolated, and carries no financial state.
- To roll an application release back, point the deployment at a previously recorded immutable image digest, restart only the web service, and verify the liveness/readiness endpoints. To roll forward, pin the target image to the new commit, apply the reviewed migrations, verify readiness and the global kill switch, and record the new receipt. If database state or effect outcome is ambiguous, stop and recover by verified forward procedure; do not blindly retry.
- Keep the global kill switch enabled during any release/recovery rehearsal. Mainnet effects and live Perpl writes remain blocked regardless of image version.

## External deployment and Metropolis submission

Before a public demo or submission, an operator must provision an HTTPS deployment target and runtime secret store, push the exact-SHA image to an immutable registry reference, and capture the public URL plus health response. HSTS is configured by the HTTPS ingress; do not expose this loopback rehearsal publicly.

Use only the authenticated Metropolis portal as final authority for the submission deadline and timezone, public-profile/repository rules, selected track, required assets, and sponsor-bounty eligibility. Public event summaries conflict on the exact deadline/time. Do not claim a sponsor bounty or submit until the portal confirms the current eligibility and the final deployment URL is healthy. The final submission remains a human/operator action.
