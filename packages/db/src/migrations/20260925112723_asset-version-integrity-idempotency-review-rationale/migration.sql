ALTER TABLE "asset_version_review_events" ADD COLUMN "rationale" text;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN "content_digest" text;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN "integrity_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN "idempotency_key" text DEFAULT 'legacy:' || gen_random_uuid() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_versions_idempotency_key_idx" ON "asset_versions" ("project_id","asset_record_id","idempotency_key");--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_content_digest_check" CHECK ("content_digest" IS NULL OR "content_digest" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_integrity_digest_check" CHECK ("integrity_verified" = false OR "content_digest" IS NOT NULL);