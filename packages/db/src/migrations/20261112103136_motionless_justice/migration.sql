CREATE TABLE "project_archive_restore_files" (
	"restore_id" text,
	"kind" text,
	"source_id" text,
	"restored_id" text NOT NULL,
	"asset_record_id" text,
	"asset_version_id" text,
	"file_name" text,
	"content_type" text,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"presence" text NOT NULL,
	"exclusion_reason" text,
	"object_key" text,
	CONSTRAINT "project_archive_restore_files_pk" PRIMARY KEY("restore_id","kind","source_id"),
	CONSTRAINT "project_archive_restore_files_size_check" CHECK ("byte_size" > 0),
	CONSTRAINT "project_archive_restore_files_sha256_check" CHECK ("sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "project_archive_restore_files_presence_check" CHECK (("presence" = 'included' AND "object_key" IS NOT NULL AND "exclusion_reason" IS NULL) OR ("presence" = 'excluded' AND "object_key" IS NULL AND "exclusion_reason" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "project_archive_restore_ids" (
	"restore_id" text,
	"record_group" text,
	"name" text,
	"source_id" text,
	"restored_id" text NOT NULL,
	CONSTRAINT "project_archive_restore_ids_pk" PRIMARY KEY("restore_id","record_group","name","source_id")
);
--> statement-breakpoint
CREATE TABLE "project_archive_restore_requests" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"archive_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_digest" text NOT NULL,
	"project_name" text NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_archive_restore_sections" (
	"restore_id" text,
	"record_group" text,
	"name" text,
	"record_count" integer NOT NULL,
	"digest" text NOT NULL,
	"source_digest" text NOT NULL,
	"records" jsonb NOT NULL,
	CONSTRAINT "project_archive_restore_sections_pk" PRIMARY KEY("restore_id","record_group","name"),
	CONSTRAINT "project_archive_restore_sections_count_check" CHECK ("record_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "project_archive_restores" (
	"id" text PRIMARY KEY,
	"restored_project_id" text NOT NULL,
	"source_project_id" text NOT NULL,
	"archive_id" text NOT NULL,
	"manifest_digest" text NOT NULL,
	"request_digest" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "project_archive_restore_ids_restored_idx" ON "project_archive_restore_ids" ("restore_id","restored_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_archive_restore_requests_project_id_id_idx" ON "project_archive_restore_requests" ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_archive_restores_restored_project_idx" ON "project_archive_restores" ("restored_project_id");--> statement-breakpoint
CREATE INDEX "project_archive_restores_source_idx" ON "project_archive_restores" ("source_project_id","created_at");--> statement-breakpoint
ALTER TABLE "project_archive_restore_files" ADD CONSTRAINT "project_archive_restore_files_h3TZYP4ISe7B_fkey" FOREIGN KEY ("restore_id") REFERENCES "project_archive_restores"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_archive_restore_ids" ADD CONSTRAINT "project_archive_restore_ids_n1WgTd6ax0SE_fkey" FOREIGN KEY ("restore_id") REFERENCES "project_archive_restores"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_archive_restore_requests" ADD CONSTRAINT "project_archive_restore_requests_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_archive_restore_requests" ADD CONSTRAINT "project_archive_restore_requests_kkoHany3z1Y7_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_archive_restore_sections" ADD CONSTRAINT "project_archive_restore_sections_zfeeJtANTO8o_fkey" FOREIGN KEY ("restore_id") REFERENCES "project_archive_restores"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_archive_restores" ADD CONSTRAINT "project_archive_restores_restored_project_id_project_id_fkey" FOREIGN KEY ("restored_project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_archive_restores" ADD CONSTRAINT "project_archive_restores_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;