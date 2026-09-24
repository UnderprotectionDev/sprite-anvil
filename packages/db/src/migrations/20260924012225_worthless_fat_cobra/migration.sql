CREATE TABLE "themes" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"visual_world_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visual_worlds" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "themes_visual_world_name_idx" ON "themes" ("visual_world_id",lower("name"));--> statement-breakpoint
CREATE INDEX "themes_created_by_user_id_idx" ON "themes" ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "visual_worlds_project_id_id_idx" ON "visual_worlds" ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "visual_worlds_project_name_idx" ON "visual_worlds" ("project_id",lower("name"));--> statement-breakpoint
CREATE INDEX "visual_worlds_created_by_user_id_idx" ON "visual_worlds" ("created_by_user_id");--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_project_visual_world_fk" FOREIGN KEY ("project_id","visual_world_id") REFERENCES "visual_worlds"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "visual_worlds" ADD CONSTRAINT "visual_worlds_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "visual_worlds" ADD CONSTRAINT "visual_worlds_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;