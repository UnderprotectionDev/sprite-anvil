-- Bring both the Asset Record tracking schema and earlier Asset Family installs
-- to the merged shape without discarding their existing records.
ALTER TABLE "asset_records"
	ADD COLUMN IF NOT EXISTS "identity_criteria" text[],
	ADD COLUMN IF NOT EXISTS "support_level" text DEFAULT 'general' NOT NULL,
	ADD COLUMN IF NOT EXISTS "availability" text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "asset_records" ALTER COLUMN "asset_family_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "asset_families"
	ADD COLUMN IF NOT EXISTS "canonical_version_id" text,
	ADD COLUMN IF NOT EXISTS "subject_identity_id" text;
--> statement-breakpoint
ALTER TABLE "asset_families" ALTER COLUMN "subject_identity_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "asset_versions"
	ADD COLUMN IF NOT EXISTS "asset_family_id" text,
	ADD COLUMN IF NOT EXISTS "file_name" text,
	ADD COLUMN IF NOT EXISTS "sha256" text,
	ADD COLUMN IF NOT EXISTS "byte_size" integer,
	ADD COLUMN IF NOT EXISTS "content_digest" text,
	ADD COLUMN IF NOT EXISTS "integrity_verified" boolean DEFAULT false NOT NULL,
	ADD COLUMN IF NOT EXISTS "idempotency_key" text DEFAULT 'legacy:' || gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "asset_versions"
	ALTER COLUMN "asset_family_id" DROP NOT NULL,
	ALTER COLUMN "file_name" DROP NOT NULL,
	ALTER COLUMN "sha256" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "asset_version_review_events"
	ADD COLUMN IF NOT EXISTS "rationale" text;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'asset_versions'
			AND column_name = 'content_length'
	) THEN
		UPDATE "asset_versions"
		SET "byte_size" = "content_length"
		WHERE "byte_size" IS NULL;
	END IF;
	UPDATE "asset_versions"
	SET "sha256" = "content_digest"
	WHERE "sha256" IS NULL AND "content_digest" IS NOT NULL;
	UPDATE "asset_versions"
	SET "integrity_verified" = false
	WHERE "integrity_verified" = true AND "content_digest" IS NULL;
	UPDATE "asset_versions" AS version
	SET "asset_family_id" = record."asset_family_id"
	FROM "asset_records" AS record
	WHERE version."project_id" = record."project_id"
		AND version."asset_record_id" = record."id"
		AND version."asset_family_id" IS NULL
		AND record."asset_family_id" IS NOT NULL;
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'asset_version_review_events'
			AND column_name = 'asset_version_id'
	) AND NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'asset_version_review_events'
			AND column_name = 'version_id'
	) THEN
		ALTER TABLE "asset_version_review_events"
			RENAME COLUMN "asset_version_id" TO "version_id";
	END IF;
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'asset_version_review_events'
			AND column_name = 'type'
	) AND NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'asset_version_review_events'
			AND column_name = 'decision'
	) THEN
		ALTER TABLE "asset_version_review_events"
			RENAME COLUMN "type" TO "decision";
	END IF;
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'asset_version_review_events'
			AND column_name = 'asset_family_id'
	) THEN
		ALTER TABLE "asset_version_review_events" ALTER COLUMN "asset_family_id" DROP NOT NULL;
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "asset_versions" ALTER COLUMN "byte_size" SET NOT NULL;
--> statement-breakpoint

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_records_identity_criteria_nonempty_check' AND conrelid = 'public.asset_records'::regclass) THEN
		ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_identity_criteria_nonempty_check" CHECK ("identity_criteria" IS NULL OR cardinality("identity_criteria") >= 1);
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_records_availability_check' AND conrelid = 'public.asset_records'::regclass) THEN
		ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_availability_check" CHECK ("availability" IN ('active', 'archived', 'erased'));
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_versions_content_type_check' AND conrelid = 'public.asset_versions'::regclass) THEN
		ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_content_type_check" CHECK ("content_type" IN ('image/png', 'image/webp'));
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_versions_sha256_check' AND conrelid = 'public.asset_versions'::regclass) THEN
		ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_sha256_check" CHECK ("sha256" IS NULL OR "sha256" ~ '^[a-f0-9]{64}$');
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_versions_byte_size_check' AND conrelid = 'public.asset_versions'::regclass) THEN
		ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_byte_size_check" CHECK ("byte_size" > 0);
	END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_records_project_id_id_idx" ON "asset_records" ("project_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_records_project_id_family_idx" ON "asset_records" ("project_id", "id", "asset_family_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_records_project_family_record_idx" ON "asset_records" ("project_id", "asset_family_id", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_records_project_created_at_idx" ON "asset_records" ("project_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_records_created_by_user_id_idx" ON "asset_records" ("created_by_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_families_project_id_id_idx" ON "asset_families" ("project_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_families_project_version_idx" ON "asset_families" ("project_id", "id", "canonical_version_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_families_project_visual_world_idx" ON "asset_families" ("project_id", "visual_world_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_families_created_by_user_id_idx" ON "asset_families" ("created_by_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_versions_project_id_id_idx" ON "asset_versions" ("project_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_versions_record_number_idx" ON "asset_versions" ("project_id", "asset_record_id", "version_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_versions_project_record_id_idx" ON "asset_versions" ("project_id", "id", "asset_record_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_versions_record_created_at_idx" ON "asset_versions" ("asset_record_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_versions_created_by_user_id_idx" ON "asset_versions" ("created_by_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_version_reviews_record_created_idx" ON "asset_version_review_events" ("asset_record_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_version_reviews_version_created_idx" ON "asset_version_review_events" ("version_id", "created_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "asset_record_derivatives" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"canonical_version_id" text NOT NULL,
	"source_asset_record_id" text NOT NULL,
	"derivative_asset_record_id" text NOT NULL,
	"dependency_facets" text[] NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_record_derivatives_distinct_records_check" CHECK ("source_asset_record_id" <> "derivative_asset_record_id"),
	CONSTRAINT "asset_record_derivatives_facets_nonempty_check" CHECK (cardinality("dependency_facets") >= 1)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_record_references" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"target_version_id" text NOT NULL,
	"role" text NOT NULL,
	"transferred_features" text[] NOT NULL,
	"forbidden_features" text[] NOT NULL,
	"notes" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_record_references_role_check" CHECK ("role" IN ('identity', 'pose', 'style', 'palette', 'equipment', 'composition', 'theme', 'custom')),
	CONSTRAINT "asset_record_references_feature_check" CHECK (cardinality("transferred_features") + cardinality("forbidden_features") >= 1),
	CONSTRAINT "asset_record_references_features_disjoint_check" CHECK (NOT ("transferred_features" && "forbidden_features"))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legacy_asset_attestations" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"version_id" text NOT NULL,
	"known_source" text,
	"user_relationship" text NOT NULL,
	"supporting_evidence" text,
	"history_unknown" boolean NOT NULL,
	"attested_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "legacy_asset_attestations_relationship_check" CHECK ("user_relationship" IN ('created_by_user', 'received_from_team', 'licensed_third_party', 'unknown')),
	CONSTRAINT "legacy_asset_attestations_unknown_history_check" CHECK ("history_unknown" = true)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_version_quality_evidence" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"version_id" text NOT NULL,
	"gate" text NOT NULL,
	"result" text NOT NULL,
	"sha256" text NOT NULL,
	"byte_size" integer NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_version_quality_evidence_gate_check" CHECK ("gate" = 'format_signature'),
	CONSTRAINT "asset_version_quality_evidence_result_check" CHECK ("result" = 'matched'),
	CONSTRAINT "asset_version_quality_evidence_sha256_check" CHECK ("sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "asset_version_quality_evidence_byte_size_check" CHECK ("byte_size" > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_record_derivatives_source_idx" ON "asset_record_derivatives" ("project_id", "source_asset_record_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_record_derivatives_target_idx" ON "asset_record_derivatives" ("project_id", "derivative_asset_record_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_record_derivatives_source_target_idx" ON "asset_record_derivatives" ("project_id", "source_asset_record_id", "derivative_asset_record_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_record_references_asset_record_created_idx" ON "asset_record_references" ("asset_record_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legacy_asset_attestations_version_created_idx" ON "legacy_asset_attestations" ("version_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_version_quality_evidence_version_created_idx" ON "asset_version_quality_evidence" ("version_id", "created_at");
--> statement-breakpoint

ALTER TABLE "asset_records" DROP CONSTRAINT IF EXISTS "asset_records_project_id_project_id_fkey";
--> statement-breakpoint
ALTER TABLE "asset_records" DROP CONSTRAINT IF EXISTS "asset_records_created_by_user_id_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "asset_records" DROP CONSTRAINT IF EXISTS "asset_records_project_asset_family_fk";
--> statement-breakpoint
ALTER TABLE "asset_families" DROP CONSTRAINT IF EXISTS "asset_families_project_id_project_id_fkey";
--> statement-breakpoint
ALTER TABLE "asset_families" DROP CONSTRAINT IF EXISTS "asset_families_created_by_user_id_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "asset_families" DROP CONSTRAINT IF EXISTS "asset_families_project_visual_world_fk";
--> statement-breakpoint
ALTER TABLE "asset_versions" DROP CONSTRAINT IF EXISTS "asset_versions_project_id_project_id_fkey";
--> statement-breakpoint
ALTER TABLE "asset_versions" DROP CONSTRAINT IF EXISTS "asset_versions_created_by_user_id_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "asset_versions" DROP CONSTRAINT IF EXISTS "asset_versions_project_record_fk";
--> statement-breakpoint
ALTER TABLE "asset_versions" DROP CONSTRAINT IF EXISTS "asset_versions_project_family_record_fk";
--> statement-breakpoint
ALTER TABLE "asset_version_review_events" DROP CONSTRAINT IF EXISTS "asset_version_review_events_version_fk";
--> statement-breakpoint
ALTER TABLE "asset_version_review_events" DROP CONSTRAINT IF EXISTS "asset_version_reviews_project_version_fk";
--> statement-breakpoint
ALTER TABLE "asset_version_review_events" DROP CONSTRAINT IF EXISTS "asset_version_reviews_project_record_fk";
--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'asset_version_review_events' AND column_name = 'asset_version_id') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'asset_version_review_events' AND column_name = 'version_id') THEN
		ALTER TABLE "asset_version_review_events" RENAME COLUMN "asset_version_id" TO "version_id";
	END IF;
	IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'asset_version_review_events' AND column_name = 'type') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'asset_version_review_events' AND column_name = 'decision') THEN
		ALTER TABLE "asset_version_review_events" RENAME COLUMN "type" TO "decision";
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_records_project_id_project_id_fkey' AND conrelid = 'public.asset_records'::regclass) THEN
		ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_records_created_by_user_id_user_id_fkey' AND conrelid = 'public.asset_records'::regclass) THEN
		ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_records_project_asset_family_fk' AND conrelid = 'public.asset_records'::regclass) THEN
		ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_project_asset_family_fk" FOREIGN KEY ("project_id", "asset_family_id") REFERENCES "asset_families"("project_id", "id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_families_project_id_project_id_fkey' AND conrelid = 'public.asset_families'::regclass) THEN
		ALTER TABLE "asset_families" ADD CONSTRAINT "asset_families_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_families_created_by_user_id_user_id_fkey' AND conrelid = 'public.asset_families'::regclass) THEN
		ALTER TABLE "asset_families" ADD CONSTRAINT "asset_families_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_families_project_visual_world_fk' AND conrelid = 'public.asset_families'::regclass) THEN
		ALTER TABLE "asset_families" ADD CONSTRAINT "asset_families_project_visual_world_fk" FOREIGN KEY ("project_id", "visual_world_id") REFERENCES "visual_worlds"("project_id", "id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_versions_project_id_project_id_fkey' AND conrelid = 'public.asset_versions'::regclass) THEN
		ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_versions_created_by_user_id_user_id_fkey' AND conrelid = 'public.asset_versions'::regclass) THEN
		ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_versions_project_record_fk' AND conrelid = 'public.asset_versions'::regclass) THEN
		ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_project_record_fk" FOREIGN KEY ("project_id", "asset_record_id") REFERENCES "asset_records"("project_id", "id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_record_derivatives_created_by_user_id_user_id_fkey' AND conrelid = 'public.asset_record_derivatives'::regclass) THEN
		ALTER TABLE "asset_record_derivatives" ADD CONSTRAINT "asset_record_derivatives_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_record_derivatives_family_fk' AND conrelid = 'public.asset_record_derivatives'::regclass) THEN
		ALTER TABLE "asset_record_derivatives" ADD CONSTRAINT "asset_record_derivatives_family_fk" FOREIGN KEY ("project_id", "asset_family_id") REFERENCES "asset_families"("project_id", "id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_record_derivatives_family_version_fk' AND conrelid = 'public.asset_record_derivatives'::regclass) THEN
		ALTER TABLE "asset_record_derivatives" ADD CONSTRAINT "asset_record_derivatives_family_version_fk" FOREIGN KEY ("project_id", "asset_family_id", "canonical_version_id") REFERENCES "asset_families"("project_id", "id", "canonical_version_id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_record_derivatives_version_fk' AND conrelid = 'public.asset_record_derivatives'::regclass) THEN
		ALTER TABLE "asset_record_derivatives" ADD CONSTRAINT "asset_record_derivatives_version_fk" FOREIGN KEY ("project_id", "canonical_version_id") REFERENCES "asset_versions"("project_id", "id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_record_derivatives_source_fk' AND conrelid = 'public.asset_record_derivatives'::regclass) THEN
		ALTER TABLE "asset_record_derivatives" ADD CONSTRAINT "asset_record_derivatives_source_fk" FOREIGN KEY ("project_id", "source_asset_record_id", "asset_family_id") REFERENCES "asset_records"("project_id", "id", "asset_family_id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_record_derivatives_target_fk' AND conrelid = 'public.asset_record_derivatives'::regclass) THEN
		ALTER TABLE "asset_record_derivatives" ADD CONSTRAINT "asset_record_derivatives_target_fk" FOREIGN KEY ("project_id", "derivative_asset_record_id", "asset_family_id") REFERENCES "asset_records"("project_id", "id", "asset_family_id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_record_references_created_by_user_id_user_id_fkey' AND conrelid = 'public.asset_record_references'::regclass) THEN
		ALTER TABLE "asset_record_references" ADD CONSTRAINT "asset_record_references_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_record_references_record_fk' AND conrelid = 'public.asset_record_references'::regclass) THEN
		ALTER TABLE "asset_record_references" ADD CONSTRAINT "asset_record_references_record_fk" FOREIGN KEY ("project_id", "asset_record_id") REFERENCES "asset_records"("project_id", "id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_record_references_version_fk' AND conrelid = 'public.asset_record_references'::regclass) THEN
		ALTER TABLE "asset_record_references" ADD CONSTRAINT "asset_record_references_version_fk" FOREIGN KEY ("project_id", "target_version_id") REFERENCES "asset_versions"("project_id", "id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legacy_asset_attestations_attested_by_user_id_user_id_fkey' AND conrelid = 'public.legacy_asset_attestations'::regclass) THEN
		ALTER TABLE "legacy_asset_attestations" ADD CONSTRAINT "legacy_asset_attestations_attested_by_user_id_user_id_fkey" FOREIGN KEY ("attested_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legacy_asset_attestations_version_fk' AND conrelid = 'public.legacy_asset_attestations'::regclass) THEN
		ALTER TABLE "legacy_asset_attestations" ADD CONSTRAINT "legacy_asset_attestations_version_fk" FOREIGN KEY ("project_id", "version_id") REFERENCES "asset_versions"("project_id", "id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_version_quality_evidence_created_by_user_id_user_id_fkey' AND conrelid = 'public.asset_version_quality_evidence'::regclass) THEN
		ALTER TABLE "asset_version_quality_evidence" ADD CONSTRAINT "asset_version_quality_evidence_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_version_quality_evidence_version_fk' AND conrelid = 'public.asset_version_quality_evidence'::regclass) THEN
		ALTER TABLE "asset_version_quality_evidence" ADD CONSTRAINT "asset_version_quality_evidence_version_fk" FOREIGN KEY ("project_id", "version_id") REFERENCES "asset_versions"("project_id", "id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_version_reviews_project_version_fk' AND conrelid = 'public.asset_version_review_events'::regclass) THEN
		ALTER TABLE "asset_version_review_events" ADD CONSTRAINT "asset_version_reviews_project_version_fk" FOREIGN KEY ("project_id", "version_id", "asset_record_id") REFERENCES "asset_versions"("project_id", "id", "asset_record_id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_version_reviews_project_record_fk' AND conrelid = 'public.asset_version_review_events'::regclass) THEN
		ALTER TABLE "asset_version_review_events" ADD CONSTRAINT "asset_version_reviews_project_record_fk" FOREIGN KEY ("project_id", "asset_record_id") REFERENCES "asset_records"("project_id", "id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_version_reviews_decision_check' AND conrelid = 'public.asset_version_review_events'::regclass) THEN
		ALTER TABLE "asset_version_review_events" ADD CONSTRAINT "asset_version_reviews_decision_check" CHECK ("decision" IN ('candidate', 'approved', 'rejected'));
	END IF;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "asset_family_canonical_designs" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"asset_version_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_family_relationships" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"source_asset_record_id" text NOT NULL,
	"source_asset_version_id" text,
	"legacy_unversioned" boolean DEFAULT false NOT NULL,
	"target_asset_record_id" text NOT NULL,
	"type" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_family_relationships_distinct_records_check" CHECK ("source_asset_record_id" <> "target_asset_record_id"),
	CONSTRAINT "asset_family_relationships_derivative_version_check" CHECK (("type" = 'derivative' AND "source_asset_version_id" IS NOT NULL AND "legacy_unversioned" = false) OR ("type" = 'derivative' AND "source_asset_version_id" IS NULL AND "legacy_unversioned" = true) OR ("type" <> 'derivative' AND "source_asset_version_id" IS NULL AND "legacy_unversioned" = false))
);
--> statement-breakpoint
UPDATE "asset_families" AS family
SET "canonical_version_id" = (
	SELECT design."asset_version_id"
	FROM "asset_family_canonical_designs" AS design
	WHERE design."project_id" = family."project_id"
		AND design."asset_family_id" = family."id"
	ORDER BY design."created_at" DESC, design."id" DESC
	LIMIT 1
)
WHERE family."canonical_version_id" IS NULL
	AND EXISTS (
		SELECT 1 FROM "asset_family_canonical_designs" AS design
		WHERE design."project_id" = family."project_id"
			AND design."asset_family_id" = family."id"
	);
--> statement-breakpoint
DROP INDEX IF EXISTS "asset_families_project_name_ci_idx";--> statement-breakpoint
ALTER TABLE "asset_families" ADD COLUMN IF NOT EXISTS "subject_identity_id" text;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN IF NOT EXISTS "asset_family_id" text;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN IF NOT EXISTS "content_digest" text;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN IF NOT EXISTS "integrity_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN IF NOT EXISTS "idempotency_key" text DEFAULT 'legacy:' || gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_families" ALTER COLUMN "canonical_version_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_versions" ALTER COLUMN "file_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_versions" ALTER COLUMN "sha256" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_family_canonical_designs_current_idx" ON "asset_family_canonical_designs" ("asset_family_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_family_relationships_unique_link_idx" ON "asset_family_relationships" ("asset_family_id","source_asset_record_id","target_asset_record_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_family_relationships_project_family_idx" ON "asset_family_relationships" ("project_id","asset_family_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_family_relationships_created_by_user_id_idx" ON "asset_family_relationships" ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_families_identity_name_idx" ON "asset_families" ("subject_identity_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_records_project_family_record_idx" ON "asset_records" ("project_id","asset_family_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_versions_project_family_record_id_idx" ON "asset_versions" ("project_id","asset_family_id","asset_record_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_versions_idempotency_key_idx" ON "asset_versions" ("project_id","asset_record_id","idempotency_key");--> statement-breakpoint
ALTER TABLE "asset_family_canonical_designs" DROP CONSTRAINT IF EXISTS "asset_family_canonical_designs_created_by_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "asset_family_canonical_designs" ADD CONSTRAINT "asset_family_canonical_designs_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_family_canonical_designs" DROP CONSTRAINT IF EXISTS "asset_family_canonical_designs_family_fk";--> statement-breakpoint
ALTER TABLE "asset_family_canonical_designs" ADD CONSTRAINT "asset_family_canonical_designs_family_fk" FOREIGN KEY ("project_id","asset_family_id") REFERENCES "asset_families"("project_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_family_canonical_designs" DROP CONSTRAINT IF EXISTS "asset_family_canonical_designs_record_fk";--> statement-breakpoint
ALTER TABLE "asset_family_canonical_designs" ADD CONSTRAINT "asset_family_canonical_designs_record_fk" FOREIGN KEY ("project_id","asset_record_id","asset_family_id") REFERENCES "asset_records"("project_id","id","asset_family_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_family_canonical_designs" DROP CONSTRAINT IF EXISTS "asset_family_canonical_designs_version_fk";--> statement-breakpoint
ALTER TABLE "asset_family_canonical_designs" ADD CONSTRAINT "asset_family_canonical_designs_version_fk" FOREIGN KEY ("project_id","asset_family_id","asset_record_id","asset_version_id") REFERENCES "asset_versions"("project_id","asset_family_id","asset_record_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_family_relationships" DROP CONSTRAINT IF EXISTS "asset_family_relationships_created_by_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "asset_family_relationships" ADD CONSTRAINT "asset_family_relationships_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_family_relationships" DROP CONSTRAINT IF EXISTS "asset_family_relationships_source_same_family_fk";--> statement-breakpoint
ALTER TABLE "asset_family_relationships" ADD CONSTRAINT "asset_family_relationships_source_same_family_fk" FOREIGN KEY ("project_id","asset_family_id","source_asset_record_id") REFERENCES "asset_records"("project_id","asset_family_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_family_relationships" DROP CONSTRAINT IF EXISTS "asset_family_relationships_source_version_fk";--> statement-breakpoint
ALTER TABLE "asset_family_relationships" ADD CONSTRAINT "asset_family_relationships_source_version_fk" FOREIGN KEY ("project_id","asset_family_id","source_asset_record_id","source_asset_version_id") REFERENCES "asset_versions"("project_id","asset_family_id","asset_record_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_family_relationships" DROP CONSTRAINT IF EXISTS "asset_family_relationships_target_same_family_fk";--> statement-breakpoint
ALTER TABLE "asset_family_relationships" ADD CONSTRAINT "asset_family_relationships_target_same_family_fk" FOREIGN KEY ("project_id","asset_family_id","target_asset_record_id") REFERENCES "asset_records"("project_id","asset_family_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_versions" DROP CONSTRAINT IF EXISTS "asset_versions_project_family_record_fk";--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_project_family_record_fk" FOREIGN KEY ("project_id","asset_family_id","asset_record_id") REFERENCES "asset_records"("project_id","asset_family_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "subject_identities" DROP CONSTRAINT IF EXISTS "subject_identities_project_id_project_id_fkey", ADD CONSTRAINT "subject_identities_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "subject_identities" DROP CONSTRAINT IF EXISTS "subject_identities_created_by_user_id_user_id_fkey", ADD CONSTRAINT "subject_identities_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_families" DROP CONSTRAINT IF EXISTS "asset_families_project_subject_identity_fk", ADD CONSTRAINT "asset_families_project_subject_identity_fk" FOREIGN KEY ("project_id","subject_identity_id") REFERENCES "subject_identities"("project_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_content_digest_check" CHECK ("content_digest" IS NULL OR "content_digest" ~ '^[a-f0-9]{64}$');--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_integrity_digest_check" CHECK ("integrity_verified" = false OR "content_digest" IS NOT NULL);
--> statement-breakpoint
