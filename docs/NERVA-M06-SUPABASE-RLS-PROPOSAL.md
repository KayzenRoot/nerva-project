# NERVA M06 Supabase RLS Proposal

Status: PROPOSED_FOR_OWNER_DECISION · NOT_APPLIED

Supabase security preflight reports that all 34 NERVA tables in the exposed `public` schema have Row Level Security disabled. This proposal is intentionally **not applied** until the owner approves the access model.

## Intended access model

NERVA does not use the Supabase browser client or public Data API for product access. Runtime database access is server-side only.

Recommended posture for the public schema:

1. Enable RLS on all NERVA tables.
2. Do not create permissive policies for `anon` or `authenticated`.
3. Explicitly revoke table/sequence privileges from `anon` and `authenticated`.
4. Keep runtime access server-side through a dedicated database login with only the object privileges NERVA needs.
5. Do not expose a Supabase service-role key to the browser.
6. Preserve `NERVA_EXECUTION_ENABLED=false`, `NERVA_KILL_SWITCH_ENABLED=true`, `MAINNET EFFECT = HARD_BLOCKED`, and `LIVE PERPL WRITES = BLOCKED`.

## Proposed deny-by-default hardening

The following is the Supabase advisor's RLS-enablement set, plus explicit Data API role revocation. It is proposed only and must not be executed without owner approval.

```sql
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_health_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runtime_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.position_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m03_authorization_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m03_execution_attempt_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m03_execution_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m03_execution_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m03_execution_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m03_nonce_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m03_policy_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m03_policy_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m03_provider_enrollment_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m03_simulation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m03_trigger_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m04_agent_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m04_authority_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m04_authorization_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m04_capability_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m04_delegation_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m04_nonce_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m04_permission_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m04_permission_evidence_head ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m04_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m04_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m04_wallet_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m04_session_revocations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
```

No permissive browser/Data API policies are proposed for M06.

## Additional advisor findings

Supabase also reports six WARN findings for functions with mutable `search_path`:

- `public.nerva_reject_immutable_mutation`
- `public.nerva_audit_runtime_control_change`
- `public.nerva_reject_m03_mutation`
- `public.nerva_reject_m04_mutation`
- `public.nerva_guard_m04_authority_generation`
- `public.nerva_guard_m04_evidence_head`

These should be reviewed and schema-qualified before applying any `search_path` hardening so trigger behavior is not changed accidentally.

## Owner decision required

Approve one of:

- **APPROVE_DENY_BY_DEFAULT_RLS** — apply the RLS/revoke set above and keep browser/Data API access closed.
- **REJECT_RLS_CHANGE** — leave schema unchanged and record why this external security finding is accepted.

Until a decision is recorded, M06 remains blocked from final release approval.
