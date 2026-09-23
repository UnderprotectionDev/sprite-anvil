DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'project'
			AND column_name = 'owner_id'
	) AND NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'project'
			AND column_name = 'owner_user_id'
	) THEN
		ALTER TABLE "project" RENAME COLUMN "owner_id" TO "owner_user_id";
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF to_regclass('public."project_ownerId_idx"') IS NOT NULL
		AND to_regclass('public."project_ownerUserId_idx"') IS NULL THEN
		ALTER INDEX "project_ownerId_idx" RENAME TO "project_ownerUserId_idx";
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'project_owner_id_user_id_fkey'
			AND conrelid = 'public.project'::regclass
	) AND NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'project_owner_user_id_user_id_fkey'
			AND conrelid = 'public.project'::regclass
	) THEN
		ALTER TABLE "project"
			RENAME CONSTRAINT "project_owner_id_user_id_fkey"
			TO "project_owner_user_id_user_id_fkey";
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "preview_key" text;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_type AS type
		INNER JOIN pg_namespace AS namespace ON namespace.oid = type.typnamespace
		WHERE namespace.nspname = 'public'
			AND type.typname = 'tool_access_principal'
	) THEN
		CREATE TYPE "tool_access_principal" AS ENUM (
			'context_agent',
			'external_connection'
		);
	END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tool_access_permission" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"principal" "tool_access_principal" NOT NULL,
	"purpose" text NOT NULL,
	"scopes" text[] NOT NULL,
	"granted_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_access_permission_project_idx"
	ON "tool_access_permission" ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_access_permission_project_principal_idx"
	ON "tool_access_permission" ("project_id", "principal");
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'tool_access_permission_project_id_project_id_fkey'
			AND conrelid = 'public.tool_access_permission'::regclass
	) THEN
		ALTER TABLE "tool_access_permission"
			ADD CONSTRAINT "tool_access_permission_project_id_project_id_fkey"
			FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'tool_access_permission_granted_by_user_id_user_id_fkey'
			AND conrelid = 'public.tool_access_permission'::regclass
	) THEN
		ALTER TABLE "tool_access_permission"
			ADD CONSTRAINT "tool_access_permission_granted_by_user_id_user_id_fkey"
			FOREIGN KEY ("granted_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;
	END IF;
END $$;
