ALTER TABLE "m04_nonce_ledger" DROP CONSTRAINT "m04_nonce_operation_ck";--> statement-breakpoint
ALTER TABLE "m04_wallet_bindings" DROP CONSTRAINT "m04_wallet_binding_provider_ck";--> statement-breakpoint
ALTER TABLE "m04_nonce_ledger" ALTER COLUMN "grant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "m04_authorization_refs" ADD COLUMN "revocation_generation" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "m04_authorization_refs" ADD COLUMN "delegation_observation_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "m04_capability_grants" ADD COLUMN "grant_document" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "m04_capability_grants" ADD COLUMN "grant_approval_ref_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "m04_revocations" ADD COLUMN "proof_ref_hash" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "m04_capability_nonce_domain_uq" ON "m04_capability_grants" USING btree ("nonce_domain_hash");--> statement-breakpoint
ALTER TABLE "m04_authorization_refs" ADD CONSTRAINT "m04_authorization_generation_ck" CHECK ("m04_authorization_refs"."revocation_generation" >= 0);--> statement-breakpoint
ALTER TABLE "m04_authorization_refs" ADD CONSTRAINT "m04_authorization_delegation_hash_ck" CHECK ("m04_authorization_refs"."delegation_observation_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "m04_capability_grants" ADD CONSTRAINT "m04_capability_grant_approval_ck" CHECK ("m04_capability_grants"."grant_approval_ref_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "m04_nonce_ledger" ADD CONSTRAINT "m04_nonce_grant_ck" CHECK ("m04_nonce_ledger"."operation" in ('WALLET_BINDING','AGENT_IDENTITY','GRANT_APPROVAL') or "m04_nonce_ledger"."grant_id" is not null);--> statement-breakpoint
ALTER TABLE "m04_nonce_ledger" ADD CONSTRAINT "m04_nonce_operation_ck" CHECK ("m04_nonce_ledger"."operation" in ('WALLET_BINDING','AGENT_IDENTITY','GRANT_APPROVAL','AUTHORIZATION','SESSION','REVOCATION'));--> statement-breakpoint
ALTER TABLE "m04_revocations" ADD CONSTRAINT "m04_revocation_proof_hash_ck" CHECK ("m04_revocations"."proof_ref_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "m04_wallet_bindings" ADD CONSTRAINT "m04_wallet_binding_provider_ck" CHECK ("m04_wallet_bindings"."provider_id" = 'eip712-compatible-wallet');