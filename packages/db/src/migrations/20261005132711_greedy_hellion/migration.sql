ALTER TABLE "family_readiness_evidence" ADD COLUMN "usage_variant" text;--> statement-breakpoint
ALTER TABLE "family_readiness_evidence" ADD COLUMN "target_width" integer;--> statement-breakpoint
ALTER TABLE "family_readiness_evidence" ADD COLUMN "target_height" integer;--> statement-breakpoint
ALTER TABLE "family_readiness_evidence" ADD COLUMN "grayscale_reviewed" boolean;--> statement-breakpoint
ALTER TABLE "family_readiness_evidence" ADD CONSTRAINT "family_readiness_evidence_target_dimensions_check" CHECK (("target_width" IS NULL AND "target_height" IS NULL) OR ("target_width" IS NOT NULL AND "target_height" IS NOT NULL AND "target_width" > 0 AND "target_height" > 0));--> statement-breakpoint
ALTER TABLE "family_readiness_evidence" ADD CONSTRAINT "family_readiness_evidence_usage_variant_check" CHECK ("usage_variant" IS NULL OR ("usage_variant" = btrim("usage_variant") AND char_length("usage_variant") BETWEEN 1 AND 120));--> statement-breakpoint
ALTER TABLE "family_readiness_evidence" ADD CONSTRAINT "family_readiness_evidence_icon_usage_fields_check" CHECK (("usage_variant" IS NULL AND "target_width" IS NULL AND "target_height" IS NULL AND "grayscale_reviewed" IS NULL) OR ("test_id" IS NOT NULL AND "test_id" = 'icon.light_dark_target_size' AND "usage_variant" IS NOT NULL AND "target_width" IS NOT NULL AND "target_height" IS NOT NULL AND "grayscale_reviewed" IS TRUE));
