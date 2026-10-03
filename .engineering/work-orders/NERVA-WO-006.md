# NERVA-WO-006 — M05 Product Experience & Competition Demo

**Status:** ADMITTED — OWNER AUTHORIZED  
**Risk:** HIGH_ASSURANCE  
**Module:** M05  
**Issue:** #15  
**Execution base:** `main@5243c2808f258996c11e5e2fa9dffa5af96041cd`  
**Execution branch:** `feat/nerva-wo-006-m05-product-demo`  
**GEF:** `@gef-bootstrap/cli@1.1.2`  
**Primary executor:** Codex  
**Review language:** pt-BR

## OBJECTIVE

Turn the approved M00–M04 NERVA runtime into a polished, responsive, accessible and truthful competition-grade product experience that can prove the complete NERVA story from a documented clean session in <=90 seconds.

M05 owns the Experience Plane and demo orchestration only. It MUST make the existing deterministic risk, policy, simulation, wallet/permission and evidence systems understandable and memorable without inventing authority, data, provider capability or financial effects that the runtime does not possess.

The resulting product must support:
- a normal read/operate experience for admitted non-effectful capabilities;
- an explicitly isolated `DEMO_ONLY` mode with deterministic synthetic shock scenarios;
- a guided 90-second competition journey;
- one-click deterministic reset;
- clear source/freshness/provenance and limitation language;
- a Flight Recorder that visually proves why NERVA evaluated, authorized, refused or simulated an action;
- English default with complete pt-BR and Spanish critical flows.

M05 MUST NOT enable any live Perpl write or mainnet effect. Where the demo reaches the effect boundary, it must truthfully present `DRY_RUN_ONLY`, `SIMULATED_OUTCOME`, `BLOCKED` or another exact runtime state. A synthetic result must never look like an onchain/provider-confirmed transaction.

## CONTEXT

M00–M04 are APPROVED / MERGED / POST_MERGE_VALIDATED.

The accepted M04 runtime provides:
- deterministic Perpl/Monad observation and RiskSnapshot foundations;
- structured policies, trigger evaluation, planning and simulation/preflight;
- a closed financial effect boundary;
- wallet/agent identity, bounded capability grants, owner-signed EIP-712 authorization;
- read-only EIP-7702 delegation observation;
- durable nonce/replay protection, session authority and revocation;
- verifiable permission/evidence chain and M03 boundary revalidation.

Canonical carry-forward constraints:
1. `MAINNET effectful execution = HARD_BLOCKED`.
2. Live Perpl effects remain BLOCKED because no provider-side protective-only capability/scope and enrollment provenance are proven.
3. Production trusted-issuer configuration is not provisioned; affected mutation paths fail closed.
4. DB-level kill-switch concurrency proof remains mandatory before any future live provider effect adapter.
5. Four MODERATE Drizzle Kit/esbuild transitive advisories remain for release recheck.
6. `LIQUIDATION_DISTANCE`, `MAINTENANCE_MARGIN`, and `FUNDING_DIRECTION` remain non-authoritative/unproven.
7. MetaMask Agent Wallet `mm` CLI was unavailable in M04; no CLI-session or Transaction Shield coverage claim exists.

Competition truth from the canonical M00 sources remains observational until M06 revalidation. M05 optimizes the demo around product clarity and truthful shipped capabilities, not around unverified sponsor claims.

### Product thesis for M05

The judge should understand NERVA in one sentence:

> NERVA turns fast onchain finance into policy-governed protection, showing the exact risk, permission and evidence chain behind every decision.

The product must make four things visually obvious:
1. **Risk is observable and deterministic.**
2. **Authority is bounded and user-controlled.**
3. **Unknown/stale state blocks rather than guesses.**
4. **Every decision has a verifiable evidence trail.**

## SCOPE

### 1. Visual system and application shell

Create a coherent NERVA visual system using the existing React/Next.js stack and the fewest new dependencies possible.

Required:
- professional dark-first interface suitable for finance/security;
- semantic design tokens for surface, text, status, spacing, radius, typography and motion;
- responsive application shell with desktop navigation and compact/mobile monitoring;
- visible environment/mode indicator on every financially relevant screen;
- status must never depend on color alone;
- no heavy decorative 3D/WebGL dependency in V0.1;
- motion must respect `prefers-reduced-motion`;
- no visual claim such as “safe”, “protected”, “executed” or “verified” unless the underlying state supports it.

