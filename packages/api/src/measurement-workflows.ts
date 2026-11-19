import { z } from "zod";
import {
	measurementEventFamilySchema,
	measurementSurfaceSchema,
} from "./measurement-definitions";

export const productMeasurementEvents = [
	{
		family: "offline_verification",
		phase: "start",
		name: "bundle_verification_started",
	},
	{
		family: "offline_verification",
		phase: "finish",
		name: "bundle_verification_finished",
	},
	{
		family: "review_and_repair",
		phase: "start",
		name: "review_issue_recorded",
	},
	{
		family: "review_and_repair",
		phase: "finish",
		name: "repaired_version_reviewed",
	},
	{
		family: "production_workflow",
		phase: "start",
		name: "generation_package_prepared",
	},
	{
		family: "production_workflow",
		phase: "finish",
		name: "candidate_preview_reached",
	},
	{ family: "import_mapping", phase: "start", name: "import_entry_accepted" },
	{
		family: "import_mapping",
		phase: "finish",
		name: "import_mapping_finalized",
	},
	{
		family: "export_delivery",
		phase: "start",
		name: "delivery_target_activated",
	},
	{ family: "export_delivery", phase: "finish", name: "delivery_target_ready" },
	{
		family: "export_delivery",
		phase: "finish",
		name: "delivery_target_delivered",
	},
	{
		family: "runtime_validation",
		phase: "start",
		name: "runtime_validation_prepared",
	},
	{
		family: "runtime_validation",
		phase: "finish",
		name: "runtime_validation_finalized",
	},
] as const;

export const productMeasurementBoundarySchema = z
	.object({
		userId: z.string().min(1).max(128),
		projectId: z.uuid(),
		workflowId: z.uuid(),
		eventFamily: measurementEventFamilySchema,
		surface: measurementSurfaceSchema,
		phase: z.enum(["start", "finish"]),
		eventName: z
			.string()
			.max(64)
			.regex(/^[a-z0-9_]+$/u)
			.optional(),
		recordKind: z.enum([
			"generation_package",
			"asset_version",
			"unit_version",
			"composite_version",
			"import_batch",
			"export_bundle",
			"delivery_target",
			"runtime_validation",
			"offline_verification",
		]),
		outcomeClass: z.enum([
			"workflow_started",
			"preview_reached",
			"completed",
			"failed",
			"abandoned",
			"ready",
			"delivered",
			"confirmed",
			"selected",
			"no_selection",
			"verified",
		]),
		counters: z
			.object({
				regeneration_count: z
					.number()
					.int()
					.min(0)
					.max(1_000_000_000)
					.optional(),
				reentered_field_count: z
					.number()
					.int()
					.min(0)
					.max(1_000_000_000)
					.optional(),
				corrected_suggestion_count: z
					.number()
					.int()
					.min(0)
					.max(1_000_000_000)
					.optional(),
				manual_correction_count: z
					.number()
					.int()
					.min(0)
					.max(1_000_000_000)
					.optional(),
			})
			.strict(),
	})
	.strict()
	.refine(
		(input) =>
			!input.eventName ||
			productMeasurementEvents.some(
				(event) =>
					event.family === input.eventFamily &&
					event.phase === input.phase &&
					event.name === input.eventName
			),
		{
			path: ["eventName"],
			message: "Unknown product event for this family and phase.",
		}
	);
export type ProductMeasurementBoundary = z.infer<
	typeof productMeasurementBoundarySchema
>;
export interface ProductMeasurementRecorder {
	record: (input: ProductMeasurementBoundary) => Promise<void>;
}

/** Measurement failures must never fail the product operation. */
export async function recordProductBoundary(
	context: {
		productMeasurementRecorder?: ProductMeasurementRecorder;
		surface?: ProductMeasurementBoundary["surface"];
	},
	input: Omit<ProductMeasurementBoundary, "surface" | "eventName"> & {
		eventName: NonNullable<ProductMeasurementBoundary["eventName"]>;
	}
): Promise<void> {
	if (!(context.productMeasurementRecorder && context.surface)) {
		return;
	}
	try {
		await context.productMeasurementRecorder.record({
			...input,
			surface: context.surface,
		});
	} catch {
		console.error("product_measurement_boundary_failed");
	}
}
