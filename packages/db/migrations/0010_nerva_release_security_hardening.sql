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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
  END IF;
END
$$;

ALTER FUNCTION public.nerva_reject_immutable_mutation() SET search_path = public, pg_temp;
ALTER FUNCTION public.nerva_audit_runtime_control_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.nerva_reject_m03_mutation() SET search_path = public, pg_temp;
ALTER FUNCTION public.nerva_reject_m04_mutation() SET search_path = public, pg_temp;
ALTER FUNCTION public.nerva_guard_m04_authority_generation() SET search_path = public, pg_temp;
ALTER FUNCTION public.nerva_guard_m04_evidence_head() SET search_path = public, pg_temp;
