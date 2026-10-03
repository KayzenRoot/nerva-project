# NERVA-WO-003 — M02 Monad/Perpl Data & Risk Intelligence

**Status:** ADMITTED — OWNER AUTHORIZED  
**Risk:** HIGH_ASSURANCE  
**Module:** M02  
**Issue:** #7  
**Execution base:** `main@166789a107dff6700b7dfab8f240184be14fe3c4`  
**Execution branch:** `feat/nerva-wo-003-m02-data-risk`  
**GEF:** `@gef-bootstrap/cli@1.1.2`  
**Primary executor:** Codex  
**Review language:** pt-BR

## OBJECTIVE

Implement NERVA's complete V0.1 Observation Plane and deterministic Risk Plane for Monad/Perpl in one large governed increment.

M02 must ingest current Perpl market/account/position state through read-only REST/WebSocket capabilities, normalize provider data into provider-neutral domain snapshots, track freshness/sequence/reconnect integrity, compute deterministic explainable risk metrics, persist append-oriented evidence, expose read-only risk APIs/dashboard read models, and produce replayable test evidence.

M02 MUST remain incapable of moving funds.

## CONTEXT

M00 and M01 are APPROVED and merged. M01 established the safety kernel, typed domain, strict policy skeleton, fail-closed environments, execution-off boundary, PostgreSQL/Drizzle foundation, structured logging and CI.

Canonical M02 scope from the Module Roadmap:
- Perpl REST/WebSocket adapter;
- position/market ingestion;
- Envio/indexer where admitted;
- freshness/sequence/reconnect handling;
- normalized RiskSnapshot;
- liquidation/margin/drawdown/exposure/funding metrics;
- deterministic Risk Engine;
- replay fixtures;
- dashboard read model.

### Current provider facts observed 2026-10-02

Executor MUST revalidate these before coding.

Perpl current public docs at observed main revision expose:
- public REST context and market-data endpoints without auth;
- public market-data WebSocket;
- authenticated `GET /v1/trading/positions`, wallet and portfolio endpoints with any API-key scope;
- trading WebSocket read snapshots/updates with a read-scoped API key;
- order placement requires trade scope;
- API authentication uses an Ed25519 API-key pair, not a bearer/session token;
- read scope is sufficient for account/position reads and must be the only admitted M02 scope;
- mainnet chain ID 143 and testnet 10143;
- market-data WebSocket heartbeat/sequence semantics and documented reconnect on sequence gaps;
- REST 429 and 503 require bounded backoff/degraded handling;
- position snapshots do not expose a ready-made liquidation-price field.

Perpl exposes market config, mark/oracle prices, collateral, entry price, size, leverage/funding fields and portfolio equity/PnL series. NERVA MUST NOT infer exact liquidation distance from a generic perpetuals formula unless Perpl-specific contract/SDK semantics are objectively proven.

## SCOPE

### 1. New module/package topology

Add the smallest M02-owned packages needed. Preferred shape:

```text
packages/
  perpl/          # provider adapter, auth signer, REST/WS transport, provider schemas
  risk/           # pure deterministic normalized risk engine
```

Existing packages remain canonical:
- `domain`: provider-neutral domain objects/invariants;
- `contracts`: serialized API/domain contracts;
- `config`: environment and provider config;
- `observability`: correlation/redaction;
- `db`: persistence;
- `testing`: deterministic fixtures.

Dependency rules:
- `risk` MAY depend on `domain` only, plus pure internal numeric helpers;
- `risk` MUST NOT import Perpl/provider code;
- `perpl` translates provider schemas to normalized domain input;
- apps may compose provider + risk packages;
- no circular workspace dependency;
- no provider-specific field names may leak into public RiskSnapshot contracts.

### 2. Provider-neutral observation model

Extend domain/contracts with explicit immutable normalized objects:

- `ObservationEnvelope`
- `MarketSnapshot`
- `PositionSnapshot`
- `AccountSnapshot`
- `PortfolioSeriesSnapshot`
- `RiskSnapshot`
- `RiskMetric`
- `IntegrationHealth`
- `ProviderCheckpoint`

Every safety-relevant observation MUST carry:
- schema version;
- source/provider;
- network/chain ID;
- observed/source timestamp;
- received timestamp;
- source block when available;
- sequence/session identity where available;
- freshness/quality;
- correlation ID;
- deterministic content hash.

Quality states remain explicit:
`FRESH | STALE | UNKNOWN | INCONSISTENT`.

