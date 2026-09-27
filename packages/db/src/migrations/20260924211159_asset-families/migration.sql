CREATE TABLE "asset_families" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"subject_identity_id" text NOT NULL,
	"name" text NOT NULL,
	"visual_world_id" text NOT NULL,
	"use_context" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_family_relationships" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"source_asset_record_id" text NOT NULL,
	"target_asset_record_id" text NOT NULL,
	"type" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_family_relationships_distinct_records_check" CHECK ("source_asset_record_id" <> "target_asset_record_id")
);
--> statement-breakpoint
CREATE TABLE "asset_records" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"name" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subject_identities" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_families_project_id_id_idx" ON "asset_families" ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_families_identity_name_idx" ON "asset_families" ("subject_identity_id",lower("name"));--> statement-breakpoint
CREATE INDEX "asset_families_project_visual_world_idx" ON "asset_families" ("project_id","visual_world_id");--> statement-breakpoint
CREATE INDEX "asset_families_created_by_user_id_idx" ON "asset_families" ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_family_relationships_unique_link_idx" ON "asset_family_relationships" ("asset_family_id","source_asset_record_id","target_asset_record_id","type");--> statement-breakpoint
CREATE INDEX "asset_family_relationships_project_family_idx" ON "asset_family_relationships" ("project_id","asset_family_id");--> statement-breakpoint
CREATE INDEX "asset_family_relationships_created_by_user_id_idx" ON "asset_family_relationships" ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_records_project_family_id_idx" ON "asset_records" ("project_id","asset_family_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_records_family_name_idx" ON "asset_records" ("asset_family_id",lower("name"));--> statement-breakpoint
CREATE INDEX "asset_records_created_by_user_id_idx" ON "asset_records" ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subject_identities_project_id_id_idx" ON "subject_identities" ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "subject_identities_project_name_idx" ON "subject_identities" ("project_id",lower("name"));--> statement-breakpoint
CREATE INDEX "subject_identities_created_by_user_id_idx" ON "subject_identities" ("created_by_user_id");--> statement-breakpoint
ALTER TABLE "asset_families" ADD CONSTRAINT "asset_families_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "asset_families" ADD CONSTRAINT "asset_families_project_subject_identity_fk" FOREIGN KEY ("project_id","subject_identity_id") REFERENCES "subject_identities"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "asset_families" ADD CONSTRAINT "asset_families_project_visual_world_fk" FOREIGN KEY ("project_id","visual_world_id") REFERENCES "visual_worlds"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "asset_family_relationships" ADD CONSTRAINT "asset_family_relationships_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "asset_family_relationships" ADD CONSTRAINT "asset_family_relationships_source_same_family_fk" FOREIGN KEY ("project_id","asset_family_id","source_asset_record_id") REFERENCES "asset_records"("project_id","asset_family_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "asset_family_relationships" ADD CONSTRAINT "asset_family_relationships_target_same_family_fk" FOREIGN KEY ("project_id","asset_family_id","target_asset_record_id") REFERENCES "asset_records"("project_id","asset_family_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_project_asset_family_fk" FOREIGN KEY ("project_id","asset_family_id") REFERENCES "asset_families"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "subject_identities" ADD CONSTRAINT "subject_identities_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "subject_identities" ADD CONSTRAINT "subject_identities_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;