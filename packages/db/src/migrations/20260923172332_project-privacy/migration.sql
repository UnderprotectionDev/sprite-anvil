CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project" (
	"id" text PRIMARY KEY,
	"owner_user_id" text NOT NULL,
	"name" text NOT NULL,
	"preview_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'project'
			AND column_name = 'owner_id'
	) AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'project'
			AND column_name = 'owner_user_id'
	) THEN
		ALTER TABLE "project" RENAME COLUMN "owner_id" TO "owner_user_id";
	END IF;

	IF to_regclass('public."project_ownerId_idx"') IS NOT NULL
		AND to_regclass('public."project_ownerUserId_idx"') IS NULL THEN
		ALTER INDEX "project_ownerId_idx" RENAME TO "project_ownerUserId_idx";
	END IF;

	IF EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'project_owner_id_user_id_fkey'
			AND conrelid = 'public.project'::regclass
	) AND NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'project_owner_user_id_user_id_fkey'
			AND conrelid = 'public.project'::regclass
	) THEN
		ALTER TABLE "project"
			RENAME CONSTRAINT "project_owner_id_user_id_fkey"
			TO "project_owner_user_id_user_id_fkey";
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_ownerUserId_idx" ON "project" ("owner_user_id");
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'account_user_id_user_id_fkey'
			AND conrelid = 'public.account'::regclass
	) THEN
		ALTER TABLE "account"
			ADD CONSTRAINT "account_user_id_user_id_fkey"
			FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'session_user_id_user_id_fkey'
			AND conrelid = 'public.session'::regclass
	) THEN
		ALTER TABLE "session"
			ADD CONSTRAINT "session_user_id_user_id_fkey"
			FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'project_owner_user_id_user_id_fkey'
			AND conrelid = 'public.project'::regclass
	) THEN
		ALTER TABLE "project"
			ADD CONSTRAINT "project_owner_user_id_user_id_fkey"
			FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE CASCADE;
	END IF;
END $$;