### 2. Information architecture / routes

Deliver the M05 product journey using the canonical UI/UX information architecture:

1. Onboarding / environment / wallet-account status.
2. Portfolio Overview.
3. Position Risk Detail.
4. Policy Builder.
5. Policy Review & Confirmation.
6. Active Protection / Live Monitor.
7. Flight Recorder.
8. Integrations & Permissions.
9. Emergency Controls / system safety status.

The executor may consolidate screens where that improves the 90-second flow, but the semantic capabilities must remain accessible.

### 3. Onboarding and truth-status panel

Provide a first-run/status experience that answers:
- network/environment;
- `LIVE_READ_ONLY` vs `DEMO_ONLY`;
- Perpl observation availability;
- account/position availability;
- wallet identity/grant/session state;
- trusted issuer availability;
- live effect capability = BLOCKED;
- mainnet effect capability = HARD_BLOCKED.

No fake connection state. Missing provider credentials or trusted issuer must display an honest unavailable/limited state.

### 4. Risk dashboard

Create a judge-readable portfolio/position risk experience with:
- account/position/market context;
- current normalized metrics that are actually proven;
- freshness/source indicators;
- integration health;
- active policy summary;
- drill-down provenance drawer/panel;
- clear `FRESH | STALE | UNKNOWN | INCONSISTENT` semantics;
- no universal opaque AI risk score.

For unproven metrics:
- liquidation distance;
- maintenance margin;
- funding direction;
show explicit `UNAVAILABLE_UNPROVEN` / `UNKNOWN` with explanation, never an invented number.

### 5. Policy Builder and review

Make policy creation understandable without adding new authority.

Required:
- safe protection templates for `REDUCE_POSITION`, `CLOSE_POSITION`, and `NO_ACTION`;
- optional plain-language input only as an **untrusted proposal** using the already admitted M03 proposal boundary;
- structured rule preview always shown before confirmation;
- trigger, action, max action fraction/notional, slippage, market/position, cooldown/expiry and refusal behavior visible;
- clear distinction between `DRAFT`, `VALIDATED`, `USER_CONFIRMED`, `ACTIVE`, `PAUSED`, `REVOKED`, `EXPIRED`;
- no UI shortcut that bypasses current backend trust requirements.

Do not add an external LLM dependency unless a separate preflight proves it NECESSARY; M05 can succeed using templates and the existing proposal boundary.

### 6. Permission / wallet experience

Surface the M04 model clearly:
- wallet/account identity;
- EIP-7702 observation state;
- agent identity;
- grant actions and limits;
- session state;
- expiry/revocation generation;
- what is allowed and explicitly blocked;
- evidence verification state.

Present `REDUCE_POSITION` / `CLOSE_POSITION` capability independently from unavailable provider write capability. “Authorized by policy” is not the same as “provider effect available.”

### 7. Active Protection / decision monitor

Create a step-based view of:
`OBSERVED → ELIGIBLE → PLANNED → PREFLIGHTED → AUTHORIZED → EFFECT BOUNDARY → RECEIPT`.

Every stage must render actual state and refusal reason.

If effect capability is blocked, the UI must stop at the truthful boundary and show why. Never animate or label a fictitious provider transaction as submitted/confirmed.

### 8. DEMO_ONLY trust domain

Implement a deterministic synthetic demo mode completely separated from live/provider state.

Required invariants:
- visible, persistent `DEMO ONLY — SYNTHETIC DATA` indicator;
- a demo view model carries explicit `sourceKind: DEMO_FIXTURE` or equivalent;
- demo fixtures/state cannot be persisted into live market/position/risk/provider tables;
- demo endpoints or client state cannot invoke effectful execution routes;
- no demo control can toggle live runtime controls or wallet authority;
- demo state is deterministic from versioned fixture/scenario IDs;
- one-click reset restores the documented initial state;
- browser refresh/restart behavior is documented and reproducible;
- synthetic post-action risk is labeled `SIMULATED OUTCOME`, never live/confirmed.

