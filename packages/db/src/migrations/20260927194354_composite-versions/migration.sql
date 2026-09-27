CREATE TABLE "composite_version_review_events" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"composite_version_id" text NOT NULL,
	"decision" text NOT NULL,
	"rationale" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "composite_version_reviews_decision_check" CHECK ("decision" IN ('candidate', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "composite_versions" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "composite_versions_version_number_check" CHECK ("version_number" > 0),
	CONSTRAINT "composite_versions_idempotency_key_check" CHECK ("idempotency_key" = btrim("idempotency_key") AND char_length("idempotency_key") BETWEEN 1 AND 128)
);
--> statement-breakpoint
CREATE TABLE "composition_memberships" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"composite_version_id" text NOT NULL,
	"unit_version_id" text NOT NULL,
	"unit_type" text NOT NULL,
	"unit_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "composition_memberships_type_check" CHECK ("unit_type" IN ('frame', 'direction', 'tile', 'state')),
	CONSTRAINT "composition_memberships_key_check" CHECK ("unit_key" = btrim("unit_key") AND char_length("unit_key") BETWEEN 1 AND 120)
);
--> statement-breakpoint
CREATE INDEX "composite_version_reviews_record_created_idx" ON "composite_version_review_events" ("asset_record_id", "created_at");--> statement-breakpoint
CREATE INDEX "composite_version_reviews_composite_created_idx" ON "composite_version_review_events" ("project_id", "composite_version_id", "created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "composite_versions_project_id_record_id_idx" ON "composite_versions" ("project_id", "id", "asset_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "composite_versions_record_number_idx" ON "composite_versions" ("project_id", "asset_record_id", "version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "composite_versions_idempotency_key_idx" ON "composite_versions" ("project_id", "asset_record_id", "idempotency_key");--> statement-breakpoint
CREATE INDEX "composite_versions_record_created_at_idx" ON "composite_versions" ("project_id", "asset_record_id", "created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "composition_memberships_slot_idx" ON "composition_memberships" ("project_id", "composite_version_id", "unit_type", "unit_key");--> statement-breakpoint
CREATE UNIQUE INDEX "composition_memberships_unit_idx" ON "composition_memberships" ("project_id", "composite_version_id", "unit_version_id");--> statement-breakpoint
CREATE INDEX "composition_memberships_unit_version_idx" ON "composition_memberships" ("project_id", "unit_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_versions_project_id_record_type_key_idx" ON "unit_versions" ("project_id", "id", "asset_record_id", "unit_type", "unit_key");--> statement-breakpoint
ALTER TABLE "composite_version_review_events" ADD CONSTRAINT "composite_version_review_events_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "composite_version_review_events" ADD CONSTRAINT "composite_version_reviews_project_composite_fk" FOREIGN KEY ("project_id", "composite_version_id", "asset_record_id") REFERENCES "composite_versions"("project_id", "id", "asset_record_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "composite_versions" ADD CONSTRAINT "composite_versions_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "composite_versions" ADD CONSTRAINT "composite_versions_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "composite_versions" ADD CONSTRAINT "composite_versions_project_record_fk" FOREIGN KEY ("project_id", "asset_record_id") REFERENCES "asset_records"("project_id", "id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "composition_memberships" ADD CONSTRAINT "composition_memberships_project_composite_fk" FOREIGN KEY ("project_id", "composite_version_id", "asset_record_id") REFERENCES "composite_versions"("project_id", "id", "asset_record_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "composition_memberships" ADD CONSTRAINT "composition_memberships_project_unit_fk" FOREIGN KEY ("project_id", "unit_version_id", "asset_record_id", "unit_type", "unit_key") REFERENCES "unit_versions"("project_id", "id", "asset_record_id", "unit_type", "unit_key") ON DELETE RESTRICT;
