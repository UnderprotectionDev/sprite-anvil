CREATE TABLE "delivery_target_draft_families" (
	"draft_id" text,
	"project_id" text NOT NULL,
	"asset_family_id" text,
	"required_set_revision_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "delivery_target_draft_families_pk" PRIMARY KEY("draft_id","asset_family_id")
);
--> statement-breakpoint
CREATE TABLE "delivery_target_drafts" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"delivery_target_id" text NOT NULL,
	"context_revision_id" text NOT NULL,
	"production_evidence_policy" jsonb NOT NULL,
	"rights_evidence_policy" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_target_revisions" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"delivery_target_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"draft_id" text NOT NULL,
	"activated_by_user_id" text NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_target_revisions_number_check" CHECK ("revision_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "delivery_targets" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"purpose" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_targets_purpose_check" CHECK ("purpose" in ('demo', 'chapter', 'update', 'other'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_target_draft_families_position_idx" ON "delivery_target_draft_families" ("draft_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_target_drafts_project_id_id_idx" ON "delivery_target_drafts" ("project_id","id");--> statement-breakpoint
CREATE INDEX "delivery_target_drafts_target_created_idx" ON "delivery_target_drafts" ("delivery_target_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_target_revisions_draft_idx" ON "delivery_target_revisions" ("draft_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_target_revisions_target_number_idx" ON "delivery_target_revisions" ("delivery_target_id","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_targets_project_id_id_idx" ON "delivery_targets" ("project_id","id");--> statement-breakpoint
ALTER TABLE "delivery_target_draft_families" ADD CONSTRAINT "delivery_target_draft_families_draft_fk" FOREIGN KEY ("project_id","draft_id") REFERENCES "delivery_target_drafts"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_target_draft_families" ADD CONSTRAINT "delivery_target_draft_families_required_set_fk" FOREIGN KEY ("project_id","asset_family_id","required_set_revision_id") REFERENCES "family_required_set_revisions"("project_id","asset_family_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_target_drafts" ADD CONSTRAINT "delivery_target_drafts_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_target_drafts" ADD CONSTRAINT "delivery_target_drafts_target_fk" FOREIGN KEY ("project_id","delivery_target_id") REFERENCES "delivery_targets"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_target_drafts" ADD CONSTRAINT "delivery_target_drafts_context_revision_fk" FOREIGN KEY ("project_id","context_revision_id") REFERENCES "context_revisions"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_target_revisions" ADD CONSTRAINT "delivery_target_revisions_activated_by_user_id_user_id_fkey" FOREIGN KEY ("activated_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_target_revisions" ADD CONSTRAINT "delivery_target_revisions_target_fk" FOREIGN KEY ("project_id","delivery_target_id") REFERENCES "delivery_targets"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_target_revisions" ADD CONSTRAINT "delivery_target_revisions_draft_fk" FOREIGN KEY ("project_id","draft_id") REFERENCES "delivery_target_drafts"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_targets" ADD CONSTRAINT "delivery_targets_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_targets" ADD CONSTRAINT "delivery_targets_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;