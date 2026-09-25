CREATE TABLE IF NOT EXISTS "subject_identities" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subject_identities_project_id_id_idx" ON "subject_identities" ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subject_identities_project_name_idx" ON "subject_identities" ("project_id",lower("name"));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subject_identities_created_by_user_id_idx" ON "subject_identities" ("created_by_user_id");--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'subject_identities_project_id_project_id_fkey'
			AND conrelid = 'public.subject_identities'::regclass
	) THEN
		ALTER TABLE "subject_identities"
			ADD CONSTRAINT "subject_identities_project_id_project_id_fkey"
			FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'subject_identities_created_by_user_id_user_id_fkey'
			AND conrelid = 'public.subject_identities'::regclass
	) THEN
		ALTER TABLE "subject_identities"
			ADD CONSTRAINT "subject_identities_created_by_user_id_user_id_fkey"
			FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;
	END IF;
END $$;
