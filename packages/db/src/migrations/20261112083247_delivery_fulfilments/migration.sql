CREATE TABLE "delivery_fulfilment_requirements" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"fulfilment_id" text NOT NULL,
	"position" integer NOT NULL,
	"asset_family_id" text NOT NULL,
	"asset_family_name" text NOT NULL,
	"item_id" text NOT NULL,
	"item_kind" text NOT NULL,
	"item_name" text NOT NULL,
	"required_set_revision_id" text NOT NULL,
	"bundle_id" text NOT NULL,
	"manifest_digest" text NOT NULL,
	"asset_version_ids" jsonb NOT NULL,
	"resolution" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_fulfilments" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"delivery_target_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"draft_id" text NOT NULL,
	"request_digest" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_fulfilments_revision_number_check" CHECK ("revision_number" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_fulfilment_requirements_item_idx" ON "delivery_fulfilment_requirements" ("fulfilment_id","asset_family_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_fulfilment_requirements_position_idx" ON "delivery_fulfilment_requirements" ("fulfilment_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_fulfilments_project_id_id_idx" ON "delivery_fulfilments" ("project_id","id");--> statement-breakpoint
CREATE INDEX "delivery_fulfilments_target_idx" ON "delivery_fulfilments" ("project_id","delivery_target_id");--> statement-breakpoint
CREATE INDEX "delivery_fulfilments_revision_idx" ON "delivery_fulfilments" ("project_id","revision_id");--> statement-breakpoint
ALTER TABLE "delivery_fulfilment_requirements" ADD CONSTRAINT "delivery_fulfilment_requirements_fulfilment_fk" FOREIGN KEY ("project_id","fulfilment_id") REFERENCES "delivery_fulfilments"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_fulfilments" ADD CONSTRAINT "delivery_fulfilments_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_fulfilments" ADD CONSTRAINT "delivery_fulfilments_IiUoj169y7p0_fkey" FOREIGN KEY ("revision_id") REFERENCES "delivery_target_revisions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_fulfilments" ADD CONSTRAINT "delivery_fulfilments_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;