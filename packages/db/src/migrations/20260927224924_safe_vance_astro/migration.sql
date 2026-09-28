CREATE TABLE "generation_packages" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "generation_packages_project_id_id_idx" ON "generation_packages" ("project_id","id");--> statement-breakpoint
CREATE INDEX "generation_packages_project_record_created_at_idx" ON "generation_packages" ("project_id","asset_record_id","created_at");--> statement-breakpoint
CREATE INDEX "generation_packages_created_by_user_id_idx" ON "generation_packages" ("created_by_user_id");--> statement-breakpoint
ALTER TABLE "generation_packages" ADD CONSTRAINT "generation_packages_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "generation_packages" ADD CONSTRAINT "generation_packages_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "generation_packages" ADD CONSTRAINT "generation_packages_project_asset_record_fk" FOREIGN KEY ("project_id","asset_record_id") REFERENCES "asset_records"("project_id","id") ON DELETE RESTRICT;