UNKNOWN/stale required data cannot be treated as zero, empty, healthy or current.

### 3. Numeric normalization

Use integer/BigInt/fixed-point math for provider values.

Required:
- no JS floating-point arithmetic for financial amounts, notional or risk ratios where precision can affect decisions;
- preserve Perpl price/size decimals and collateral-token decimals explicitly;
- normalize ratios to integer basis points or an explicitly versioned fixed-point representation;
- preserve raw provider units only inside adapter-private types/evidence where needed;
- test max/min boundary values and rounding direction.

Rounding for safety metrics MUST be conservative and documented.

### 4. Perpl configuration

Add typed server-only M02 config:
- `PERPL_API_URL`
- `PERPL_WS_URL`
- `PERPL_CHAIN_ID`
- optional `PERPL_API_KEY`
- optional `PERPL_API_KEY_SECRET`
- explicit `PERPL_API_KEY_SCOPE=read` when authenticated mode is enabled;
- freshness budgets;
- reconnect/backoff bounds.

Rules:
- only Monad mainnet/testnet identities admitted;
- URL/network mismatch fails closed;
- authenticated account mode requires a complete read-only credential set;
- any configured scope other than exactly `read` is refused in M02;
- API-key secret is server-only, runtime-injected, never persisted in DB, never emitted to logs/evidence/client bundles;
- absence of credentials keeps public market observation functional and authenticated account state UNAVAILABLE, not fake empty.

M02 does not enroll keys and does not request wallet private keys.

### 5. Perpl REST adapter

Implement bounded, typed read operations for:
- public context;
- ticker/market state required by M02;
- authenticated positions;
- authenticated wallet/account snapshot;
- authenticated portfolio equity/PnL series as needed for drawdown.

Transport requirements:
- strict response validation before normalization;
- explicit timeouts;
- bounded retry only for idempotent reads;
- 429 exponential/jittered bounded backoff;
- 503 => DEGRADED/backoff, never healthy;
- 401/403 => credential/scope failure, no infinite retry;
- 404 no exchange account => explicit EMPTY_ACCOUNT/UNAVAILABLE_ACCOUNT semantics, not transport failure;
- unexpected schema => INCOMPATIBLE/UNKNOWN and fail closed.

No POST order endpoint exists in M02 source.

### 6. Perpl public market-data WebSocket

Implement read-only subscriptions needed for risk:
- heartbeat;
- market-config;
- market-state;
- funding;
- optional candles only if required by admitted drawdown/replay logic.

Requirements:
- batch subscriptions within documented limits;
- subscription-result validation;
- sequence tracking;
- heartbeat strict progression where documented;
- sequence gap immediately marks stream STALE and forces reconnect/resnapshot;
- bounded exponential reconnect with jitter;
- no optimistic continuation across a gap;
- duplicate funding event `feb` is an update to the same funding interval, not a second independent event;
- disconnected socket never leaves old state labeled FRESH.

### 7. Perpl authenticated read-only stream

Implement account/position stream only if credentials are configured:
- first authentication frame uses the documented API-key signature;
- only read-scoped credentials admitted;
- consume wallet/account/position snapshots and updates;
- establish sequence baseline from the documented snapshot/heartbeat semantics;
- sequence gap => invalidate current account/position observation, reconnect and rebuild from fresh snapshot;
- account `fw` is observed as data only. M02 never changes order forwarding.

Forbidden:
- `OrderRequest`;
- batch order submission;
- trade-scoped key;
- order-forwarding mutation;
- exchange-account creation;
- wallet-key usage;
- signer/transaction submission.

CI/static gates must prove these paths are absent.

### 8. Integration health state machine

For each dependency/stream expose:
`UNKNOWN | HEALTHY | DEGRADED | STALE | UNAVAILABLE`.

At minimum track:
- Perpl public REST;
- Perpl market WS;
- Perpl account REST/WS when configured;
- Monad RPC health if used;
- optional Envio evidence source if admitted.

Health includes reason, last-good instant, lag/age, reconnect count and relevant source checkpoint.

Only HEALTHY/FRESH dependencies may produce an execution-eligible future input. M02 itself produces no execution eligibility.

### 9. Deterministic Risk Engine

Risk engine MUST be provider-neutral and pure.

Required V0.1 metrics:

#### A. Data freshness
- age/lag of every required source;
- overall snapshot quality is worst required dependency quality;
- stale/unknown required source => RiskSnapshot non-actionable.

