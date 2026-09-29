CREATE TABLE "specialized_profile_contract_activations" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"activated_by_user_id" text NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "specialized_profile_contract_heads" (
	"project_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"active_revision_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "specialized_profile_contract_revisions" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"template_revision_number" integer NOT NULL,
	"contract" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "family_readiness_evidence" ADD COLUMN "profile_contract_revision_ids" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "family_readiness_evidence" ADD COLUMN "rule_class" text;--> statement-breakpoint
ALTER TABLE "family_readiness_evidence" ADD COLUMN "test_id" text;--> statement-breakpoint
ALTER TABLE "family_readiness_evidence" ADD COLUMN "observed_value" text;--> statement-breakpoint
CREATE INDEX "specialized_profile_contract_activations_history_idx" ON "specialized_profile_contract_activations" ("project_id","profile_id","activated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "specialized_profile_contract_heads_project_profile_idx" ON "specialized_profile_contract_heads" ("project_id","profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "specialized_profile_contract_revisions_project_profile_id_idx" ON "specialized_profile_contract_revisions" ("project_id","profile_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "specialized_profile_contract_revisions_number_idx" ON "specialized_profile_contract_revisions" ("project_id","profile_id","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX "specialized_profile_contract_revisions_template_idx" ON "specialized_profile_contract_revisions" ("project_id","profile_id","template_revision_number");--> statement-breakpoint
CREATE INDEX "specialized_profile_contract_revisions_created_idx" ON "specialized_profile_contract_revisions" ("project_id","profile_id","created_at");--> statement-breakpoint
ALTER TABLE "specialized_profile_contract_activations" ADD CONSTRAINT "specialized_profile_contract_activations_KNdUk0xX0FeG_fkey" FOREIGN KEY ("activated_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "specialized_profile_contract_activations" ADD CONSTRAINT "specialized_profile_contract_activations_revision_fk" FOREIGN KEY ("project_id","profile_id","revision_id") REFERENCES "specialized_profile_contract_revisions"("project_id","profile_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "specialized_profile_contract_heads" ADD CONSTRAINT "specialized_profile_contract_heads_project_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "specialized_profile_contract_heads" ADD CONSTRAINT "specialized_profile_contract_heads_revision_fk" FOREIGN KEY ("project_id","profile_id","active_revision_id") REFERENCES "specialized_profile_contract_revisions"("project_id","profile_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "specialized_profile_contract_revisions" ADD CONSTRAINT "specialized_profile_contract_revisions_TF9m2Xxllvc2_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "specialized_profile_contract_revisions" ADD CONSTRAINT "specialized_profile_contract_revisions_project_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "family_readiness_evidence" DROP CONSTRAINT "family_readiness_evidence_kind_result_check", ADD CONSTRAINT "family_readiness_evidence_kind_result_check" CHECK (("kind" = 'applicability' AND "result" IN ('applicable', 'inapplicable')) OR ("kind" = 'quality' AND "result" IN ('passed', 'failed', 'inconclusive', 'waived')) OR ("kind" = 'usage_test' AND "result" IN ('passed', 'failed', 'inconclusive')));--> statement-breakpoint
ALTER TABLE "family_readiness_evidence" DROP CONSTRAINT "family_readiness_evidence_payload_check", ADD CONSTRAINT "family_readiness_evidence_payload_check" CHECK (("kind" = 'quality' AND "rule_id" IS NOT NULL AND "test_id" IS NULL AND "method" IS NOT NULL AND ("result" <> 'waived' OR "observed_value" IS NOT NULL)) OR ("kind" = 'usage_test' AND "rule_id" IS NULL AND "rule_class" IS NULL AND "test_id" IS NOT NULL AND "observed_value" IS NULL AND "method" IS NOT NULL) OR ("kind" = 'applicability' AND "rule_id" IS NULL AND "rule_class" IS NULL AND "test_id" IS NULL AND "observed_value" IS NULL AND "method" IS NULL));