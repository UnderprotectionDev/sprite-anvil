CREATE TABLE "asset_record_reference_history" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"reference_id" text NOT NULL,
	"revision" integer NOT NULL,
	"role" text NOT NULL,
	"custom_purpose" text,
	"transferred_features" text[] NOT NULL,
	"forbidden_features" text[] NOT NULL,
	"context_override_rationale" text,
	"notes" text,
	"recorded_by_user_id" text NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_record_reference_history_revision_check" CHECK ("revision" > 0),
	CONSTRAINT "asset_record_reference_history_role_check" CHECK ("role" IN ('identity', 'pose', 'style', 'palette', 'equipment', 'composition', 'theme', 'avoid', 'custom')),
	CONSTRAINT "asset_record_reference_history_features_check" CHECK (cardinality("transferred_features") + cardinality("forbidden_features") >= 1),
	CONSTRAINT "asset_record_reference_history_identity_override_check" CHECK ("context_override_rationale" IS NULL OR ('identity' = ANY("transferred_features") AND NOT ('identity' = ANY("forbidden_features")) AND length(trim("context_override_rationale")) > 0))
);
--> statement-breakpoint
CREATE TABLE "reference_board_image_history" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"reference_id" text NOT NULL,
	"revision" integer NOT NULL,
	"role" text NOT NULL,
	"custom_purpose" text,
	"transferred_features" text[] NOT NULL,
	"forbidden_features" text[] NOT NULL,
	"context_override_rationale" text,
	"notes" text,
	"recorded_by_user_id" text NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reference_board_image_history_custom_purpose_check" CHECK (("role" = 'custom' AND "custom_purpose" IS NOT NULL AND length(trim("custom_purpose")) > 0) OR ("role" <> 'custom' AND "custom_purpose" IS NULL)),
	CONSTRAINT "reference_board_image_history_role_check" CHECK ("role" IN ('identity', 'pose', 'style', 'palette', 'equipment', 'composition', 'theme', 'avoid', 'custom')),
	CONSTRAINT "reference_board_image_history_revision_check" CHECK ("revision" > 0),
	CONSTRAINT "reference_board_image_history_features_check" CHECK (cardinality("transferred_features") + cardinality("forbidden_features") >= 1),
	CONSTRAINT "reference_board_image_history_identity_override_check" CHECK ("context_override_rationale" IS NULL OR ('identity' = ANY("transferred_features") AND NOT ('identity' = ANY("forbidden_features")) AND length(trim("context_override_rationale")) > 0))
);
--> statement-breakpoint
CREATE TABLE "reference_board_images" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"content_length" integer NOT NULL,
	"sha256" text NOT NULL,
	"role" text NOT NULL,
	"custom_purpose" text,
	"transferred_features" text[] NOT NULL,
	"forbidden_features" text[] NOT NULL,
	"context_override_rationale" text,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reference_board_images_role_check" CHECK ("role" IN ('identity', 'pose', 'style', 'palette', 'equipment', 'composition', 'theme', 'avoid', 'custom')),
	CONSTRAINT "reference_board_images_custom_purpose_check" CHECK (("role" = 'custom' AND "custom_purpose" IS NOT NULL AND length(trim("custom_purpose")) > 0) OR ("role" <> 'custom' AND "custom_purpose" IS NULL)),
	CONSTRAINT "reference_board_images_features_nonempty_check" CHECK (cardinality("transferred_features") + cardinality("forbidden_features") >= 1),
	CONSTRAINT "reference_board_images_revision_check" CHECK ("revision" > 0),
	CONSTRAINT "reference_board_images_content_check" CHECK ("content_type" IN ('image/png', 'image/webp') AND "content_length" > 0 AND "content_length" <= 5242880 AND "sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "reference_board_images_identity_override_check" CHECK ("context_override_rationale" IS NULL OR ('identity' = ANY("transferred_features") AND NOT ('identity' = ANY("forbidden_features")) AND length(trim("context_override_rationale")) > 0))
);
--> statement-breakpoint
ALTER TABLE "asset_record_references" DROP CONSTRAINT "asset_record_references_features_disjoint_check";--> statement-breakpoint
ALTER TABLE "asset_record_references" ADD COLUMN "custom_purpose" text;--> statement-breakpoint
ALTER TABLE "asset_record_references" ADD COLUMN "context_override_rationale" text;--> statement-breakpoint
ALTER TABLE "asset_record_references" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_record_references" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
INSERT INTO "asset_record_reference_history" (
	"id",
	"project_id",
	"asset_record_id",
	"reference_id",
	"revision",
	"role",
	"custom_purpose",
	"transferred_features",
	"forbidden_features",
	"context_override_rationale",
	"notes",
	"recorded_by_user_id",
	"recorded_at"
)
SELECT
	"id" || ':1',
	"project_id",
	"asset_record_id",
	"id",
	1,
	"role",
	"custom_purpose",
	"transferred_features",
	"forbidden_features",
	"context_override_rationale",
	"notes",
	"created_by_user_id",
	"created_at"
