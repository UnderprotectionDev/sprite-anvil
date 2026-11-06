CREATE TABLE "offline_conflict_records" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"draft_id" text NOT NULL,
	"contract_version" text NOT NULL,
	"base_revision" integer NOT NULL,
	"cloud_revision" integer NOT NULL,
	"local_digest" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "offline_conflict_records_revision_check" CHECK ("base_revision" >= 0 AND "cloud_revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "offline_conflict_resolutions" (
	"id" text PRIMARY KEY,
	"conflict_id" text NOT NULL,
	"project_id" text NOT NULL,
	"resolved_by_user_id" text NOT NULL,
	"choice" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"result_asset_version_id" text,
	"resolved_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "offline_conflict_resolutions_choice_check" CHECK ("choice" IN ('create-candidate', 'keep-cloud-retain-draft', 'abandon')),
	CONSTRAINT "offline_conflict_resolutions_result_check" CHECK ("choice" = 'create-candidate' OR "result_asset_version_id" IS NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "offline_conflict_records_detection_idx" ON "offline_conflict_records" ("project_id","owner_user_id","draft_id","base_revision","cloud_revision","local_digest");--> statement-breakpoint
CREATE INDEX "offline_conflict_records_owner_idx" ON "offline_conflict_records" ("project_id","owner_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "offline_conflict_resolutions_conflict_idx" ON "offline_conflict_resolutions" ("conflict_id");--> statement-breakpoint
ALTER TABLE "offline_conflict_records" ADD CONSTRAINT "offline_conflict_records_owner_user_id_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "offline_conflict_resolutions" ADD CONSTRAINT "offline_conflict_resolutions_6TSkjdnqF5S9_fkey" FOREIGN KEY ("conflict_id") REFERENCES "offline_conflict_records"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "offline_conflict_resolutions" ADD CONSTRAINT "offline_conflict_resolutions_resolved_by_user_id_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;