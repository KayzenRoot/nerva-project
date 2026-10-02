# NERVA Security

Status: CANONICAL — NERVA-WO-001
Classification: HIGH_ASSURANCE

## Security objective
Permit useful autonomous protection while ensuring the system cannot silently obtain broader authority than the user explicitly granted.

## Mandatory controls
- NERVA services do not store seed phrases/private keys.
- Signing adapter is external, scoped and revocable.
- Policy limits include protocol/market/action/notional/slippage/expiry/cooldown as applicable.
- Explicit user confirmation before first activation and material policy changes.
- Kill switch and pause path.
- Fail closed on stale data, invalid signatures, unknown policy version, dependency disagreement or failed simulation.
- Structured input validation at every trust boundary.
- Secrets only through runtime secret management; never Git.
- Production/test/demo environments are visibly and technically separated.
- No blind retry after ambiguous side effect.

## Threat model
- **Prompt injection/model manipulation:** LLM output is untrusted proposal data. Schema validation and deterministic policy checks are mandatory.
- **Key/signing compromise:** no application custody; minimize scopes, expiry and allowances; never log sensitive signer material.
- **Policy escalation:** execution planner proves candidate action is within exact active policy bounds.
- **Replay/duplicate execution:** idempotency keys and effect-state receipts; duplicate suppression.
- **Stale/poisoned market data:** freshness/sequence checks, provider-health state, optional corroboration for high-risk signals.
- **API compromise/outage:** timeouts, bounded retries for read-only calls, circuit breaker, no optimistic execution.
- **Protocol/API contract drift:** capability/version preflight and adapter contract tests.
- **MEV/slippage:** explicit slippage bounds and wallet/provider protection where available; execution fails outside policy.
- **Chain reorg/finality:** receipt state distinguishes submitted/confirmed/final/unknown as the integration permits.
- **Front-end injection/XSS:** standard CSP/output encoding/dependency controls; never let UI text modify policy authority.
- **Webhook/event spoofing:** authenticate where available and verify against authoritative state before financial action.
- **Demo leakage:** synthetic controls cannot target production execution; obvious UI marker and separate config.
- **Insider/ops error:** least privilege, immutable evidence, no production secret in developer environment.
- **Supply chain:** lockfiles, dependency audit, pinned CI actions where practical, provenance-aware package review.

## Proof obligations before any real-value mainnet autonomous action
1. Exact policy authority is machine-verifiable.
2. Signing permission is scoped/revocable.
3. Data freshness and required consistency rules pass.
4. Action simulation/preflight passes.
5. Idempotency and effect-state recovery are tested.
6. Kill switch is tested.
7. Adversarial tests for malformed/stale/replayed inputs pass.
8. Rollback/roll-forward procedure exists for non-financial application state; financial effects use compensating/forward recovery only where valid.
9. Independent/manual release review of production configuration.

## Severity gate
Any known CRITICAL/HIGH security defect blocks progression/merge/release.
