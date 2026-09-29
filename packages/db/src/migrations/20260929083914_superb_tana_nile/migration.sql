CREATE TABLE "family_readiness_evidence" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"item_id" text NOT NULL,
	"kind" text NOT NULL,
	"result" text NOT NULL,
	"asset_version_ids" jsonb NOT NULL,
	"context_revision_id" text,
	"visual_world_id" text NOT NULL,
	"use_context" text NOT NULL,
	"canonical_design_version_id" text,
	"rule_id" text,
	"method" text,
	"rationale" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "family_readiness_evidence_kind_result_check" CHECK (("kind" = 'applicability' AND "result" IN ('applicable', 'inapplicable')) OR ("kind" IN ('quality', 'usage_test') AND "result" IN ('passed', 'failed', 'inconclusive'))),
	CONSTRAINT "family_readiness_evidence_payload_check" CHECK (("kind" = 'quality' AND "rule_id" IS NOT NULL AND "method" IS NOT NULL) OR ("kind" <> 'quality' AND "rule_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "family_required_set_activations" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"activated_by_user_id" text NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_required_set_heads" (
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"active_revision_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_required_set_revisions" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"items" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "family_readiness_evidence_item_created_idx" ON "family_readiness_evidence" ("project_id","asset_family_id","revision_id","item_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "family_required_set_activations_family_revision_idx" ON "family_required_set_activations" ("project_id","asset_family_id","revision_id","activated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "family_required_set_heads_family_idx" ON "family_required_set_heads" ("project_id","asset_family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "family_required_set_revisions_project_family_id_idx" ON "family_required_set_revisions" ("project_id","asset_family_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "family_required_set_revisions_family_number_idx" ON "family_required_set_revisions" ("project_id","asset_family_id","revision_number");--> statement-breakpoint
CREATE INDEX "family_required_set_revisions_family_created_idx" ON "family_required_set_revisions" ("asset_family_id","created_at");--> statement-breakpoint
ALTER TABLE "family_readiness_evidence" ADD CONSTRAINT "family_readiness_evidence_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "family_readiness_evidence" ADD CONSTRAINT "family_readiness_evidence_revision_fk" FOREIGN KEY ("project_id","asset_family_id","revision_id") REFERENCES "family_required_set_revisions"("project_id","asset_family_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "family_readiness_evidence" ADD CONSTRAINT "family_readiness_evidence_context_revision_fk" FOREIGN KEY ("project_id","context_revision_id") REFERENCES "context_revisions"("project_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "family_readiness_evidence" ADD CONSTRAINT "family_readiness_evidence_canonical_version_fk" FOREIGN KEY ("project_id","asset_family_id","canonical_design_version_id") REFERENCES "asset_versions"("project_id","asset_family_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "family_required_set_activations" ADD CONSTRAINT "family_required_set_activations_07o33B0Eyf6l_fkey" FOREIGN KEY ("activated_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "family_required_set_activations" ADD CONSTRAINT "family_required_set_activations_revision_fk" FOREIGN KEY ("project_id","asset_family_id","revision_id") REFERENCES "family_required_set_revisions"("project_id","asset_family_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "family_required_set_heads" ADD CONSTRAINT "family_required_set_heads_family_fk" FOREIGN KEY ("project_id","asset_family_id") REFERENCES "asset_families"("project_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "family_required_set_heads" ADD CONSTRAINT "family_required_set_heads_active_revision_fk" FOREIGN KEY ("project_id","asset_family_id","active_revision_id") REFERENCES "family_required_set_revisions"("project_id","asset_family_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "family_required_set_revisions" ADD CONSTRAINT "family_required_set_revisions_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "family_required_set_revisions" ADD CONSTRAINT "family_required_set_revisions_family_fk" FOREIGN KEY ("project_id","asset_family_id") REFERENCES "asset_families"("project_id","id") ON DELETE RESTRICT;