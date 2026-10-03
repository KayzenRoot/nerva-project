CREATE TABLE "m04_agent_identities" (
	"agent_identity_id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"version" integer NOT NULL,
	"issuer_id" text NOT NULL,
	"provenance_hash" text NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	CONSTRAINT "m04_agent_identity_version_ck" CHECK ("m04_agent_identities"."version" > 0),
	CONSTRAINT "m04_agent_identity_chain_ck" CHECK ("m04_agent_identities"."chain_id" = 10143),
	CONSTRAINT "m04_agent_identity_provenance_ck" CHECK ("m04_agent_identities"."provenance_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "m04_authority_states" (
	"grant_id" text PRIMARY KEY NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "m04_authority_generation_ck" CHECK ("m04_authority_states"."generation" >= 0)
);
--> statement-breakpoint
CREATE TABLE "m04_authorization_refs" (
	"authorization_ref" text PRIMARY KEY NOT NULL,
	"grant_id" text NOT NULL,
	"proof_ref_hash" text NOT NULL,
	"typed_data_digest" text NOT NULL,
	"plan_digest" text NOT NULL,
	"action" text NOT NULL,
	"verified_signer" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "m04_authorization_action_ck" CHECK ("m04_authorization_refs"."action" in ('REDUCE_POSITION','CLOSE_POSITION','NO_ACTION')),
	CONSTRAINT "m04_authorization_proof_hash_ck" CHECK ("m04_authorization_refs"."proof_ref_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m04_authorization_typed_hash_ck" CHECK ("m04_authorization_refs"."typed_data_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m04_authorization_plan_hash_ck" CHECK ("m04_authorization_refs"."plan_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "m04_capability_grants" (
	"grant_id" text PRIMARY KEY NOT NULL,
	"grant_hash" text NOT NULL,
	"account_id" text NOT NULL,
	"wallet_address" text NOT NULL,
	"agent_id" text NOT NULL,
	"agent_version" integer NOT NULL,
	"chain_id" integer NOT NULL,
	"policy_hash" text NOT NULL,
	"scope" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"limits" jsonb NOT NULL,
	"nonce_domain_hash" text NOT NULL,
	"delegation_observation_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "m04_capability_grant_chain_ck" CHECK ("m04_capability_grants"."chain_id" = 10143),
	CONSTRAINT "m04_capability_grant_action_ck" CHECK (jsonb_typeof("m04_capability_grants"."actions") = 'array'),
	CONSTRAINT "m04_capability_grant_limits_ck" CHECK (jsonb_typeof("m04_capability_grants"."limits") = 'object'),
	CONSTRAINT "m04_capability_grant_scope_ck" CHECK (jsonb_typeof("m04_capability_grants"."scope") = 'object'),
	CONSTRAINT "m04_capability_grant_expiry_ck" CHECK ("m04_capability_grants"."expires_at" > "m04_capability_grants"."created_at"),
	CONSTRAINT "m04_capability_grant_hash_ck" CHECK ("m04_capability_grants"."grant_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m04_capability_policy_hash_ck" CHECK ("m04_capability_grants"."policy_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m04_capability_nonce_domain_hash_ck" CHECK ("m04_capability_grants"."nonce_domain_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m04_capability_delegate_observation_ck" CHECK ("m04_capability_grants"."delegation_observation_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "m04_delegation_observations" (
	"observation_id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"wallet_address" text NOT NULL,
	"chain_id" integer NOT NULL,
	"status" text NOT NULL,
	"delegate_address" text,
	"delegate_code_hash" text,
	"block_number" text,
	"block_hash" text,
	"observation_hash" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "m04_delegation_chain_ck" CHECK ("m04_delegation_observations"."chain_id" = 10143),
	CONSTRAINT "m04_delegation_status_ck" CHECK ("m04_delegation_observations"."status" in ('ABSENT','ACTIVE','CHANGED','REVOKED','UNKNOWN')),
	CONSTRAINT "m04_delegation_observation_hash_ck" CHECK ("m04_delegation_observations"."observation_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m04_delegation_active_ck" CHECK ("m04_delegation_observations"."status" <> 'ACTIVE' or ("m04_delegation_observations"."delegate_address" is not null and "m04_delegation_observations"."delegate_code_hash" ~ '^[0-9a-f]{64}$' and "m04_delegation_observations"."block_hash" ~ '^0x[0-9a-f]{64}$'))
);
--> statement-breakpoint
CREATE TABLE "m04_nonce_ledger" (
	"nonce_hash" text PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"account_id" text NOT NULL,
	"wallet_address" text NOT NULL,
	"agent_id" text NOT NULL,
	"grant_id" text NOT NULL,
	"operation" text NOT NULL,
	"domain_hash" text NOT NULL,
	"consumed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "m04_nonce_chain_ck" CHECK ("m04_nonce_ledger"."chain_id" = 10143),
	CONSTRAINT "m04_nonce_operation_ck" CHECK ("m04_nonce_ledger"."operation" in ('WALLET_BINDING','AUTHORIZATION','SESSION','REVOCATION')),
	CONSTRAINT "m04_nonce_hash_ck" CHECK ("m04_nonce_ledger"."nonce_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m04_nonce_domain_hash_ck" CHECK ("m04_nonce_ledger"."domain_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "m04_permission_evidence" (
	"sequence" integer PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"previous_hash" text NOT NULL,
	"entry_hash" text NOT NULL,
	"event" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "m04_permission_evidence_previous_ck" CHECK ("m04_permission_evidence"."previous_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m04_permission_evidence_entry_ck" CHECK ("m04_permission_evidence"."entry_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m04_permission_evidence_event_ck" CHECK (jsonb_typeof("m04_permission_evidence"."event") = 'object')
);
--> statement-breakpoint
CREATE TABLE "m04_permission_evidence_head" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"last_sequence" integer DEFAULT 0 NOT NULL,
	"last_hash" text DEFAULT '0000000000000000000000000000000000000000000000000000000000000000' NOT NULL,
	CONSTRAINT "m04_permission_evidence_singleton_ck" CHECK ("m04_permission_evidence_head"."singleton" = true),
	CONSTRAINT "m04_permission_evidence_sequence_ck" CHECK ("m04_permission_evidence_head"."last_sequence" >= 0),
	CONSTRAINT "m04_permission_evidence_head_hash_ck" CHECK ("m04_permission_evidence_head"."last_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "m04_revocations" (
	"revocation_id" text PRIMARY KEY NOT NULL,
	"grant_id" text NOT NULL,
	"generation" integer NOT NULL,
	"actor_ref" text NOT NULL,
	"reason_code" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "m04_revocation_generation_ck" CHECK ("m04_revocations"."generation" > 0),
	CONSTRAINT "m04_revocation_reason_ck" CHECK ("m04_revocations"."reason_code" ~ '^[A-Z0-9_]{1,100}$')
);
--> statement-breakpoint
CREATE TABLE "m04_sessions" (
	"session_id" text PRIMARY KEY NOT NULL,
	"grant_id" text NOT NULL,
	"session_hash" text NOT NULL,
	"nonce_domain_hash" text NOT NULL,
	"actions" jsonb NOT NULL,
	"limits" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "m04_session_hash_ck" CHECK ("m04_sessions"."session_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m04_session_domain_hash_ck" CHECK ("m04_sessions"."nonce_domain_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m04_session_expiry_ck" CHECK ("m04_sessions"."expires_at" > "m04_sessions"."created_at"),
	CONSTRAINT "m04_session_actions_ck" CHECK (jsonb_typeof("m04_sessions"."actions") = 'array'),
	CONSTRAINT "m04_session_limits_ck" CHECK (jsonb_typeof("m04_sessions"."limits") = 'object')
);
--> statement-breakpoint
CREATE TABLE "m04_wallet_bindings" (
	"binding_id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"chain_id" integer NOT NULL,
	"network" text NOT NULL,
	"wallet_address" text NOT NULL,
	"provider_id" text NOT NULL,
	"event_type" text NOT NULL,
	"generation" integer NOT NULL,
	"provenance_hash" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "m04_wallet_binding_chain_ck" CHECK ("m04_wallet_bindings"."chain_id" = 10143),
	CONSTRAINT "m04_wallet_binding_network_ck" CHECK ("m04_wallet_bindings"."network" = 'monad-testnet'),
	CONSTRAINT "m04_wallet_binding_provider_ck" CHECK ("m04_wallet_bindings"."provider_id" = 'metamask-agent-wallet'),
	CONSTRAINT "m04_wallet_binding_event_ck" CHECK ("m04_wallet_bindings"."event_type" in ('BOUND','UNBOUND')),
	CONSTRAINT "m04_wallet_binding_generation_ck" CHECK ("m04_wallet_bindings"."generation" > 0),
	CONSTRAINT "m04_wallet_binding_provenance_ck" CHECK ("m04_wallet_bindings"."provenance_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "m04_authority_states" ADD CONSTRAINT "m04_authority_states_grant_id_m04_capability_grants_grant_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."m04_capability_grants"("grant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m04_authorization_refs" ADD CONSTRAINT "m04_authorization_refs_grant_id_m04_capability_grants_grant_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."m04_capability_grants"("grant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m04_nonce_ledger" ADD CONSTRAINT "m04_nonce_ledger_grant_id_m04_capability_grants_grant_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."m04_capability_grants"("grant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m04_revocations" ADD CONSTRAINT "m04_revocations_grant_id_m04_capability_grants_grant_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."m04_capability_grants"("grant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m04_sessions" ADD CONSTRAINT "m04_sessions_grant_id_m04_capability_grants_grant_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."m04_capability_grants"("grant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "m04_agent_identity_version_uq" ON "m04_agent_identities" USING btree ("agent_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "m04_authorization_digest_uq" ON "m04_authorization_refs" USING btree ("typed_data_digest");--> statement-breakpoint
CREATE UNIQUE INDEX "m04_capability_grant_hash_uq" ON "m04_capability_grants" USING btree ("grant_hash");--> statement-breakpoint
CREATE INDEX "m04_delegation_account_idx" ON "m04_delegation_observations" USING btree ("chain_id","wallet_address","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "m04_permission_evidence_id_uq" ON "m04_permission_evidence" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "m04_permission_evidence_hash_uq" ON "m04_permission_evidence" USING btree ("entry_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "m04_revocation_generation_uq" ON "m04_revocations" USING btree ("grant_id","generation");--> statement-breakpoint
CREATE UNIQUE INDEX "m04_session_hash_uq" ON "m04_sessions" USING btree ("session_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "m04_session_nonce_domain_uq" ON "m04_sessions" USING btree ("nonce_domain_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "m04_wallet_binding_generation_uq" ON "m04_wallet_bindings" USING btree ("chain_id","wallet_address","generation");
--> statement-breakpoint
CREATE FUNCTION nerva_reject_m04_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'M04 records are append-only; append a superseding record instead';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER m04_wallet_bindings_append_only BEFORE UPDATE OR DELETE ON m04_wallet_bindings FOR EACH ROW EXECUTE FUNCTION nerva_reject_m04_mutation();
CREATE TRIGGER m04_agent_identities_append_only BEFORE UPDATE OR DELETE ON m04_agent_identities FOR EACH ROW EXECUTE FUNCTION nerva_reject_m04_mutation();
CREATE TRIGGER m04_capability_grants_append_only BEFORE UPDATE OR DELETE ON m04_capability_grants FOR EACH ROW EXECUTE FUNCTION nerva_reject_m04_mutation();
CREATE TRIGGER m04_sessions_append_only BEFORE UPDATE OR DELETE ON m04_sessions FOR EACH ROW EXECUTE FUNCTION nerva_reject_m04_mutation();
CREATE TRIGGER m04_nonce_ledger_append_only BEFORE UPDATE OR DELETE ON m04_nonce_ledger FOR EACH ROW EXECUTE FUNCTION nerva_reject_m04_mutation();
CREATE TRIGGER m04_authorization_refs_append_only BEFORE UPDATE OR DELETE ON m04_authorization_refs FOR EACH ROW EXECUTE FUNCTION nerva_reject_m04_mutation();
CREATE TRIGGER m04_delegation_observations_append_only BEFORE UPDATE OR DELETE ON m04_delegation_observations FOR EACH ROW EXECUTE FUNCTION nerva_reject_m04_mutation();
CREATE TRIGGER m04_revocations_append_only BEFORE UPDATE OR DELETE ON m04_revocations FOR EACH ROW EXECUTE FUNCTION nerva_reject_m04_mutation();
CREATE TRIGGER m04_permission_evidence_append_only BEFORE UPDATE OR DELETE ON m04_permission_evidence FOR EACH ROW EXECUTE FUNCTION nerva_reject_m04_mutation();
--> statement-breakpoint
CREATE FUNCTION nerva_guard_m04_authority_generation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'M04 authority state cannot be deleted';
  END IF;
  IF NEW.generation < OLD.generation OR NEW.generation > OLD.generation + 1 THEN
    RAISE EXCEPTION 'M04 revocation generation must be monotonic';
  END IF;
  IF OLD.revoked AND NOT NEW.revoked THEN
    RAISE EXCEPTION 'M04 revocation cannot be undone';
  END IF;
  IF NEW.generation = OLD.generation AND NEW.revoked <> OLD.revoked THEN
    RAISE EXCEPTION 'M04 revocation requires a generation increment';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER m04_authority_states_monotonic BEFORE UPDATE OR DELETE ON m04_authority_states FOR EACH ROW EXECUTE FUNCTION nerva_guard_m04_authority_generation();
--> statement-breakpoint
CREATE FUNCTION nerva_guard_m04_evidence_head() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR NEW.singleton IS DISTINCT FROM OLD.singleton OR NEW.last_sequence <> OLD.last_sequence + 1 THEN
    RAISE EXCEPTION 'M04 evidence head must advance exactly one append';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER m04_permission_evidence_head_monotonic BEFORE UPDATE OR DELETE ON m04_permission_evidence_head FOR EACH ROW EXECUTE FUNCTION nerva_guard_m04_evidence_head();
