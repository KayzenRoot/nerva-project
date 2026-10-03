CREATE TABLE "m04_session_revocations" (
	"session_id" text PRIMARY KEY NOT NULL,
	"generation" integer NOT NULL,
	"actor_ref" text NOT NULL,
	"proof_ref_hash" text NOT NULL,
	"nonce_hash" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "m04_session_revocation_generation_ck" CHECK ("m04_session_revocations"."generation" = 1),
	CONSTRAINT "m04_session_revocation_actor_ck" CHECK ("m04_session_revocations"."actor_ref" <> ''),
	CONSTRAINT "m04_session_revocation_proof_ck" CHECK ("m04_session_revocations"."proof_ref_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "m04_session_revocation_nonce_ck" CHECK ("m04_session_revocations"."nonce_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "m04_session_revocations" ADD CONSTRAINT "m04_session_revocations_session_id_m04_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."m04_sessions"("session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "m04_session_revocation_generation_uq" ON "m04_session_revocations" USING btree ("session_id","generation");
--> statement-breakpoint
CREATE TRIGGER m04_session_revocations_append_only BEFORE UPDATE OR DELETE ON m04_session_revocations FOR EACH ROW EXECUTE FUNCTION nerva_reject_m04_mutation();
