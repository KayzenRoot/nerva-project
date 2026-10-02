CREATE TABLE "audit_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"actor" text NOT NULL,
	"subject_id" text,
	"reason" text NOT NULL,
	"correlation_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_health_samples" (
	"sample_id" text PRIMARY KEY NOT NULL,
	"integration" text NOT NULL,
	"status" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"correlation_id" text NOT NULL,
	"reason" text NOT NULL,
	CONSTRAINT "integration_health_status_ck" CHECK ("integration_health_samples"."status" in ('HEALTHY','DEGRADED','STALE','UNKNOWN'))
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"policy_id" text PRIMARY KEY NOT NULL,
	"environment" text NOT NULL,
	"state" text DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "policies_state_ck" CHECK ("policies"."state" in ('DRAFT','VALIDATED','USER_CONFIRMED','ACTIVE','PAUSED','REVOKED','EXPIRED')),
	CONSTRAINT "policies_environment_ck" CHECK ("policies"."environment" in ('LOCAL','TESTNET_DEMO','MAINNET_READONLY'))
);
--> statement-breakpoint
CREATE TABLE "policy_versions" (
	"policy_version_id" text PRIMARY KEY NOT NULL,
	"policy_id" text NOT NULL,
	"version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "policy_versions_version_ck" CHECK ("policy_versions"."version" > 0),
	CONSTRAINT "policy_versions_hash_ck" CHECK ("policy_versions"."content_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "runtime_controls" (
	"control_key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"reason" text NOT NULL,
	"actor" text NOT NULL,
	"source" text NOT NULL,
	"correlation_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policy_id_policies_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("policy_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "policy_versions_identity_uq" ON "policy_versions" USING btree ("policy_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "policy_versions_hash_uq" ON "policy_versions" USING btree ("content_hash");
--> statement-breakpoint
CREATE FUNCTION nerva_reject_immutable_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only and cannot be updated or deleted', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER policy_versions_immutable BEFORE UPDATE OR DELETE ON policy_versions
  FOR EACH ROW EXECUTE FUNCTION nerva_reject_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION nerva_reject_immutable_mutation();
--> statement-breakpoint
CREATE FUNCTION nerva_audit_runtime_control_change() RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_events (event_id, event_type, actor, subject_id, reason, correlation_id, payload, occurred_at)
  VALUES (
    'runtime-control-' || md5(random()::text || clock_timestamp()::text),
    'RUNTIME_CONTROL_CHANGED',
    NEW.actor,
    NEW.control_key,
    NEW.reason,
    NEW.correlation_id,
    jsonb_build_object('enabled', NEW.enabled, 'source', NEW.source),
    NEW.updated_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER runtime_controls_audit AFTER UPDATE ON runtime_controls
  FOR EACH ROW EXECUTE FUNCTION nerva_audit_runtime_control_change();
--> statement-breakpoint
INSERT INTO runtime_controls (control_key, enabled, reason, actor, source, correlation_id)
VALUES ('GLOBAL_EXECUTION_DISABLED', TRUE, 'M01 default: financial execution is disabled', 'system', 'migration', 'm01-initialization');