#### B. Position notional/exposure
- normalized current notional based on admitted mark price and position size;
- collateral/exposure ratios;
- wallet/position concentration within currently available Perpl positions.

#### C. Position adverse move / mark-to-entry drawdown
- direction-aware adverse move from entry to current mark;
- clearly named so it is not confused with realized PnL;
- if fee/funding semantics are not included, metric metadata MUST say so.

#### D. Portfolio drawdown
- use documented Perpl equity series;
- V0.1 semantic: deterministic peak-to-current drawdown over a frozen period selected by this WO implementation, default recommendation `day`;
- period must be part of metric metadata/schema;
- empty/insufficient series => UNKNOWN, not zero drawdown.

#### E. Funding state
- current funding rate and direction;
- preserve Perpl `feb` interval identity;
- expose adverse-to-position funding classification only when sign semantics are verified;
- do not fabricate accrued funding PnL unless formula is proven.

#### F. Margin safety
- implement only semantics that can be proven from official Perpl API/SDK/contract material;
- methodology and units must be documented and covered by vectors.

#### G. Liquidation distance
`LIQUIDATION_DISTANCE_BPS` is OPTIONAL_WITH_PROOF within M02.
It may be emitted only if the executor:
1. identifies Perpl-specific authoritative contract/SDK semantics;
2. implements exact scaling/funding/margin assumptions;
3. cross-checks deterministic vectors and, where possible, target-network observations;
4. records methodology in Evidence.

If not proven, return explicit `UNAVAILABLE_UNPROVEN` for liquidation distance and use proven margin/adverse-move metrics instead.

A generic formula copied from another perp venue is prohibited.

### 10. RiskSnapshot construction

Construct one immutable normalized snapshot per supported position/portfolio evaluation containing:
- source snapshot identities/hashes;
- market/position/account references;
- metrics;
- quality/freshness;
- reasons/limitations;
- generation instant;
- deterministic snapshot hash.

Same normalized inputs + injected clock => byte-stable/canonically equivalent risk output.

No LLM is involved.

### 11. Persistence

Extend PostgreSQL/Drizzle with M02-owned append-oriented tables only as needed:

Recommended:
- `market_snapshots`
- `position_snapshots`
- `portfolio_snapshots`
- `risk_snapshots`
- `risk_metrics`
- `provider_checkpoints`

Rules:
- normalized snapshots, not credential secrets;
- content/source hashes and correlation IDs;
- append-oriented evidence;
- provider checkpoints may update current stream state but history/evidence remains attributable;
- no order/execution tables in M02;
- migration from clean DB and M01 DB must both pass.

### 12. Worker observation runtime

Upgrade worker from M01 SAFE_MODE to `OBSERVATION_MODE` while retaining:
- `executionEnabled=false`;
- global kill switch;
- no signer/executor.

Worker responsibilities:
- provider lifecycle;
- resnapshot/reconnect;
- RiskSnapshot evaluation;
- persistence;
- health publication;
- graceful shutdown;
- no busy-loop when provider unavailable.

### 13. Read-only API surfaces

Implement or freeze GET-only equivalents for:
- portfolio risk summary;
- position risk detail;
- integration health;
- market/context summary needed by UI.

Responses must:
- include schema version;
- include data freshness and limitations;
- never return credential material;
- distinguish `NO_ACCOUNT`, `NO_POSITION`, `STALE`, `UNAVAILABLE` and actual empty healthy state.

No M02 mutating financial API exists.

### 14. Dashboard read model

Replace dashboard placeholder with a functional read-only M02 surface sufficient to inspect:
- environment/network;
- provider health;
- positions if authenticated data exists;
- risk metrics;
- source freshness;
- clear unavailable/no-account states.

Do not spend M02 on final visual polish. M05 owns competition-grade UX.

No fake data may be labeled live. Fixture/demo mode must be visibly marked.

### 15. Replay fixtures

Add deterministic recorded/synthetic fixtures for:
- long and short positions;
- profitable/adverse movement;
- fresh/stale market state;
- funding interval update/duplicate `feb`;
- no-account/zero-position state;
- sequence gap;
- reconnect/resnapshot;
- REST 429/503/401/403;
- malformed schema;
- extreme precision/scaling;
- empty portfolio series.

Fixtures containing provider data must be sanitized of credentials/wallet-sensitive fields.

### 16. Live smoke strategy

