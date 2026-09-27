CREATE TABLE "collection_asset_records" (
	"project_id" text,
	"collection_id" text,
	"asset_record_id" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collection_asset_records_pk" PRIMARY KEY("project_id","collection_id","asset_record_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX IF EXISTS "asset_families_project_name_ci_idx";--> statement-breakpoint
CREATE INDEX "collection_asset_records_project_asset_record_idx" ON "collection_asset_records" ("project_id","asset_record_id");--> statement-breakpoint
CREATE INDEX "collection_asset_records_created_by_user_id_idx" ON "collection_asset_records" ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_project_id_id_idx" ON "collections" ("project_id","id");--> statement-breakpoint
CREATE INDEX "collections_project_name_idx" ON "collections" ("project_id","name");--> statement-breakpoint
CREATE INDEX "collections_created_by_user_id_idx" ON "collections" ("created_by_user_id");--> statement-breakpoint
ALTER TABLE "collection_asset_records" ADD CONSTRAINT "collection_asset_records_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_asset_records" ADD CONSTRAINT "collection_asset_records_project_collection_fk" FOREIGN KEY ("project_id","collection_id") REFERENCES "collections"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_asset_records" ADD CONSTRAINT "collection_asset_records_project_asset_record_fk" FOREIGN KEY ("project_id","asset_record_id") REFERENCES "asset_records"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;
