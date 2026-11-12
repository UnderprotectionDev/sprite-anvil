CREATE TABLE "project_archive_files" (
	"archive_id" text,
	"kind" text,
	"source_id" text,
	"asset_record_id" text,
	"asset_version_id" text,
	"file_name" text,
	"content_type" text,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"presence" text NOT NULL,
	"exclusion_reason" text,
	"source_object_key" text,
	CONSTRAINT "project_archive_files_pk" PRIMARY KEY("archive_id","kind","source_id"),
	CONSTRAINT "project_archive_files_size_check" CHECK ("byte_size" > 0),
	CONSTRAINT "project_archive_files_sha256_check" CHECK ("sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "project_archive_files_presence_check" CHECK (("presence" = 'included' AND "source_object_key" IS NOT NULL AND "exclusion_reason" IS NULL) OR ("presence" = 'excluded' AND "source_object_key" IS NULL AND "exclusion_reason" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "project_archive_requests" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"request_digest" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"working_file_ids" jsonb NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_archive_sections" (
	"archive_id" text,
	"record_group" text,
	"name" text,
	"record_count" integer NOT NULL,
	"digest" text NOT NULL,
	"records" jsonb NOT NULL,
	CONSTRAINT "project_archive_sections_pk" PRIMARY KEY("archive_id","record_group","name"),
	CONSTRAINT "project_archive_sections_count_check" CHECK ("record_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "project_archives" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"schema_version" text NOT NULL,
	"manifest_digest" text NOT NULL,
	"request_digest" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "project_archive_requests_project_id_id_idx" ON "project_archive_requests" ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_archives_project_id_id_idx" ON "project_archives" ("project_id","id");--> statement-breakpoint
ALTER TABLE "project_archive_files" ADD CONSTRAINT "project_archive_files_archive_id_project_archives_id_fkey" FOREIGN KEY ("archive_id") REFERENCES "project_archives"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_archive_requests" ADD CONSTRAINT "project_archive_requests_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_archive_requests" ADD CONSTRAINT "project_archive_requests_requested_by_user_id_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_archive_sections" ADD CONSTRAINT "project_archive_sections_archive_id_project_archives_id_fkey" FOREIGN KEY ("archive_id") REFERENCES "project_archives"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_archives" ADD CONSTRAINT "project_archives_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_archives" ADD CONSTRAINT "project_archives_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;