Merge-blocking CI MUST NOT depend on external provider availability or secrets.

Required:
- deterministic adapter contract tests with local/mock transport;
- replay fixtures;
- optional manual/executor live public smoke against Perpl context/market endpoints with evidence;
- authenticated live smoke only when a disposable/read-only key is safely available, never committed to CI.

Lack of a secret must not cause CI to fake authenticated success.

### 17. Optional Envio evidence adapter

Classify as IMPORTANT, not M02 release-blocking.

Admit implementation only if preflight proves:
- Monad target can be indexed through current Envio HyperIndex/HyperSync or supported RPC source;
- relevant Perpl contract ABI/events needed for evidence are accessible;
- integration materially improves provenance/reorg/evidence;
- implementation does not threaten M02 deadline/core quality.

If admitted:
- keep it read-only;
- store explicit Envio provenance/lag;
- never treat indexer data as authoritative for Perpl internal state not emitted onchain;
- token stays server-side;
- provider-neutral seam remains.

If not admitted, create the seam/test contract and record deferral, but do not fabricate an Envio integration.

## OUT OF SCOPE

- natural-language policy compiler;
- trigger execution;
- action planning;
- live transaction simulation;
- wallet connection/signing;
- MetaMask Agent Wallet;
- trade-scoped Perpl keys;
- order submission/change/cancel;
- order forwarding enablement;
- exchange-account creation/deposit;
- autonomous execution;
- mainnet execution;
- LLM integration;
- final competition UI;
- universal opaque AI risk score;
- builder fees/monetization execution.

## FILES / SOURCES TO READ

Read in source-hierarchy order:
1. `.engineering/CHECKPOINT.md` and JSON
2. Decisions Ledger + ADRs
3. Scope
4. DoD
5. Architecture
6. Requirements
7. Security
8. Data/API/Integration contracts
9. Test Plan
10. Module Roadmap
11. M01 Evidence and merged runtime
12. this WO + Context Lock

Live preflight:
- current Perpl API docs README, authentication, REST endpoints, WebSocket, types;
- current Monad network docs;
- current Perpl SDK/contract reference only where needed to prove risk formulas;
- Envio docs only if optional adapter is admitted.

## ARCHITECTURE RULES

- Preserve D-0001..D-0022 and all M01 safety invariants.
- Observation and Risk planes remain separate.
- Provider objects stop at adapter boundary.
- Pure risk functions have no network, DB, wall-clock or random access.
- All time is injected into deterministic evaluation.
- Read-only credentials are least privilege and runtime-only.
- Unknown/stale/inconsistent data fails closed.
- No execution state may advance because of M02.
- No trade path or wallet secret enters repository/runtime.
- Mainnet is observation-only.
- Testnet/demo labeling remains explicit.
- No composite score hides component metrics or limitations.

## CONSTRAINTS

- M02 is one large module-level WO/PR.
- Corrections remain bounded Correction Deltas in the same PR.
- Do not start M03 because time remains.
- Preserve current M01 GEF/Source Pack gates.
- Direct new dependencies exact-pinned after live preflight.
- Avoid unnecessary provider SDKs; prefer platform primitives where adequate.
- No force-push/history rewrite.
- If Checkpoint/Scope/DoD/Architecture/relevant decision changed from execution base, Context Lock becomes STALE and execution stops.

## ACCEPTANCE CRITERIA

