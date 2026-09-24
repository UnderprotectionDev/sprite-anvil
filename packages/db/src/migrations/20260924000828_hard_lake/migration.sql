ALTER TABLE "context_revisions" ADD COLUMN "source_proposal_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "context_revisions_source_proposal_id_idx" ON "context_revisions" ("source_proposal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "context_revisions_project_active_idx" ON "context_revisions" ("project_id") WHERE "state" = 'active';