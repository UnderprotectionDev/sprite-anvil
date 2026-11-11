CREATE TABLE "delivery_refresh_lock_files" (
	"lock_id" text,
	"path" text,
	"sha256" text NOT NULL,
	"byte_size" integer NOT NULL,
	CONSTRAINT "delivery_refresh_lock_files_pk" PRIMARY KEY("lock_id","path"),
	CONSTRAINT "delivery_refresh_lock_files_size_check" CHECK ("byte_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "delivery_refresh_locks" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"bundle_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"profile_revision_id" text NOT NULL,
	"bundle_manifest_digest" text NOT NULL,
	"contract_version" text NOT NULL,
	"lock_digest" text NOT NULL,
	"request_digest" text NOT NULL,
	"destination_label" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_refresh_locks_project_id_id_idx" ON "delivery_refresh_locks" ("project_id","id");--> statement-breakpoint
ALTER TABLE "delivery_refresh_lock_files" ADD CONSTRAINT "delivery_refresh_lock_files_Lr5N9BxATPPk_fkey" FOREIGN KEY ("lock_id") REFERENCES "delivery_refresh_locks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_refresh_locks" ADD CONSTRAINT "delivery_refresh_locks_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_refresh_locks" ADD CONSTRAINT "delivery_refresh_locks_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_refresh_locks" ADD CONSTRAINT "delivery_refresh_locks_bundle_fk" FOREIGN KEY ("project_id","bundle_id") REFERENCES "export_bundles"("project_id","id") ON DELETE CASCADE;