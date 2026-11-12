CREATE TABLE "delivery_fulfilment_draft_requirements" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"draft_id" text NOT NULL,
	"position" integer NOT NULL,
	"asset_family_id" text NOT NULL,
	"asset_family_name" text NOT NULL,
	"item_id" text NOT NULL,
	"item_kind" text NOT NULL,
	"item_name" text NOT NULL,
	"required_set_revision_id" text NOT NULL,
	"status" text NOT NULL,
	"proposed_bundle_id" text,
	"candidates" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_fulfilment_drafts" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"delivery_target_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"bundle_checks" jsonb NOT NULL,
	"request_digest" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_fulfilment_drafts_revision_number_check" CHECK ("revision_number" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_fulfilment_draft_requirements_item_idx" ON "delivery_fulfilment_draft_requirements" ("draft_id","asset_family_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_fulfilment_draft_requirements_position_idx" ON "delivery_fulfilment_draft_requirements" ("draft_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_fulfilment_drafts_project_id_id_idx" ON "delivery_fulfilment_drafts" ("project_id","id");--> statement-breakpoint
ALTER TABLE "delivery_fulfilment_draft_requirements" ADD CONSTRAINT "delivery_fulfilment_draft_requirements_draft_fk" FOREIGN KEY ("project_id","draft_id") REFERENCES "delivery_fulfilment_drafts"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_fulfilment_drafts" ADD CONSTRAINT "delivery_fulfilment_drafts_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_fulfilment_drafts" ADD CONSTRAINT "delivery_fulfilment_drafts_Q5S1tNJcXKJE_fkey" FOREIGN KEY ("revision_id") REFERENCES "delivery_target_revisions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_fulfilment_drafts" ADD CONSTRAINT "delivery_fulfilment_drafts_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;