CREATE TABLE "context_proposals" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"base_context_revision_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"contract_version" text NOT NULL,
	"source_kind" text NOT NULL,
	"proposal" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_revisions" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"state" text NOT NULL,
	"contract_version" text NOT NULL,
	"rules" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "general_art_direction" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "context_proposals_project_created_at_idx" ON "context_proposals" ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "context_proposals_created_by_user_id_idx" ON "context_proposals" ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "context_revisions_project_id_id_idx" ON "context_revisions" ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "context_revisions_project_revision_number_idx" ON "context_revisions" ("project_id","revision_number");--> statement-breakpoint
ALTER TABLE "context_proposals" ADD CONSTRAINT "context_proposals_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "context_proposals" ADD CONSTRAINT "context_proposals_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "context_proposals" ADD CONSTRAINT "context_proposals_project_revision_fk" FOREIGN KEY ("project_id","base_context_revision_id") REFERENCES "context_revisions"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "context_revisions" ADD CONSTRAINT "context_revisions_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "context_revisions" ADD CONSTRAINT "context_revisions_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;
--> statement-breakpoint
INSERT INTO "context_revisions" (
	"id",
	"project_id",
	"revision_number",
	"state",
	"contract_version",
	"rules",
	"created_by_user_id"
)
SELECT
	gen_random_uuid()::text,
	"project"."id",
	0,
	'baseline',
	'context-rule/1.0.0',
	'[]'::jsonb,
	"project"."owner_user_id"
FROM "project"
ON CONFLICT ("project_id", "revision_number") DO NOTHING;