### 9. Demo scenarios

Ship a small versioned scenario pack, not an open-ended simulator.

Minimum scenarios:
- **Protection Story:** fresh position → adverse move → policy trigger → bounded plan → simulation PASS → wallet/permission proof → closed provider effect boundary → simulated protective result + Flight Recorder.
- **Stale Feed Refusal:** source becomes STALE/UNKNOWN → NERVA refuses to proceed.
- **Permission Revocation:** active session/grant becomes revoked → authorization stops.
- **Delegate Changed:** EIP-7702 delegation changes → dependent authority invalidated.
- **Integration Degraded:** provider health degrades → decision becomes non-actionable.

The 90-second guided mode may use Protection Story as its default. At least one refusal scenario must be easy to show to judges.

### 10. 90-second guided demo

Implement a `Guided Demo` flow aligned with the canonical Demo Contract:

- **0–10s:** Monad/test environment, account and position context.
- **10–25s:** deterministic risk state + provenance.
- **25–40s:** protection template/plain-language proposal → structured constraints → explicit confirmation representation.
- **40–55s:** visibly DEMO_ONLY shock.
- **55–70s:** trigger → plan → simulation/preflight → wallet/permission boundary.
- **70–82s:** truthful result. If no live effect capability exists, show `SIMULATED OUTCOME / PROVIDER EFFECT BLOCKED`.
- **82–90s:** Flight Recorder evidence chain and expansion/B2B closing line.

Guided mode is UI orchestration, not a bypass around backend safety.

### 11. Flight Recorder experience

Upgrade the Flight Recorder into the signature trust surface.

For each decision show, when available:
- source snapshot identity/provenance/freshness;
- RiskSnapshot and relevant metrics;
- policy/version/hash;
- trigger condition and evaluation;
- execution plan and constraints;
- simulation/preflight;
- wallet/grant/session/authorization evidence;
- kill-switch/environment decision;
- execution/refusal/recovery receipt;
- permission evidence-chain verification.

Hash/reference values may be shortened visually but full values must be inspectable/copyable without exposing secrets.

### 12. Emergency / safety controls UX

Expose current safety state:
- global execution disabled / kill-switch status;
- policy pause/revoke state;
- grant/session revoke state;
- live effect capability;
- integration degradation.

Only wire mutations already admitted and objectively safe. Where production trusted issuer is unavailable, show the control as unavailable/fail-closed rather than mocking success.

### 13. Truthful demo data architecture

Create strict schemas/view models that make the following impossible to silently conflate:
- live/read provider data;
- persisted canonical runtime evidence;
- demo fixture;
- simulated outcome;
- unavailable/unknown state.

All financially meaningful UI components must receive explicit source/mode metadata.

### 14. Internationalization

English remains default.

Complete critical M05 flows in:
- English;
- Brazilian Portuguese;
- Spanish.

Critical safety labels/refusals must not fall back to an untranslated key.

### 15. Accessibility

Core demo and normal read paths must be keyboard operable.

Required:
- semantic landmarks/headings;
- form labels;
- focus visibility;
- dialogs/drawers have accessible names and focus behavior;
- status has text/icon semantics, not color alone;
- reduced motion respected;
- no critical contrast failure in core screens;
- automated accessibility checks on key routes plus targeted manual keyboard evidence.

### 16. Responsive design

Required evidence at minimum:
- desktop: 1440×900;
- mobile: 390×844.

No horizontal clipping on primary flows. Desktop can expose richer evidence; mobile must preserve current status, safety and monitoring comprehension.

### 17. Performance budgets

M05 is demo-critical; avoid decorative bloat.

Measure on hosted/local production build with documented methodology.

Targets:
- no route-level uncaught JS errors during the guided demo;
- core guided route interactive within an admitted, recorded budget on CI/local benchmark;
- avoid adding >250 KiB gzip-equivalent first-load JS to a single M05 route unless objectively justified;
- no large unoptimized image/video bundled into app source;
- animation cannot block interaction.

If exact Next.js bundle metrics cannot be measured reliably in CI, record the closest objective build/browser metrics and limitations instead of inventing numbers.

### 18. End-to-end browser proof

