CREATE TABLE "managed_object_owner_gates" (
	"owner_user_id" text PRIMARY KEY,
	"erasure_operation_id" text,
	"generation" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "managed_object_reservations" (
	"object_key" text PRIMARY KEY,
	"owner_user_id" text NOT NULL,
	"project_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"write_settled_at" timestamp,
	CONSTRAINT "managed_object_reservations_purpose_check" CHECK ("purpose" in ('archive_import_zip', 'archive_import_file', 'archive_restore_copy'))
);
--> statement-breakpoint
CREATE TABLE "project_archive_import_requests" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_digest" text NOT NULL,
	"project_name" text NOT NULL,
	"staged_object_key" text NOT NULL,
	"completed_summary" text,
	"zip_byte_size" bigint NOT NULL,
	"zip_sha256" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_archive_import_requests_size_check" CHECK ("zip_byte_size" > 0),
	CONSTRAINT "project_archive_import_requests_sha256_check" CHECK ("zip_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "project_archive_restores" ADD COLUMN "operation_project_id" text;--> statement-breakpoint
ALTER TABLE "project_archive_restores" ADD COLUMN "canonical_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "managed_object_reservations_owner_idx" ON "managed_object_reservations" ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_archive_import_requests_project_id_id_idx" ON "project_archive_import_requests" ("project_id","id");--> statement-breakpoint
CREATE INDEX "project_archive_restores_operation_scope_idx" ON "project_archive_restores" ("operation_project_id","created_at");--> statement-breakpoint
ALTER TABLE "managed_object_reservations" ADD CONSTRAINT "managed_object_reservations_KHeEDlP0eFU8_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "managed_object_owner_gates"("owner_user_id");--> statement-breakpoint
ALTER TABLE "project_archive_import_requests" ADD CONSTRAINT "project_archive_import_requests_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_archive_import_requests" ADD CONSTRAINT "project_archive_import_requests_T9drZAlDUP4q_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "runtime_validation_evidence" DROP CONSTRAINT "runtime_validation_evidence_content_check", ADD CONSTRAINT "runtime_validation_evidence_content_check" CHECK (("text" is not null and "file_name" is null and "byte_size" is null and "sha256" is null and "object_key" is null) or ("text" is null and "file_name" is not null and "byte_size" > 0 and "sha256" is not null and "object_key" is not null) or ("text" is null and "file_name" is not null and "byte_size" > 0 and "sha256" is not null and "object_key" is null));