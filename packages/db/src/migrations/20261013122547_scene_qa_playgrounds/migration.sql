CREATE TABLE "scene_qa_playgrounds" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "scene_qa_playgrounds_project_idx" ON "scene_qa_playgrounds" ("project_id","created_at");--> statement-breakpoint
ALTER TABLE "scene_qa_playgrounds" ADD CONSTRAINT "scene_qa_playgrounds_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scene_qa_playgrounds" ADD CONSTRAINT "scene_qa_playgrounds_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;