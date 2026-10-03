CREATE TABLE "m03_authorization_refs" (
	"authorization_ref" text PRIMARY KEY NOT NULL,
	"plan_digest" text NOT NULL,
	"policy_version_hash" text NOT NULL,
	"actor_ref" text NOT NULL,
	"issuer_ref" text NOT NULL,
	"scope" text NOT NULL,
	"proof_ref_hash" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "m03_authorization_refs_policy_hash_ck" CHECK ("m03_authorization_refs"."policy_version_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m03_authorization_refs_proof_hash_ck" CHECK ("m03_authorization_refs"."proof_ref_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "m03_execution_attempt_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"plan_digest" text NOT NULL,
	"state" text NOT NULL,
	"reason" text NOT NULL,
	"correlation_id" text NOT NULL,
	"provider_reference_hash" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "m03_execution_attempt_events_digest_ck" CHECK ("m03_execution_attempt_events"."plan_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m03_execution_attempt_events_state_ck" CHECK ("m03_execution_attempt_events"."state" in ('NOT_STARTED','PREFLIGHTED','AUTHORIZED','SUBMITTED','CONFIRMED','REFUSED','FAILED','UNKNOWN','RECOVERY_REQUIRED')),
	CONSTRAINT "m03_execution_attempt_events_provider_hash_ck" CHECK ("m03_execution_attempt_events"."provider_reference_hash" is null or "m03_execution_attempt_events"."provider_reference_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "m03_execution_idempotency" (
	"idempotency_key" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"network" text NOT NULL,
	"chain_id" integer NOT NULL,
	"account_id" text NOT NULL,
	"plan_digest" text NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "m03_execution_idempotency_provider_ck" CHECK ("m03_execution_idempotency"."provider" = 'perpl'),
	CONSTRAINT "m03_execution_idempotency_testnet_ck" CHECK ("m03_execution_idempotency"."network" = 'monad-testnet' and "m03_execution_idempotency"."chain_id" = 10143),
	CONSTRAINT "m03_execution_idempotency_digest_ck" CHECK ("m03_execution_idempotency"."plan_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "m03_execution_plans" (
	"plan_id" text PRIMARY KEY NOT NULL,
	"digest" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"policy_version_id" text NOT NULL,
	"policy_version_hash" text NOT NULL,
	"snapshot_id" text NOT NULL,
	"snapshot_hash" text NOT NULL,
	"account_id" text NOT NULL,
	"position_id" text NOT NULL,
	"market_selector" text NOT NULL,
	"action" text NOT NULL,
	"quantity_scaled" text NOT NULL,
	"notional_micros" text NOT NULL,
	"slippage_bps" integer NOT NULL,
	"environment" text NOT NULL,
	"network" text NOT NULL,
	"chain_id" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"correlation_id" text NOT NULL,
	"external_effect" boolean NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "m03_execution_plans_digest_ck" CHECK ("m03_execution_plans"."digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m03_execution_plans_policy_hash_ck" CHECK ("m03_execution_plans"."policy_version_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m03_execution_plans_snapshot_hash_ck" CHECK ("m03_execution_plans"."snapshot_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m03_execution_plans_action_ck" CHECK ("m03_execution_plans"."action" in ('REDUCE_POSITION','CLOSE_POSITION','NO_ACTION')),
	CONSTRAINT "m03_execution_plans_environment_ck" CHECK ("m03_execution_plans"."environment" in ('LOCAL','TESTNET_DEMO','TESTNET','MAINNET_READONLY')),
	CONSTRAINT "m03_execution_plans_network_ck" CHECK (("m03_execution_plans"."environment" = 'LOCAL' and "m03_execution_plans"."network" = 'local' and "m03_execution_plans"."chain_id" = 0) or ("m03_execution_plans"."environment" in ('TESTNET_DEMO','TESTNET') and "m03_execution_plans"."network" = 'monad-testnet' and "m03_execution_plans"."chain_id" = 10143) or ("m03_execution_plans"."environment" = 'MAINNET_READONLY' and "m03_execution_plans"."network" = 'monad-mainnet' and "m03_execution_plans"."chain_id" = 143)),
	CONSTRAINT "m03_execution_plans_quantity_ck" CHECK ("m03_execution_plans"."quantity_scaled" ~ '^(0|[1-9][0-9]{0,37})$'),
	CONSTRAINT "m03_execution_plans_notional_ck" CHECK ("m03_execution_plans"."notional_micros" ~ '^(0|[1-9][0-9]{0,37})$'),
	CONSTRAINT "m03_execution_plans_slippage_ck" CHECK ("m03_execution_plans"."slippage_bps" between 0 and 10000),
	CONSTRAINT "m03_execution_plans_mainnet_no_effect_ck" CHECK ("m03_execution_plans"."environment" <> 'MAINNET_READONLY' or ("m03_execution_plans"."action" = 'NO_ACTION' and "m03_execution_plans"."external_effect" = false)),
	CONSTRAINT "m03_execution_plans_demo_no_effect_ck" CHECK ("m03_execution_plans"."environment" <> 'TESTNET_DEMO' or "m03_execution_plans"."external_effect" = false)
);
--> statement-breakpoint
CREATE TABLE "m03_execution_receipts" (
	"receipt_id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"plan_digest" text NOT NULL,
	"outcome" text NOT NULL,
	"reason" text NOT NULL,
	"correlation_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "m03_execution_receipts_digest_ck" CHECK ("m03_execution_receipts"."plan_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m03_execution_receipts_outcome_ck" CHECK ("m03_execution_receipts"."outcome" in ('CONFIRMED','NO_ACTION','REFUSED','FAILED','UNKNOWN','RECOVERY_REQUIRED'))
);
--> statement-breakpoint
CREATE TABLE "m03_nonce_ledger" (
	"nonce_hash" text PRIMARY KEY NOT NULL,
	"issuer_ref" text NOT NULL,
	"purpose" text NOT NULL,
	"consumed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "m03_nonce_ledger_hash_ck" CHECK ("m03_nonce_ledger"."nonce_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m03_nonce_ledger_purpose_ck" CHECK ("m03_nonce_ledger"."purpose" in ('policy-confirmation','execution-authorization','provider-enrollment','policy-control'))
);
--> statement-breakpoint
CREATE TABLE "m03_policy_confirmations" (
	"policy_version_id" text PRIMARY KEY NOT NULL,
	"canonical_hash" text NOT NULL,
	"actor_ref" text NOT NULL,
	"issuer_ref" text NOT NULL,
	"proof_ref_hash" text NOT NULL,
	"confirmed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "m03_policy_confirmations_hash_ck" CHECK ("m03_policy_confirmations"."canonical_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m03_policy_confirmations_proof_ck" CHECK ("m03_policy_confirmations"."proof_ref_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "m03_policy_lifecycle_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"policy_version_id" text NOT NULL,
	"event_type" text NOT NULL,
	"actor_ref" text NOT NULL,
	"issuer_ref" text NOT NULL,
	"proof_ref_hash" text NOT NULL,
	"correlation_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "m03_policy_lifecycle_events_type_ck" CHECK ("m03_policy_lifecycle_events"."event_type" in ('CONFIRMED','PAUSED','REVOKED','EXPIRED')),
	CONSTRAINT "m03_policy_lifecycle_events_proof_ck" CHECK ("m03_policy_lifecycle_events"."proof_ref_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "m03_provider_enrollment_refs" (
	"enrollment_ref" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"account_id" text NOT NULL,
	"network" text NOT NULL,
	"chain_id" integer NOT NULL,
	"capability_ref" text NOT NULL,
	"capability_evidence_hash" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "m03_provider_enrollment_provider_ck" CHECK ("m03_provider_enrollment_refs"."provider" = 'perpl'),
	CONSTRAINT "m03_provider_enrollment_testnet_ck" CHECK ("m03_provider_enrollment_refs"."network" = 'monad-testnet' and "m03_provider_enrollment_refs"."chain_id" = 10143),
	CONSTRAINT "m03_provider_enrollment_evidence_ck" CHECK ("m03_provider_enrollment_refs"."capability_evidence_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "m03_simulation_results" (
	"simulation_id" text PRIMARY KEY NOT NULL,
	"plan_digest" text NOT NULL,
	"kind" text NOT NULL,
	"authority" text NOT NULL,
	"status" text NOT NULL,
	"simulator_version" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "m03_simulation_results_kind_ck" CHECK ("m03_simulation_results"."kind" in ('DETERMINISTIC_DRY_RUN','PROVIDER_TESTNET_PREFLIGHT')),
	CONSTRAINT "m03_simulation_results_authority_ck" CHECK ("m03_simulation_results"."authority" in ('DRY_RUN_ONLY','PROVIDER_TESTNET_VERIFIED')),
	CONSTRAINT "m03_simulation_results_status_ck" CHECK ("m03_simulation_results"."status" in ('PASS','FAIL','UNKNOWN'))
);
--> statement-breakpoint
CREATE TABLE "m03_trigger_evaluations" (
	"evaluation_id" text PRIMARY KEY NOT NULL,
	"policy_version_id" text NOT NULL,
	"policy_version_hash" text NOT NULL,
	"snapshot_id" text NOT NULL,
	"snapshot_hash" text NOT NULL,
	"result" text NOT NULL,
	"reason" text NOT NULL,
	"correlation_id" text NOT NULL,
	"evaluated_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "m03_trigger_evaluations_policy_hash_ck" CHECK ("m03_trigger_evaluations"."policy_version_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m03_trigger_evaluations_snapshot_hash_ck" CHECK ("m03_trigger_evaluations"."snapshot_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m03_trigger_evaluations_result_ck" CHECK ("m03_trigger_evaluations"."result" in ('MATCH','NO_MATCH','REFUSED'))
);
--> statement-breakpoint
ALTER TABLE "policies" DROP CONSTRAINT "policies_environment_ck";--> statement-breakpoint
ALTER TABLE "m03_execution_plans" ADD CONSTRAINT "m03_execution_plans_policy_version_id_policy_versions_policy_version_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("policy_version_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m03_execution_plans" ADD CONSTRAINT "m03_execution_plans_snapshot_id_risk_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."risk_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m03_policy_confirmations" ADD CONSTRAINT "m03_policy_confirmations_policy_version_id_policy_versions_policy_version_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("policy_version_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m03_policy_lifecycle_events" ADD CONSTRAINT "m03_policy_lifecycle_events_policy_version_id_policy_versions_policy_version_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("policy_version_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m03_trigger_evaluations" ADD CONSTRAINT "m03_trigger_evaluations_policy_version_id_policy_versions_policy_version_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("policy_version_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m03_trigger_evaluations" ADD CONSTRAINT "m03_trigger_evaluations_snapshot_id_risk_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."risk_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "m03_authorization_refs_plan_uq" ON "m03_authorization_refs" USING btree ("plan_digest");--> statement-breakpoint
CREATE INDEX "m03_execution_attempt_events_key_idx" ON "m03_execution_attempt_events" USING btree ("idempotency_key","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "m03_execution_plans_digest_uq" ON "m03_execution_plans" USING btree ("digest");--> statement-breakpoint
ALTER TABLE "m03_authorization_refs" ADD CONSTRAINT "m03_authorization_refs_plan_digest_m03_execution_plans_digest_fk" FOREIGN KEY ("plan_digest") REFERENCES "public"."m03_execution_plans"("digest") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m03_simulation_results" ADD CONSTRAINT "m03_simulation_results_plan_digest_m03_execution_plans_digest_fk" FOREIGN KEY ("plan_digest") REFERENCES "public"."m03_execution_plans"("digest") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "m03_execution_plans_idempotency_uq" ON "m03_execution_plans" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "m03_execution_plans_policy_idx" ON "m03_execution_plans" USING btree ("policy_version_id","created_at");--> statement-breakpoint
CREATE INDEX "m03_execution_receipts_key_idx" ON "m03_execution_receipts" USING btree ("idempotency_key","created_at");--> statement-breakpoint
CREATE INDEX "m03_policy_lifecycle_events_version_idx" ON "m03_policy_lifecycle_events" USING btree ("policy_version_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "m03_provider_enrollment_scope_uq" ON "m03_provider_enrollment_refs" USING btree ("provider","account_id","network","capability_ref");--> statement-breakpoint
CREATE INDEX "m03_simulation_results_plan_idx" ON "m03_simulation_results" USING btree ("plan_digest","checked_at");--> statement-breakpoint
CREATE INDEX "m03_trigger_evaluations_version_time_idx" ON "m03_trigger_evaluations" USING btree ("policy_version_id","evaluated_at");--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_environment_ck" CHECK ("policies"."environment" in ('LOCAL','TESTNET_DEMO','TESTNET','MAINNET_READONLY'));
CREATE FUNCTION nerva_reject_m03_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'M03 records are append-only; append a superseding record instead';
END;
$$;

CREATE TRIGGER m03_policy_confirmations_append_only BEFORE UPDATE OR DELETE ON m03_policy_confirmations FOR EACH ROW EXECUTE FUNCTION nerva_reject_m03_mutation();
CREATE TRIGGER m03_policy_lifecycle_events_append_only BEFORE UPDATE OR DELETE ON m03_policy_lifecycle_events FOR EACH ROW EXECUTE FUNCTION nerva_reject_m03_mutation();
CREATE TRIGGER m03_trigger_evaluations_append_only BEFORE UPDATE OR DELETE ON m03_trigger_evaluations FOR EACH ROW EXECUTE FUNCTION nerva_reject_m03_mutation();
CREATE TRIGGER m03_execution_plans_append_only BEFORE UPDATE OR DELETE ON m03_execution_plans FOR EACH ROW EXECUTE FUNCTION nerva_reject_m03_mutation();
CREATE TRIGGER m03_simulation_results_append_only BEFORE UPDATE OR DELETE ON m03_simulation_results FOR EACH ROW EXECUTE FUNCTION nerva_reject_m03_mutation();
CREATE TRIGGER m03_authorization_refs_append_only BEFORE UPDATE OR DELETE ON m03_authorization_refs FOR EACH ROW EXECUTE FUNCTION nerva_reject_m03_mutation();
CREATE TRIGGER m03_provider_enrollment_refs_append_only BEFORE UPDATE OR DELETE ON m03_provider_enrollment_refs FOR EACH ROW EXECUTE FUNCTION nerva_reject_m03_mutation();
CREATE TRIGGER m03_nonce_ledger_append_only BEFORE UPDATE OR DELETE ON m03_nonce_ledger FOR EACH ROW EXECUTE FUNCTION nerva_reject_m03_mutation();
CREATE TRIGGER m03_execution_idempotency_append_only BEFORE UPDATE OR DELETE ON m03_execution_idempotency FOR EACH ROW EXECUTE FUNCTION nerva_reject_m03_mutation();
CREATE TRIGGER m03_execution_attempt_events_append_only BEFORE UPDATE OR DELETE ON m03_execution_attempt_events FOR EACH ROW EXECUTE FUNCTION nerva_reject_m03_mutation();
CREATE TRIGGER m03_execution_receipts_append_only BEFORE UPDATE OR DELETE ON m03_execution_receipts FOR EACH ROW EXECUTE FUNCTION nerva_reject_m03_mutation();
