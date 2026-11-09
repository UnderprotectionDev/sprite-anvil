CREATE TABLE "readiness_plan_orders" (
	"delivery_target_revision_id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"ordered_work_ids" jsonb NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "readiness_plan_orders" ADD CONSTRAINT "readiness_plan_orders_wq9EV5rgIWA9_fkey" FOREIGN KEY ("delivery_target_revision_id") REFERENCES "delivery_target_revisions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "readiness_plan_orders" ADD CONSTRAINT "readiness_plan_orders_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "readiness_plan_orders" ADD CONSTRAINT "readiness_plan_orders_updated_by_user_id_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;