Admit a browser E2E tool only after exact dependency/security preflight. Prefer Playwright if current stable support and CI cost are acceptable.

Required automated journeys:
- clean-session guided demo;
- reset and repeat produces same deterministic story;
- demo/live labeling;
- stale refusal;
- session/grant revocation refusal;
- mobile smoke;
- keyboard/accessibility smoke;
- no console error on critical journey.

CI must not require external wallet secrets or provider credentials.

### 19. Privacy-safe product analytics

Implement a first-party/no-op/local analytics abstraction only if useful for demo/product measurement.

Allowed events:
- screen viewed;
- guided-demo phase;
- demo reset;
- scenario selected;
- policy template selected;
- refusal category.

Forbidden analytics payloads:
- wallet address;
- account/position ID;
- raw policy/plan/grant/session hashes;
- notional/position sizes;
- signatures/nonces;
- provider/API credentials;
- free-form natural-language text.

No third-party analytics SaaS is necessary for M05.

### 20. Demo reset / runbook

Provide:
- one-command or one-action clean demo reset;
- versioned fixture/scenario identifiers;
- exact local startup steps;
- expected environment;
- known limitations;
- backup demo recording checklist placeholder for M06.

A developer/judge must be able to reproduce the guided demo without hidden manual DB repairs.

### 21. CI / evidence

Preserve every existing M01–M04 gate and add M05-specific proof:
- targeted/global format policy without unrelated cleanup;
- lint/typecheck/build;
- full unit/adversarial/replay/recovery suite;
- browser E2E;
- demo fixture isolation gate;
- no-live-effect static gate;
- i18n completeness;
- accessibility smoke;
- responsive viewport proof;
- performance/bundle evidence;
- clean migrations / accepted upgrade regression;
- client secret scan;
- npm audit HIGH;
- GEF 1.1.2;
- Context Lock;
- Source Pack;
- Linux;
- bounded Windows where applicable;
- SonarCloud;
- Socket Security.

## OUT OF SCOPE

- Enabling mainnet financial effects.
- Live Perpl writes or a new provider effect adapter.
- Claiming a provider transaction occurred when only dry-run/demo simulation exists.
- New autonomous actions beyond `REDUCE_POSITION`, `CLOSE_POSITION`, `NO_ACTION`.
- New wallet custody/key management.
- Installing/changing EIP-7702 delegation.
- New unbounded session/grant capability.
- Treating unproven risk metrics as actionable/precise.
- New trading strategy, leverage, market making, copy trading or profit promise.
- Broad design-system/package rewrite unrelated to the M05 experience.
- Heavy 3D/WebGL spectacle that harms performance/accessibility.
- New sponsor integration solely for bounty optics.
- Envio implementation unless separately proven NECESSARY to close a M05 demo/DoD blocker.
- Production analytics/tracking.
- M06 deployment/submission packaging, final bounty eligibility decision or release-gate changes.
- Checkpoint promotion or merge during executor implementation.
- Any M06 work.

## FILES / SOURCES TO READ

Read in this order before implementation:
1. `.engineering/CHECKPOINT.md` + JSON.
2. Decisions Ledger + approved ADRs.
3. Scope.
4. Definition of Done.
5. Architecture.
6. Requirements.
7. Security.
8. Data/API/Integration/UI/Migration contracts.
9. Competition Strategy and Demo Contract.
10. Test/Benchmark Plan and Deployment.
11. Module Roadmap / Backlog.
12. M04 Work Order, Context Lock, Evidence and promoted Checkpoint Delta.
13. Current web/app/runtime files fingerprinted by the M05 Context Lock.
14. This Work Order + Context Lock.

Current competition/sponsor observations may inform UI copy but MUST NOT be converted to eligibility claims. M06 revalidates official portal/track/bounty rules before submission.

## REQUIREMENTS

