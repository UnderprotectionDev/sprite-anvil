CREATE TABLE "runtime_validation_evidence" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"record_id" text NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"text" text,
	"file_name" text,
	"byte_size" integer,
	"sha256" text,
	"object_key" text,
	"request_digest" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "runtime_validation_evidence_kind_check" CHECK ("kind" in ('screenshot', 'recording', 'test_result', 'observation')),
	CONSTRAINT "runtime_validation_evidence_source_check" CHECK ("source" in ('manual', 'adapter_draft')),
	CONSTRAINT "runtime_validation_evidence_content_check" CHECK (("text" is not null and "file_name" is null and "byte_size" is null and "sha256" is null and "object_key" is null) or ("text" is null and "file_name" is not null and "byte_size" > 0 and "sha256" is not null and "object_key" is not null))
);
--> statement-breakpoint
CREATE TABLE "runtime_validation_records" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"bundle_id" text NOT NULL,
	"manifest_digest" text NOT NULL,
	"game_build" text NOT NULL,
	"engine_version" text NOT NULL,
	"adapter_version" text,
	"request_digest" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "runtime_validation_records_project_id_id_idx" ON "runtime_validation_records" ("project_id","id");--> statement-breakpoint
ALTER TABLE "runtime_validation_evidence" ADD CONSTRAINT "runtime_validation_evidence_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "runtime_validation_evidence" ADD CONSTRAINT "runtime_validation_evidence_record_fk" FOREIGN KEY ("project_id","record_id") REFERENCES "runtime_validation_records"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "runtime_validation_records" ADD CONSTRAINT "runtime_validation_records_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "runtime_validation_records" ADD CONSTRAINT "runtime_validation_records_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "runtime_validation_records" ADD CONSTRAINT "runtime_validation_records_bundle_fk" FOREIGN KEY ("project_id","bundle_id") REFERENCES "export_bundles"("project_id","id") ON DELETE CASCADE;