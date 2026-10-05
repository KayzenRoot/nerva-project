# NERVA M06 Supabase RLS Proposal

Status: OWNER_APPROVED · APPLIED · VERSIONED

Supabase security preflight originally reported that all 34 NERVA tables in the exposed `public` schema had Row Level Security disabled. The owner approved the deny-by-default access model, and the hardening is now applied and versioned.

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

These functions were reviewed before hardening. Their bodies were preserved and only the function-level `search_path` was pinned to `public, pg_temp`.

## Owner decision required

Approve one of:

- **APPROVE_DENY_BY_DEFAULT_RLS** — apply the RLS/revoke set above and keep browser/Data API access closed.
- **REJECT_RLS_CHANGE** — leave schema unchanged and record why this external security finding is accepted.

Owner decision recorded: `APPROVE_DENY_BY_DEFAULT_RLS` on 2026-10-04. The deny-by-default posture was applied to Supabase and versioned as `packages/db/migrations/0010_nerva_release_security_hardening.sql`. Supabase security revalidation now reports only INFO `rls_enabled_no_policy` findings, which are intentional because no public/browser policies are allowed for M06.

## Applied verification

- Supabase project: `gnujsdlpaznoaeijvmez`.
- RLS: enabled on all 34 NERVA tables.
- Public policies: none.
- `anon` and `authenticated`: no table grants and no sequence usage grants in `public`.
- Mutable function `search_path` WARN findings: 0 after pinning the six NERVA trigger/helper functions to `public, pg_temp`.
- Remaining advisor output: 34 INFO findings `rls_enabled_no_policy`, intentional deny-by-default posture.