FROM "asset_record_references"
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Older custom references were created before custom_purpose existed. Keep their snapshot readable while enforcing the check for future writes.
ALTER TABLE "asset_record_reference_history" ADD CONSTRAINT "asset_record_reference_history_custom_purpose_check" CHECK (("role" = 'custom' AND "custom_purpose" IS NOT NULL AND length(trim("custom_purpose")) > 0) OR ("role" <> 'custom' AND "custom_purpose" IS NULL)) NOT VALID;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_record_reference_history_revision_idx" ON "asset_record_reference_history" ("reference_id","revision");--> statement-breakpoint
CREATE INDEX "asset_record_reference_history_record_idx" ON "asset_record_reference_history" ("project_id","asset_record_id","reference_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_record_references_project_asset_id_idx" ON "asset_record_references" ("project_id","asset_record_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "reference_board_image_history_revision_idx" ON "reference_board_image_history" ("reference_id","revision");--> statement-breakpoint
CREATE INDEX "reference_board_image_history_recorded_idx" ON "reference_board_image_history" ("reference_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reference_board_images_project_asset_id_idx" ON "reference_board_images" ("project_id","asset_record_id","id");--> statement-breakpoint
CREATE INDEX "reference_board_images_record_created_idx" ON "reference_board_images" ("project_id","asset_record_id","sort_order","created_at");--> statement-breakpoint
ALTER TABLE "asset_record_reference_history" ADD CONSTRAINT "asset_record_reference_history_recorded_by_user_id_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_record_reference_history" ADD CONSTRAINT "asset_record_reference_history_record_fk" FOREIGN KEY ("project_id","asset_record_id") REFERENCES "asset_records"("project_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_record_reference_history" ADD CONSTRAINT "asset_record_reference_history_reference_fk" FOREIGN KEY ("project_id","asset_record_id","reference_id") REFERENCES "asset_record_references"("project_id","asset_record_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "reference_board_image_history" ADD CONSTRAINT "reference_board_image_history_recorded_by_user_id_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "reference_board_image_history" ADD CONSTRAINT "reference_board_image_history_reference_fk" FOREIGN KEY ("project_id","asset_record_id","reference_id") REFERENCES "reference_board_images"("project_id","asset_record_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "reference_board_images" ADD CONSTRAINT "reference_board_images_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "reference_board_images" ADD CONSTRAINT "reference_board_images_record_fk" FOREIGN KEY ("project_id","asset_record_id") REFERENCES "asset_records"("project_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_record_references" ADD CONSTRAINT "asset_record_references_revision_check" CHECK ("revision" > 0);--> statement-breakpoint
-- Keep pre-existing custom roles without a purpose, but enforce one on every new or changed row.
ALTER TABLE "asset_record_references" ADD CONSTRAINT "asset_record_references_custom_purpose_check" CHECK (("role" = 'custom' AND "custom_purpose" IS NOT NULL AND length(trim("custom_purpose")) > 0) OR ("role" <> 'custom' AND "custom_purpose" IS NULL)) NOT VALID;--> statement-breakpoint
ALTER TABLE "asset_record_references" ADD CONSTRAINT "asset_record_references_identity_override_check" CHECK ("context_override_rationale" IS NULL OR ('identity' = ANY("transferred_features") AND NOT ('identity' = ANY("forbidden_features")) AND length(trim("context_override_rationale")) > 0));--> statement-breakpoint
ALTER TABLE "asset_record_references" DROP CONSTRAINT "asset_record_references_role_check", ADD CONSTRAINT "asset_record_references_role_check" CHECK ("role" IN ('identity', 'pose', 'style', 'palette', 'equipment', 'composition', 'theme', 'avoid', 'custom'));