1. M02 package boundaries are acyclic and provider-neutral.
2. Perpl public REST context/market adapter validates and normalizes documented shapes.
3. Public market-data WS implements required streams, sequence/freshness/reconnect rules.
4. Authenticated account adapter requires exact read-only configuration.
5. No trade/order/write capability exists.
6. Credentials are never persisted/logged/client-exposed.
7. REST 429/503/401/403/404 semantics are tested distinctly.
8. Sequence gaps invalidate freshness and force resnapshot.
9. Funding duplicate interval handling is deterministic.
10. Normalized observations include provenance/freshness/hash.
11. Financial numeric normalization avoids unsafe float precision.
12. Risk Engine is pure/provider-neutral.
13. Same inputs + clock produce same RiskSnapshot.
14. Stale/missing required data produces non-actionable snapshot.
15. Position exposure metric is correct on long/short precision vectors.
16. Position adverse-move/drawdown semantics are documented/tested.
17. Portfolio drawdown is deterministic and handles empty/insufficient series safely.
18. Funding metric semantics are documented/tested.
19. Margin-safety metric is emitted only with proven methodology.
20. Liquidation distance is either proven with evidence or explicitly UNAVAILABLE_UNPROVEN.
21. M02 DB migrations work from clean and M01 baseline.
22. No credential exists in DB schema/migrations.
23. Worker OBSERVATION_MODE handles provider lifecycle and graceful shutdown.
24. Worker remains execution disabled.
25. Read APIs distinguish stale/unavailable/empty/no-account states.
26. Dashboard shows real/read-model status without mislabeling fixtures as live.
27. Deterministic replay fixtures cover required failure/recovery cases.
28. Risk evaluation p95 target <=100 ms for one supported position after inputs are in memory, with methodology/sample recorded.
29. Public live smoke evidence exists or failure is truthfully recorded as external/non-blocking if deterministic provider contract tests pass.
30. Optional Envio is truthfully implemented or explicitly deferred.
31. Existing 41 M01 tests/regressions remain green unless superseded with documented equivalent.
32. lint/typecheck/build/unit/integration/adversarial/replay/migration tests pass.
33. Linux and bounded Windows lanes pass.
34. npm audit has no unresolved HIGH/CRITICAL attributable to M02.
35. GEF 1.1.2 validation remains green.
36. Source Pack validation remains green.
37. Exact-head Evidence Bundle records changed files, tests, risk formulas, live-provider evidence, dependency/security findings and limitations.
38. CRITICAL/HIGH introduced findings = 0.

## NAMED PROOF CASES

- `M02-PERPL-001` public context normalization.
- `M02-PERPL-002` read-only credential mode; trade scope refused.
- `M02-PERPL-003` secret redaction/persistence denial.
- `M02-REST-001` bounded 429 retry.
- `M02-REST-002` 503 becomes DEGRADED.
- `M02-REST-003` 401/403 auth/scope failure no retry storm.
- `M02-REST-004` 404 no-account distinguished from outage.
- `M02-WS-001` ordered heartbeat/sequence accepted.
- `M02-WS-002` gap marks STALE and reconnects/resnapshots.
- `M02-WS-003` disconnect cannot leave old state FRESH.
- `M02-FUND-001` repeated `feb` updates same interval.
- `M02-DATA-001` malformed provider payload rejected.
- `M02-DATA-002` deterministic content/provenance hash.
- `M02-NUM-001` price/size/notional precision vectors.
- `M02-RISK-001` same snapshot => same metrics.
- `M02-RISK-002` stale required input => non-actionable.
- `M02-RISK-003` long/short adverse move vectors.
- `M02-RISK-004` portfolio peak-to-current drawdown vectors.
- `M02-RISK-005` funding risk semantics.
- `M02-RISK-006` liquidation metric proof-or-unavailable gate.
- `M02-DB-001` clean + M01 migration upgrade.
- `M02-WORKER-001` observation lifecycle without executor.
- `M02-API-001` stale/unavailable/no-account response distinctions.
- `M02-SEC-001` static scan proves no trade/order submit path.
- `M02-SEC-002` no secret reaches log/client/DB.
- `M02-PERF-001` risk-engine p95 benchmark with recorded population.

## DELIVERABLES

- complete M02 provider/risk source;
- exact dependency lock changes;
- M02 migrations;
- replay fixtures;
- read-only worker integration;
- read APIs/dashboard read model;
- tests/benchmarks/security gates;
- optional Envio evidence or explicit deferral;
- updated docs matching actual behavior;
- `.engineering/evidence/NERVA-WO-003-EVIDENCE.md`;
- `.engineering/checkpoint-deltas/NERVA-WO-003-PROPOSED.md`;
- any necessary ADR only if a genuinely new architectural decision appears.

Executor commits/pushes to the existing branch and updates PR. Do not merge.

## REVIEW FORMAT

Final executor report in Brazilian Portuguese:
- base/head SHA;
- Context Lock status;
- objective scope;
- provider capabilities actually proven;
- risk metrics and exact methodology/limitations;
- tests/checks with counts;
- live smoke results;
- security/dependency results;
- corrections;
- remaining risks;
- Evidence Bundle;
- proposed Checkpoint Delta;
- STOP CONDITION.

## STOP CONDITION

`NERVA_M02_DATA_RISK_READY_FOR_AUDIT`

Do not start M03. Do not merge. Do not promote canonical Checkpoint. Any unresolved CRITICAL/HIGH => CORRECTION_REQUIRED or BLOCKED.
