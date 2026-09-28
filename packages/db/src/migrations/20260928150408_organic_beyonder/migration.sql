CREATE TABLE "managed_snapshots" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"asset_version_id" text NOT NULL,
	"file_name" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"object_key" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "managed_snapshots_file_name_check" CHECK ("file_name" = btrim("file_name") AND char_length("file_name") BETWEEN 1 AND 255 AND position('/' in "file_name") = 0 AND position(chr(92) in "file_name") = 0),
	CONSTRAINT "managed_snapshots_byte_size_check" CHECK ("byte_size" > 0),
	CONSTRAINT "managed_snapshots_sha256_check" CHECK ("sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "manual_import_evidence" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"asset_version_id" text NOT NULL,
	"generation_package_id" text NOT NULL,
	"revision" integer NOT NULL,
	"source_surface" text NOT NULL,
	"actual_instruction" text NOT NULL,
	"recorded_by_user_id" text NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "manual_import_evidence_source_surface_check" CHECK ("source_surface" = btrim("source_surface") AND char_length("source_surface") BETWEEN 1 AND 120),
	CONSTRAINT "manual_import_evidence_instruction_check" CHECK (char_length(btrim("actual_instruction")) > 0 AND char_length("actual_instruction") <= 20000),
	CONSTRAINT "manual_import_evidence_revision_check" CHECK ("revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN "source_kind" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "managed_snapshots_idempotency_idx" ON "managed_snapshots" ("project_id","asset_version_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "managed_snapshots_version_created_idx" ON "managed_snapshots" ("project_id","asset_version_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "manual_import_evidence_revision_idx" ON "manual_import_evidence" ("project_id","asset_version_id","revision");--> statement-breakpoint
CREATE INDEX "manual_import_evidence_generation_package_idx" ON "manual_import_evidence" ("project_id","generation_package_id");--> statement-breakpoint
ALTER TABLE "managed_snapshots" ADD CONSTRAINT "managed_snapshots_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "managed_snapshots" ADD CONSTRAINT "managed_snapshots_version_fk" FOREIGN KEY ("project_id","asset_version_id","asset_record_id") REFERENCES "asset_versions"("project_id","id","asset_record_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "manual_import_evidence" ADD CONSTRAINT "manual_import_evidence_recorded_by_user_id_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "manual_import_evidence" ADD CONSTRAINT "manual_import_evidence_version_fk" FOREIGN KEY ("project_id","asset_version_id","asset_record_id") REFERENCES "asset_versions"("project_id","id","asset_record_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "manual_import_evidence" ADD CONSTRAINT "manual_import_evidence_generation_package_fk" FOREIGN KEY ("project_id","generation_package_id") REFERENCES "generation_packages"("project_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_source_kind_check" CHECK ("source_kind" IN ('manual_import', 'external_working_file_edit', 'legacy_asset', 'unknown'));