CREATE TABLE "asset_family_canonical_designs" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"asset_version_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_version_review_events" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"asset_version_id" text NOT NULL,
	"type" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_version_review_events_type_check" CHECK ("type" IN ('candidate', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "asset_versions" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"object_key" text NOT NULL UNIQUE,
	"content_type" text NOT NULL,
	"content_length" integer NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_versions_version_number_positive" CHECK ("version_number" > 0),
	CONSTRAINT "asset_versions_content_length_positive" CHECK ("content_length" > 0)
);
--> statement-breakpoint
ALTER TABLE "asset_family_relationships" ADD COLUMN "source_asset_version_id" text;--> statement-breakpoint
ALTER TABLE "asset_family_relationships" ADD COLUMN "legacy_unversioned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "asset_family_canonical_designs_current_idx" ON "asset_family_canonical_designs" ("asset_family_id","created_at");--> statement-breakpoint
CREATE INDEX "asset_version_review_events_version_created_idx" ON "asset_version_review_events" ("asset_version_id","created_at");--> statement-breakpoint
CREATE INDEX "asset_version_review_events_project_idx" ON "asset_version_review_events" ("project_id","asset_family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_versions_project_family_record_id_idx" ON "asset_versions" ("project_id","asset_family_id","asset_record_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_versions_record_version_number_idx" ON "asset_versions" ("asset_record_id","version_number");--> statement-breakpoint
CREATE INDEX "asset_versions_project_record_idx" ON "asset_versions" ("project_id","asset_record_id");--> statement-breakpoint
CREATE INDEX "asset_versions_created_by_user_id_idx" ON "asset_versions" ("created_by_user_id");--> statement-breakpoint
ALTER TABLE "asset_family_canonical_designs" ADD CONSTRAINT "asset_family_canonical_designs_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "asset_family_canonical_designs" ADD CONSTRAINT "asset_family_canonical_designs_family_fk" FOREIGN KEY ("project_id","asset_family_id") REFERENCES "asset_families"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "asset_family_canonical_designs" ADD CONSTRAINT "asset_family_canonical_designs_version_fk" FOREIGN KEY ("project_id","asset_family_id","asset_record_id","asset_version_id") REFERENCES "asset_versions"("project_id","asset_family_id","asset_record_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "asset_family_relationships" ADD CONSTRAINT "asset_family_relationships_source_version_fk" FOREIGN KEY ("project_id","asset_family_id","source_asset_record_id","source_asset_version_id") REFERENCES "asset_versions"("project_id","asset_family_id","asset_record_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "asset_version_review_events" ADD CONSTRAINT "asset_version_review_events_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "asset_version_review_events" ADD CONSTRAINT "asset_version_review_events_version_fk" FOREIGN KEY ("project_id","asset_family_id","asset_record_id","asset_version_id") REFERENCES "asset_versions"("project_id","asset_family_id","asset_record_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_project_family_record_fk" FOREIGN KEY ("project_id","asset_family_id","asset_record_id") REFERENCES "asset_records"("project_id","asset_family_id","id") ON DELETE CASCADE;--> statement-breakpoint
UPDATE "asset_family_relationships" SET "legacy_unversioned" = true WHERE "type" = 'derivative' AND "source_asset_version_id" IS NULL;--> statement-breakpoint
ALTER TABLE "asset_family_relationships" ADD CONSTRAINT "asset_family_relationships_derivative_version_check" CHECK (("type" = 'derivative' AND "source_asset_version_id" IS NOT NULL AND "legacy_unversioned" = false) OR ("type" = 'derivative' AND "source_asset_version_id" IS NULL AND "legacy_unversioned" = true) OR ("type" <> 'derivative' AND "source_asset_version_id" IS NULL AND "legacy_unversioned" = false));
