CREATE TABLE "export_bundle_files" (
	"bundle_id" text,
	"path" text,
	"sha256" text NOT NULL,
	"byte_size" integer NOT NULL,
	"asset_version_id" text,
	"content" text,
	CONSTRAINT "export_bundle_files_pk" PRIMARY KEY("bundle_id","path"),
	CONSTRAINT "export_bundle_files_size_check" CHECK ("byte_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "export_bundle_markers" (
	"project_id" text PRIMARY KEY,
	"bundle_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_bundles" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"profile_revision_id" text NOT NULL,
	"context_revision_id" text NOT NULL,
	"delivery_target_revision_id" text,
	"adapter_version" text,
	"contract_version" text NOT NULL,
	"manifest_digest" text NOT NULL,
	"request_digest" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "export_bundles_project_id_id_idx" ON "export_bundles" ("project_id","id");--> statement-breakpoint
ALTER TABLE "export_bundle_files" ADD CONSTRAINT "export_bundle_files_bundle_id_export_bundles_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "export_bundles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "export_bundle_markers" ADD CONSTRAINT "export_bundle_markers_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "export_bundle_markers" ADD CONSTRAINT "export_bundle_markers_bundle_fk" FOREIGN KEY ("project_id","bundle_id") REFERENCES "export_bundles"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "export_bundles" ADD CONSTRAINT "export_bundles_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "export_bundles" ADD CONSTRAINT "export_bundles_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;