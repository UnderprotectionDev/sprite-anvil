CREATE TABLE "project_archive_import_requests" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_digest" text NOT NULL,
	"project_name" text NOT NULL,
	"staged_object_key" text NOT NULL,
	"zip_byte_size" bigint NOT NULL,
	"zip_sha256" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_archive_import_requests_size_check" CHECK ("zip_byte_size" > 0),
	CONSTRAINT "project_archive_import_requests_sha256_check" CHECK ("zip_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "project_archive_import_requests_project_id_id_idx" ON "project_archive_import_requests" ("project_id","id");--> statement-breakpoint
ALTER TABLE "project_archive_import_requests" ADD CONSTRAINT "project_archive_import_requests_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_archive_import_requests" ADD CONSTRAINT "project_archive_import_requests_T9drZAlDUP4q_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;