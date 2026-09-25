CREATE TABLE IF NOT EXISTS "asset_families" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"visual_world_id" text NOT NULL,
	"canonical_version_id" text NOT NULL,
	"name" text NOT NULL,
	"use_context" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
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
	CONSTRAINT "asset_record_references_feature_check" CHECK (cardinality("transferred_features") + cardinality("forbidden_features") >= 1)
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
	CONSTRAINT "asset_version_quality_evidence_result_check" CHECK ("result" = 'matched')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_version_review_events" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"version_id" text NOT NULL,
	"decision" text NOT NULL,
	"rationale" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_version_reviews_decision_check" CHECK ("decision" IN ('candidate', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_versions" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"sha256" text NOT NULL,
	"byte_size" integer NOT NULL,
	"object_key" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_versions_content_type_check" CHECK ("content_type" IN ('image/png', 'image/webp')),
	CONSTRAINT "asset_versions_sha256_check" CHECK ("sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "asset_versions_byte_size_check" CHECK ("byte_size" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_families_project_id_id_idx" ON "asset_families" ("project_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_families_project_name_idx" ON "asset_families" ("project_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_records_project_id_id_idx" ON "asset_records" ("project_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_record_derivatives_source_idx" ON "asset_record_derivatives" ("project_id","source_asset_record_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_record_derivatives_target_idx" ON "asset_record_derivatives" ("project_id","derivative_asset_record_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_record_references_asset_record_created_idx" ON "asset_record_references" ("asset_record_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legacy_asset_attestations_version_created_idx" ON "legacy_asset_attestations" ("version_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_version_quality_evidence_version_created_idx" ON "asset_version_quality_evidence" ("version_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_version_reviews_record_created_idx" ON "asset_version_review_events" ("asset_record_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_version_reviews_version_created_idx" ON "asset_version_review_events" ("version_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_versions_project_id_id_idx" ON "asset_versions" ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_versions_record_number_idx" ON "asset_versions" ("project_id","asset_record_id","version_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_versions_record_created_at_idx" ON "asset_versions" ("asset_record_id","created_at");--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_families') AND conname = 'asset_families_project_id_project_id_fkey') THEN ALTER TABLE "asset_families" ADD CONSTRAINT "asset_families_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_families') AND conname = 'asset_families_created_by_user_id_user_id_fkey') THEN ALTER TABLE "asset_families" ADD CONSTRAINT "asset_families_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_families') AND conname = 'asset_families_project_visual_world_fk') THEN ALTER TABLE "asset_families" ADD CONSTRAINT "asset_families_project_visual_world_fk" FOREIGN KEY ("project_id","visual_world_id") REFERENCES "visual_worlds"("project_id","id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_records') AND conname = 'asset_records_project_asset_family_fk') THEN ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_project_asset_family_fk" FOREIGN KEY ("project_id","asset_family_id") REFERENCES "asset_families"("project_id","id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_record_derivatives') AND conname = 'asset_record_derivatives_created_by_user_id_user_id_fkey') THEN ALTER TABLE "asset_record_derivatives" ADD CONSTRAINT "asset_record_derivatives_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_record_derivatives') AND conname = 'asset_record_derivatives_family_fk') THEN ALTER TABLE "asset_record_derivatives" ADD CONSTRAINT "asset_record_derivatives_family_fk" FOREIGN KEY ("project_id","asset_family_id") REFERENCES "asset_families"("project_id","id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_record_derivatives') AND conname = 'asset_record_derivatives_source_fk') THEN ALTER TABLE "asset_record_derivatives" ADD CONSTRAINT "asset_record_derivatives_source_fk" FOREIGN KEY ("project_id","source_asset_record_id") REFERENCES "asset_records"("project_id","id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_record_derivatives') AND conname = 'asset_record_derivatives_target_fk') THEN ALTER TABLE "asset_record_derivatives" ADD CONSTRAINT "asset_record_derivatives_target_fk" FOREIGN KEY ("project_id","derivative_asset_record_id") REFERENCES "asset_records"("project_id","id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_record_derivatives') AND conname = 'asset_record_derivatives_version_fk') THEN ALTER TABLE "asset_record_derivatives" ADD CONSTRAINT "asset_record_derivatives_version_fk" FOREIGN KEY ("project_id","canonical_version_id") REFERENCES "asset_versions"("project_id","id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_record_references') AND conname = 'asset_record_references_created_by_user_id_user_id_fkey') THEN ALTER TABLE "asset_record_references" ADD CONSTRAINT "asset_record_references_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_record_references') AND conname = 'asset_record_references_record_fk') THEN ALTER TABLE "asset_record_references" ADD CONSTRAINT "asset_record_references_record_fk" FOREIGN KEY ("project_id","asset_record_id") REFERENCES "asset_records"("project_id","id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_record_references') AND conname = 'asset_record_references_version_fk') THEN ALTER TABLE "asset_record_references" ADD CONSTRAINT "asset_record_references_version_fk" FOREIGN KEY ("project_id","target_version_id") REFERENCES "asset_versions"("project_id","id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.legacy_asset_attestations') AND conname = 'legacy_asset_attestations_attested_by_user_id_user_id_fkey') THEN ALTER TABLE "legacy_asset_attestations" ADD CONSTRAINT "legacy_asset_attestations_attested_by_user_id_user_id_fkey" FOREIGN KEY ("attested_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.legacy_asset_attestations') AND conname = 'legacy_asset_attestations_version_fk') THEN ALTER TABLE "legacy_asset_attestations" ADD CONSTRAINT "legacy_asset_attestations_version_fk" FOREIGN KEY ("project_id","version_id") REFERENCES "asset_versions"("project_id","id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_version_quality_evidence') AND conname = 'asset_version_quality_evidence_created_by_user_id_user_id_fkey') THEN ALTER TABLE "asset_version_quality_evidence" ADD CONSTRAINT "asset_version_quality_evidence_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_version_quality_evidence') AND conname = 'asset_version_quality_evidence_version_fk') THEN ALTER TABLE "asset_version_quality_evidence" ADD CONSTRAINT "asset_version_quality_evidence_version_fk" FOREIGN KEY ("project_id","version_id") REFERENCES "asset_versions"("project_id","id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_version_review_events') AND conname = 'asset_version_review_events_created_by_user_id_user_id_fkey') THEN ALTER TABLE "asset_version_review_events" ADD CONSTRAINT "asset_version_review_events_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_version_review_events') AND conname = 'asset_version_reviews_project_version_fk') THEN ALTER TABLE "asset_version_review_events" ADD CONSTRAINT "asset_version_reviews_project_version_fk" FOREIGN KEY ("project_id","version_id") REFERENCES "asset_versions"("project_id","id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_version_review_events') AND conname = 'asset_version_reviews_project_record_fk') THEN ALTER TABLE "asset_version_review_events" ADD CONSTRAINT "asset_version_reviews_project_record_fk" FOREIGN KEY ("project_id","asset_record_id") REFERENCES "asset_records"("project_id","id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_versions') AND conname = 'asset_versions_project_id_project_id_fkey') THEN ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_versions') AND conname = 'asset_versions_created_by_user_id_user_id_fkey') THEN ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_versions') AND conname = 'asset_versions_project_record_fk') THEN ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_project_record_fk" FOREIGN KEY ("project_id","asset_record_id") REFERENCES "asset_records"("project_id","id") ON DELETE RESTRICT; END IF; END $$;