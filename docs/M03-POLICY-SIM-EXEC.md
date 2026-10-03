# M03 Policy, Simulation and Execution Safety

M03 provides a strict policy compiler, actor-confirmed immutable versions, deterministic trigger evaluation and bounded planning. Simulations are synthetic dry runs. APIs and operator pages expose persisted policy and attempt status without enabling financial effects.

## Safety boundary

- Risk classification is `HIGH_ASSURANCE`. NERVA has no financial authority for an LLM. Natural-language input is returned only as an untrusted proposal and cannot activate a policy.
- The only compiled action values are `REDUCE_POSITION`, `CLOSE_POSITION` and `NO_ACTION`. A close binds the whole current position; a reduce is strictly smaller than the whole position. Quantity, notional, market, position, policy hash, snapshot hash, expiry and slippage are bounded together.
- Trigger inputs are limited to fresh deterministic `POSITION_ADVERSE_MOVE_BPS` and `PORTFOLIO_DRAWDOWN_BPS` values. `LIQUIDATION_DISTANCE`, `MAINTENANCE_MARGIN` and `FUNDING_DIRECTION` remain `UNAVAILABLE_UNPROVEN` or `UNKNOWN` and cannot become trigger authority.
- `MAINNET_EXECUTION` is refused by configuration, policy compilation, planning and the testnet execution boundary. `MAINNET_READONLY` permits `NO_ACTION` only. `TESTNET_DEMO` cannot reach an effect boundary.
- `UNKNOWN`, stale, inconsistent, mismatched, expired or missing simulation/preflight state blocks the action. A deterministic dry run has `DRY_RUN_ONLY` authority and does not prove provider behavior.
- Actor authorization and provider-enrollment proofs bind an exact issuer, actor, environment, network, chain, policy hash, plan digest, account, position, action, scope, nonce and expiry. Nonces are hashed and consumed atomically in PostgreSQL. Raw signatures and credentials are not stored.
- Provider dispatch requires an atomic kill-switch gate and a durable idempotency claim. Ambiguous outcomes become `UNKNOWN` / `RECOVERY_REQUIRED`; recovery is read-only and never resubmits. Reconciliation that cannot be proven remains unresolved.

## Current Perpl capability review

Reviewed the [official Perpl API documentation](https://github.com/PerplFoundation/api-docs), including [authentication](https://github.com/PerplFoundation/api-docs/blob/main/authentication.md), [integrations and scopes](https://github.com/PerplFoundation/api-docs/blob/main/integrations.md), and [REST endpoints](https://github.com/PerplFoundation/api-docs/blob/main/rest-endpoints.md) on 2026-10-03.

Perpl documents `read`, `trade`, and `read | trade` API-key scopes. The `trade` scope places, cancels and modifies orders, and trade implies read. The write endpoint is `POST /api/v1/trading/orders` or the trading WebSocket. API order forwarding also requires a separate account-level `allowOrderForwarding(true)` permission. No exact reduce-only or close-only provider scope or simulation endpoint is documented in the reviewed material. NERVA therefore allows no Perpl write scope in this version and has no deployed Perpl effect adapter. The M03 effect engine exposes a narrow port for adversarially tested boundaries, but the live provider capability gate remains closed until an updated official contract proves protective-only operation semantics and independently verifiable enrollment.

The documented Perpl testnet identity is chain ID `10143`, REST base `https://testnet.perpl.xyz/api`, and WebSocket base `wss://testnet.perpl.xyz`. Those values identify the network only; they do not constitute enrollment, account, permission or effect proof.

## Trusted actor issuer configuration

Mutation routes require a trusted issuer registry. Configure `NERVA_M03_TRUSTED_ISSUERS_JSON` in the deployment secret/configuration store with only issuer identifiers and public Ed25519 keys. Each entry has this shape:

```json
[
  {
    "issuer": "issuer:organization",
    "keyId": "actor-key-2026-01",
    "actorId": "actor:operator-17",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
  }
]
```

The configuration contains public keys only; NERVA does not accept a caller-provided `verified` boolean or trust a display name. Proof signatures use Ed25519 over the canonical proof object with the `signature` member removed. Issuer rotation, expiration and revocation remain operator responsibilities and must be reflected in this trusted registry. With no registry, confirmation, evaluation, planning and simulation mutations return a typed refusal. Read-only status views continue to work.

## API surfaces

All request bodies are capped at 64 KB. Mutation requests use `schemaVersion: "0.1"` and a correlation ID, and responses disable caching.

| Route                                                                  | Purpose                                                                     | Authority                                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `POST /api/policies/proposals`                                         | Accept bounded structured/natural-language proposal text                    | `PROPOSAL_ONLY`                                                              |
| `POST /api/policies/compile`                                           | Validate and canonicalize a structured policy                               | `VALIDATION_ONLY`                                                            |
| `POST /api/policies/confirm`                                           | Verify explicit actor provenance and persist an immutable active version    | Actor signature plus durable nonce                                           |
| `POST /api/policies/control`                                           | Pause or revoke a policy version                                            | Fresh actor control proof plus durable nonce                                 |
| `POST /api/evaluations`                                                | Evaluate the persisted active version against the current risk snapshot     | Fresh actor proof plus deterministic risk                                    |
| `POST /api/plans`                                                      | Plan the matched action against the exact risk/policy inputs                | Effects refuse and persist refusal without verified position/account binding |
| `POST /api/simulations`                                                | Persist a plan-bound deterministic dry run                                  | `DRY_RUN_ONLY`; never provider proof                                         |
| `POST /api/executions`                                                 | Persist the current testnet effect refusal                                  | Always blocked while no protective-only Perpl scope is documented            |
| `POST /api/executions/{attemptId}/recovery`                            | Record unresolved recovery when provider reconciliation is unavailable      | Read-only; no retry                                                          |
| `GET /api/policies`, `GET /api/executions`, `GET /api/flight-recorder` | Read current policy, evaluation, simulation, attempt and integration status | Read-only                                                                    |

`/policies` and `/flight-recorder` are read-only English-default operator surfaces. Brazilian Portuguese and Spanish are also available. No route exposes a wallet or submits a financial action.

## Persistence and operations

The M03 migration adds append-only policy confirmation/lifecycle, trigger evaluation, plan, simulation, authorization reference, provider enrollment reference, nonce ledger, idempotency, attempt and receipt tables. Updates and deletes on these evidence tables fail at the database trigger boundary. No credential or signature column is present; records retain hashes/references only.

`GLOBAL_EXECUTION_DISABLED` is seeded enabled. M03 database helpers serialize changes to that control with the dispatch admission lock. Missing/unavailable state is treated as enabled. Any future deployment integrating the testnet effect engine must use `runM03IfExecutionEnabled` and update the same switch through `setM03ExecutionDisabled`; direct control-table writes are outside the supported operational path.

Run checks locally with Node.js 22 and PostgreSQL 18:

```powershell
npm ci
npm run context:validate
npm run typecheck
npm test
npm run m03:safety:verify
npm run db:check
npm run db:smoke
npm run db:upgrade-smoke
```

CI uses synthetic fixtures and a disposable PostgreSQL database. It does not require Perpl credentials, call order endpoints or claim a live testnet effect. The M03 Evidence Bundle records exact tested commands, results, provider capability limits and any remaining audit blockers.
