CREATE TABLE "background_layer_layouts" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"contract_revision_id" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "background_layer_layouts_family_idx" ON "background_layer_layouts" ("project_id","asset_family_id","created_at");--> statement-breakpoint
ALTER TABLE "background_layer_layouts" ADD CONSTRAINT "background_layer_layouts_9e3ZwOx5R53p_fkey" FOREIGN KEY ("contract_revision_id") REFERENCES "specialized_profile_contract_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "background_layer_layouts" ADD CONSTRAINT "background_layer_layouts_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "background_layer_layouts" ADD CONSTRAINT "background_layer_layouts_family_fk" FOREIGN KEY ("project_id","asset_family_id") REFERENCES "asset_families"("project_id","id") ON DELETE RESTRICT;