1. Use the accepted M04 APIs/contracts rather than duplicating risk/policy/permission truth in client code.
2. Every rendered safety-critical state must have explicit source/mode/provenance.
3. `DEMO_ONLY` is a separate trust domain and must be visually persistent.
4. Synthetic state never enters live/provider evidence tables.
5. No demo code may call an effectful mainnet/live provider route.
6. No fake transaction hash, block confirmation, wallet approval or provider receipt.
7. A simulated outcome must use explicit simulated wording.
8. Unknown/stale/unproven remains visibly non-authoritative.
9. UI cannot widen policy/grant/session authority.
10. No new secret/key custody.
11. Existing M03/M04 authorization, replay, revocation and evidence boundaries remain authoritative.
12. Mainnet effect remains hard-blocked.
13. Live Perpl effects remain blocked.
14. English default; pt-BR and Spanish critical flows complete.
15. Clean-session demo is deterministic/repeatable.
16. No hidden manual repair between guided demo runs.
17. User-facing claims avoid “guaranteed safe”, “cannot be liquidated”, “AI will save you”, guaranteed profit or equivalent language.

## ARCHITECTURE RULES

- Experience Plane consumes domain/API view models; it does not become a new authority plane.
- Demo fixtures are versioned immutable inputs and explicitly tagged synthetic.
- Prefer pure deterministic demo reducers/state machines over mutable global magic.
- Demo/live source identity is required at component/view-model boundaries.
- Server Components remain default; client components are bounded to interaction.
- Avoid adding a new state-management framework unless objective complexity requires it.
- Avoid adding a component library solely for styling.
- M05 may add browser test tooling but must exact-pin after preflight.
- No provider/wallet SDK is added just to fake a demo connection.
- Flight Recorder remains append/evidence-oriented; UI cannot rewrite evidence history.
- “Blocked” and “refused” are successful safety outcomes when that is what runtime truth says.

## CONSTRAINTS

- `HIGH_ASSURANCE`.
- One large module-level WO/PR.
- Same PR uses bounded Correction Deltas for safe findings.
- No force push/history rewrite.
- No unrelated cleanup.
- No M06 because time remains.
- Direct dependencies exact-pinned after registry/security preflight.
- CI must not depend on secret wallets/provider credentials.
- Four existing MODERATE advisories remain visible.
- Any introduced HIGH/CRITICAL blocks readiness.
- If a locked source changes from execution base, mark Context Lock STALE and stop.

## ACCEPTANCE CRITERIA

1. M05 shell is coherent, responsive and production-build clean.
2. Environment/mode/effect-capability status is visible on all critical screens.
3. Dashboard shows only proven metrics numerically and explicit limitations for unproven metrics.
4. Risk provenance/freshness is inspectable.
5. Policy templates compile to existing admitted structures without bypass.
6. Plain-language UX remains proposal-only.
7. Structured constraints are visible before any confirmation.
8. M04 grant/session limits are understandable in UI.
9. Guided demo is reproducible from a documented clean state.
10. Guided demo completes its scripted story in <=90 seconds under recorded test methodology, excluding human narration variance.
11. One-click reset restores the same fixture/scenario state.
12. DEMO_ONLY label is persistent during synthetic scenarios.
13. Demo fixture cannot contaminate live/provider DB tables.
14. Demo controls cannot toggle live kill switch/authority/effects.
15. Synthetic post-action state is labeled SIMULATED OUTCOME.
16. No fake transaction/provider confirmation exists.
17. Stale-feed scenario visibly refuses.
18. Permission-revocation scenario visibly refuses.
19. Delegate-changed scenario visibly invalidates authority.
20. Degraded-provider scenario becomes non-actionable.
21. Flight Recorder displays source→risk→policy→trigger→plan→simulation→permission→decision/outcome lineage.
22. Evidence verification/tamper state is visible.
23. Emergency/safety state is visible without unsafe bypasses.
24. English/pt-BR/Spanish critical flows pass completeness tests.
25. Core journey is keyboard operable.
26. Automated accessibility smoke has no admitted critical violations on key screens.
27. 1440×900 and 390×844 core journeys have no blocking layout overflow.
28. Reduced-motion behavior is honored.
29. No critical route console errors in E2E.
30. Browser E2E can run without wallet/provider secrets.
31. Privacy-safe analytics allowlist contains no sensitive identifiers/free text.
32. No external analytics network dependency is required.
33. Existing 125-test M04 regression remains green or is superseded by documented greater coverage.
34. Clean migration and accepted upgrade smoke remain green.
35. Client bundle/secret scan remains green.
36. MAINNET effect remains HARD_BLOCKED.
37. Live Perpl effect remains BLOCKED.
38. No private key/seed/mnemonic path exists.
39. `LIQUIDATION_DISTANCE`, `MAINTENANCE_MARGIN`, `FUNDING_DIRECTION` remain non-authoritative.
40. npm audit has no introduced HIGH/CRITICAL.
41. GEF 1.1.2, Source Pack and Context Lock are green on exact head.
42. Linux/Windows applicable gates, SonarCloud and Socket are green.
43. Evidence Bundle includes exact base/head, screenshots/browser proof references, tests, performance, a11y, i18n, demo isolation, claims/limitations and remaining risks.
44. CRITICAL/HIGH introduced findings = 0.
45. M06 remains unstarted.

