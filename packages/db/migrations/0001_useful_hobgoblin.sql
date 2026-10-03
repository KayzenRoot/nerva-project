CREATE TABLE "market_snapshots" (
	"snapshot_id" text PRIMARY KEY NOT NULL,
	"market_id" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"quality" text NOT NULL,
	"content_hash" text NOT NULL,
	"correlation_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "market_snapshots_hash_ck" CHECK ("market_snapshots"."content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "market_snapshots_quality_ck" CHECK ("market_snapshots"."quality" in ('FRESH','STALE','UNKNOWN','INCONSISTENT'))
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"snapshot_id" text PRIMARY KEY NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"quality" text NOT NULL,
	"content_hash" text NOT NULL,
	"correlation_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "portfolio_snapshots_hash_ck" CHECK ("portfolio_snapshots"."content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "portfolio_snapshots_quality_ck" CHECK ("portfolio_snapshots"."quality" in ('FRESH','STALE','UNKNOWN','INCONSISTENT'))
);
--> statement-breakpoint
CREATE TABLE "position_snapshots" (
	"snapshot_id" text PRIMARY KEY NOT NULL,
	"position_id" text NOT NULL,
	"market_id" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"quality" text NOT NULL,
	"content_hash" text NOT NULL,
	"correlation_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "position_snapshots_hash_ck" CHECK ("position_snapshots"."content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "position_snapshots_quality_ck" CHECK ("position_snapshots"."quality" in ('FRESH','STALE','UNKNOWN','INCONSISTENT'))
);
--> statement-breakpoint
CREATE TABLE "provider_checkpoints" (
	"provider" text NOT NULL,
	"stream" text NOT NULL,
	"chain_id" integer NOT NULL,
	"session_id" text,
	"sequence" text,
	"source_block" text,
	"quality" text NOT NULL,
	"reconnect_count" integer DEFAULT 0 NOT NULL,
	"reason" text,
	"observed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "provider_checkpoints_chain_ck" CHECK ("provider_checkpoints"."chain_id" in (143,10143)),
	CONSTRAINT "provider_checkpoints_quality_ck" CHECK ("provider_checkpoints"."quality" in ('FRESH','STALE','UNKNOWN','INCONSISTENT')),
	CONSTRAINT "provider_checkpoints_reconnect_ck" CHECK ("provider_checkpoints"."reconnect_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "risk_metrics" (
	"metric_id" text PRIMARY KEY NOT NULL,
	"snapshot_id" text NOT NULL,
	"name" text NOT NULL,
	"value" text,
	"value_bps" integer,
	"quality" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "risk_metrics_quality_ck" CHECK ("risk_metrics"."quality" in ('FRESH','STALE','UNKNOWN','INCONSISTENT')),
	CONSTRAINT "risk_metrics_bps_ck" CHECK ("risk_metrics"."value_bps" is null or "risk_metrics"."value_bps" between 0 and 10000)
);
--> statement-breakpoint
CREATE TABLE "risk_snapshots" (
	"snapshot_id" text PRIMARY KEY NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"quality" text NOT NULL,
	"actionable" boolean DEFAULT false NOT NULL,
	"content_hash" text NOT NULL,
	"correlation_id" text NOT NULL,
	"source_snapshot_hashes" text[] NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "risk_snapshots_hash_ck" CHECK ("risk_snapshots"."content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "risk_snapshots_quality_ck" CHECK ("risk_snapshots"."quality" in ('FRESH','STALE','UNKNOWN','INCONSISTENT')),
	CONSTRAINT "risk_snapshots_actionable_ck" CHECK ("risk_snapshots"."actionable" = false)
);
--> statement-breakpoint
ALTER TABLE "integration_health_samples" DROP CONSTRAINT "integration_health_status_ck";--> statement-breakpoint
ALTER TABLE "risk_metrics" ADD CONSTRAINT "risk_metrics_snapshot_id_risk_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."risk_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "market_snapshots_market_time_idx" ON "market_snapshots" USING btree ("market_id","observed_at");--> statement-breakpoint
CREATE INDEX "portfolio_snapshots_time_idx" ON "portfolio_snapshots" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "position_snapshots_position_time_idx" ON "position_snapshots" USING btree ("position_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_checkpoints_identity_uq" ON "provider_checkpoints" USING btree ("provider","stream","chain_id");--> statement-breakpoint
CREATE INDEX "risk_metrics_snapshot_idx" ON "risk_metrics" USING btree ("snapshot_id","name");--> statement-breakpoint
CREATE INDEX "risk_snapshots_time_idx" ON "risk_snapshots" USING btree ("generated_at");--> statement-breakpoint
ALTER TABLE "integration_health_samples" ADD CONSTRAINT "integration_health_status_ck" CHECK ("integration_health_samples"."status" in ('HEALTHY','DEGRADED','STALE','UNKNOWN','UNAVAILABLE'));
--> statement-breakpoint
CREATE TRIGGER market_snapshots_append_only BEFORE UPDATE OR DELETE ON market_snapshots
  FOR EACH ROW EXECUTE FUNCTION nerva_reject_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER position_snapshots_append_only BEFORE UPDATE OR DELETE ON position_snapshots
  FOR EACH ROW EXECUTE FUNCTION nerva_reject_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER portfolio_snapshots_append_only BEFORE UPDATE OR DELETE ON portfolio_snapshots
  FOR EACH ROW EXECUTE FUNCTION nerva_reject_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER risk_snapshots_append_only BEFORE UPDATE OR DELETE ON risk_snapshots
  FOR EACH ROW EXECUTE FUNCTION nerva_reject_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER risk_metrics_append_only BEFORE UPDATE OR DELETE ON risk_metrics
  FOR EACH ROW EXECUTE FUNCTION nerva_reject_immutable_mutation();
