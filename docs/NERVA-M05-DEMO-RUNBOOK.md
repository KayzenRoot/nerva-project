# NERVA M05 Demo Runbook

## Trust boundary

`/demo` is a local-only, deterministic experience using the immutable `nerva-m05-demo-v1` fixture pack. Its state lives only in the mounted page. It does not call an API, open a wallet, connect to Perpl, read or write the database, or change execution controls. Every demo screen keeps the `DEMO ONLY · SYNTHETIC DATA` marker visible. The result is always described as `SIMULATED OUTCOME` or `REFUSED`; the trace is explicitly not cryptographic/provider evidence.

The normal product routes use `LIVE READ ONLY` labels. They display provider freshness/status for observations already available to the application. Mainnet effect is `HARD_BLOCKED`, and live Perpl writes are `BLOCKED`.

## Local guided walkthrough

1. Use Node.js 22 or newer and install the repository's locked dependencies with `npm ci`.
2. Start the web application with `npm run dev:web`.
3. Open `http://localhost:3000/demo?lang=en` for English, `?lang=pt-BR` for Brazilian Portuguese, or `?lang=es` for Spanish.
4. Select **Start guided demo**. The eight phases advance every 12 seconds; the scripted completion budget is 84 seconds and excludes human narration.
5. Select any named refusal scenario to inspect its fail-closed state. The demo remains synthetic.
6. Select **Reset demo** to return to the same initial fixture and repeat. Reset does not touch a database, provider or browser storage.

No wallet, provider API credential, trusted issuer, database seed, manual database repair or external analytics account is required for `/demo`. Other read-only product pages may show unavailable states when their optional database/provider configuration is absent.

## Browser proof

Run `npm run m05:demo:verify` for the static isolation guard and `npm run test:e2e` for the browser journeys. Playwright is pinned to `@playwright/test@1.63.0`, uses Chromium, one worker and no provider/wallet secrets. CI installs the matching Chromium binary. The E2E evidence captures desktop `1440×900` and mobile `390×844` screenshots under `.engineering/evidence/NERVA-WO-006-artifacts/`.

The tests use a deterministic browser clock to validate the 84-second phase schedule without waiting 84 wall-clock seconds. This proves the scheduled runtime, not an end-to-end human presentation duration.

## Known limits

- The fixture values, grant, delegation, provider health and simulated result are fictional and cannot be used as financial evidence or authority.
- The local demo trace is not cryptographically verified and is never added to the Flight Recorder persistence chain.
- M05 does not enable live Perpl writes or any mainnet effect. M06 deployment/submission activities are not included.
- Browser accessibility automation catches common WCAG A/AA issues; keyboard and reduced-motion smoke is included, but it does not replace a full manual assistive-technology assessment.

## Demo recording checklist placeholder

- [ ] Reproduce the guided run from a clean browser session.
- [ ] Keep the persistent synthetic-data marker visible in the recording.
- [ ] Show one refusal scenario and the local Flight Recorder lineage.
- [ ] Do not show a synthetic value as a provider observation or claim an actual transaction.
- [ ] Revalidate competition/track claims separately before any M06 submission.