## TESTS / PROOF OBLIGATIONS

- `M05-UI-001`: desktop critical journey.
- `M05-UI-002`: mobile critical journey.
- `M05-MODE-001`: live/read vs DEMO_ONLY cannot be confused.
- `M05-DEMO-001`: deterministic Protection Story.
- `M05-DEMO-002`: reset/repeat yields equivalent fixture state.
- `M05-DEMO-003`: demo state cannot persist into live observation/evidence tables.
- `M05-DEMO-004`: synthetic outcome never renders as confirmed provider effect.
- `M05-REFUSE-001`: stale source refusal.
- `M05-REFUSE-002`: grant/session revoked refusal.
- `M05-REFUSE-003`: EIP-7702 delegate changed refusal.
- `M05-REFUSE-004`: integration degraded refusal.
- `M05-RISK-001`: unproven metrics never render an authoritative number.
- `M05-POLICY-001`: template renders exact structured constraints.
- `M05-POLICY-002`: plain language remains untrusted proposal.
- `M05-PERM-001`: bounded permission summary matches M04 read model.
- `M05-FR-001`: complete evidence timeline and verification state.
- `M05-I18N-001`: critical strings complete EN/PT-BR/ES.
- `M05-A11Y-001`: keyboard/focus/landmarks/status/reduced-motion.
- `M05-RESP-001`: 1440×900 and 390×844 visual/layout smoke.
- `M05-PERF-001`: recorded production-build/browser and bundle budget evidence.
- `M05-ANALYTICS-001`: analytics event payload privacy allowlist.
- `M05-SEC-001`: no demo route can reach financial effect.
- `M05-SEC-002`: no secret/key material in client/demo fixtures.
- `M05-REG-001`: M01–M04 regressions remain green.
- `M05-CLEAN-001`: documented clean-session setup/reset/repeat.

## DELIVERABLES

- competition-grade M05 web experience;
- visual tokens/styles and responsive shell;
- onboarding/status experience;
- risk dashboard and position detail;
- policy builder/review;
- active protection monitor;
- M04 permissions surface refinement;
- Flight Recorder refinement;
- emergency/safety status UX;
- isolated versioned DEMO_ONLY scenario engine/fixtures;
- Guided Demo <=90s;
- deterministic reset;
- EN/PT-BR/ES critical-copy coverage;
- browser E2E/accessibility/responsive/performance proof;
- privacy-safe analytics abstraction if admitted;
- demo/operator runbook;
- updated docs matching shipped behavior;
- `.engineering/evidence/NERVA-WO-006-EVIDENCE.md`;
- `.engineering/checkpoint-deltas/NERVA-WO-006-PROPOSED.md`.

Executor commits/pushes to this branch and updates the existing PR. Do not merge.

## REVIEW FORMAT

Final executor report in Brazilian Portuguese:
- base/head SHA;
- Context Lock state/fingerprint count;
- changed-file inventory;
- demo architecture and live/demo separation;
- 90-second flow proof;
- screenshots/E2E viewport proof references;
- tests/checks/counts;
- accessibility/i18n/performance results;
- demo reset/reproducibility;
- security/effect-boundary proof;
- dependency findings;
- known limitations and truthful competition claims;
- Evidence Bundle;
- proposed Checkpoint Delta;
- explicit STOP CONDITION.

## STOP CONDITION

`NERVA_M05_PRODUCT_DEMO_READY_FOR_AUDIT`

Do not merge. Do not promote the canonical Checkpoint. Do not begin M06.
