ALTER TABLE "m04_authorization_refs" ADD COLUMN "authorization_nonce_hash" text;--> statement-breakpoint
ALTER TABLE "m04_authorization_refs" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "m04_authorization_refs" ADD COLUMN "session_hash" text;--> statement-breakpoint
ALTER TABLE "m04_sessions" ADD COLUMN "issuance_proof_ref_hash" text;--> statement-breakpoint
ALTER TABLE "m04_sessions" ADD COLUMN "issuance_typed_data_digest" text;--> statement-breakpoint
ALTER TABLE "m04_sessions" ADD COLUMN "issuance_nonce_hash" text;--> statement-breakpoint
ALTER TABLE "m04_sessions" ADD COLUMN "revocation_generation" integer;--> statement-breakpoint
ALTER TABLE "m04_sessions" ADD COLUMN "delegation_observation_hash" text;--> statement-breakpoint
ALTER TABLE "m04_authorization_refs" ADD CONSTRAINT "m04_authorization_refs_session_id_m04_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."m04_sessions"("session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m04_authorization_refs" ADD CONSTRAINT "m04_authorization_nonce_hash_ck" CHECK ("m04_authorization_refs"."authorization_nonce_hash" is null or "m04_authorization_refs"."authorization_nonce_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "m04_authorization_refs" ADD CONSTRAINT "m04_authorization_session_pair_ck" CHECK (("m04_authorization_refs"."session_id" is null and "m04_authorization_refs"."session_hash" is null) or ("m04_authorization_refs"."session_id" is not null and "m04_authorization_refs"."session_hash" ~ '^[0-9a-f]{64}$'));--> statement-breakpoint
ALTER TABLE "m04_sessions" ADD CONSTRAINT "m04_session_issuance_proof_hash_ck" CHECK ("m04_sessions"."issuance_proof_ref_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "m04_sessions" ADD CONSTRAINT "m04_session_issuance_typed_hash_ck" CHECK ("m04_sessions"."issuance_typed_data_digest" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "m04_sessions" ADD CONSTRAINT "m04_session_issuance_nonce_hash_ck" CHECK ("m04_sessions"."issuance_nonce_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "m04_sessions" ADD CONSTRAINT "m04_session_revocation_generation_ck" CHECK ("m04_sessions"."revocation_generation" >= 0);--> statement-breakpoint
ALTER TABLE "m04_sessions" ADD CONSTRAINT "m04_session_delegation_hash_ck" CHECK ("m04_sessions"."delegation_observation_hash" ~ '^[0-9a-f]{64}$');