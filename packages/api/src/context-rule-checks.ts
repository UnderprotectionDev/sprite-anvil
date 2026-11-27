import { z } from "zod";
import { assetRecordCategorySchema } from "./asset-records";
import { idempotencyKeySchema } from "./record-publication";

export const rgbaColourSchema = z.string().regex(/^#[0-9a-f]{8}$/u);

export const measuredColourSchema = z
	.object({
		rgba: rgbaColourSchema,
		pixels: z.number().int().positive(),
		boundaryPixels: z.number().int().nonnegative(),
	})
	.strict();

export const colourMergeStepSchema = z
	.object({
		source: rgbaColourSchema,
		target: rgbaColourSchema,
		pixels: z.number().int().positive(),
	})
	.strict();

export const measurableContextRuleIds = [
	"palette.max_colors",
	"outline.width",
] as const;

export const contextRuleCheckGroups = [
	"blocked",
	"needs_a_look",
	"safe_to_merge",
	"passing",
] as const;

export const contextRuleCheckResultSchema = z
	.object({
		ruleId: z.enum(measurableContextRuleIds),
		limit: z.number(),
		observed: z.number().nullable(),
		passes: z.boolean(),
	})
	.strict();

const identifierSchema = z.string().trim().min(1).max(128);

export const colourTargetsSchema = z.record(rgbaColourSchema, rgbaColourSchema);

export const contextRuleCheckItemSchema = z
	.object({
		assetRecordId: identifierSchema,
		name: z.string(),
		assetCategory: assetRecordCategorySchema.nullable(),
		assetVersionId: identifierSchema,
		versionNumber: z.number().int().positive(),
		reviewDisposition: z.enum(["approved", "candidate"]),
		/** An unreadable version is shown but counted in no result group. */
		status: z.enum(["checked", "unreadable"]),
		qaBlocked: z.boolean(),
		colours: z.array(measuredColourSchema),
		results: z.array(contextRuleCheckResultSchema),
		merge: z
			.object({
				steps: z.array(colourMergeStepSchema),
				changesBoundary: z.boolean(),
				colourCount: z.number().int().nonnegative(),
			})
			.strict()
			.nullable(),
	})
	.strict();

export const contextRuleCheckOverviewSchema = z
	.object({
		projectId: identifierSchema,
		contextRevisionId: identifierSchema,
		revisionNumber: z.number().int().nonnegative(),
		items: z.array(contextRuleCheckItemSchema),
	})
	.strict();

export const contextRuleCheckOverviewInputSchema = z
	.object({ projectId: identifierSchema })
	.strict();

export const contextRuleRecheckInputSchema = z
	.object({
		projectId: identifierSchema,
		assetRecordIds: z.array(identifierSchema).min(1).max(1000),
	})
	.strict();

export const colourMergePreviewInputSchema = z
	.object({
		projectId: identifierSchema,
		assetVersionId: identifierSchema,
		targets: colourTargetsSchema.default({}),
	})
	.strict();

export const colourMergePreviewSchema = z
	.object({
		assetVersionId: identifierSchema,
		contextRevisionId: identifierSchema,
		steps: z.array(colourMergeStepSchema),
		changesBoundary: z.boolean(),
		colourCount: z.number().int().nonnegative(),
		outlineWidth: z.number().int().positive().nullable(),
		imageDataUrl: z.string().startsWith("data:image/png;base64,"),
	})
	.strict();

export const colourMergeApplyInputSchema = colourMergePreviewInputSchema
	.extend({
		/** The revision the user previewed; another one invalidates the merge. */
		expectedContextRevisionId: identifierSchema,
		idempotencyKey: idempotencyKeySchema.optional(),
	})
	.strict();

export const colourMergeResultSchema = z
	.object({
		assetRecordId: identifierSchema,
		assetVersionId: identifierSchema,
		created: z.boolean(),
	})
	.strict();

export type MeasuredColour = z.infer<typeof measuredColourSchema>;
export type ColourMergeStep = z.infer<typeof colourMergeStepSchema>;
export type ContextRuleCheckGroup = (typeof contextRuleCheckGroups)[number];
export type ContextRuleCheckResult = z.infer<
	typeof contextRuleCheckResultSchema
>;
export type ContextRuleCheckItem = z.infer<typeof contextRuleCheckItemSchema>;
export type ContextRuleCheckOverview = z.infer<
	typeof contextRuleCheckOverviewSchema
>;
export type ColourMergePreview = z.infer<typeof colourMergePreviewSchema>;
export type ColourMergeResult = z.infer<typeof colourMergeResultSchema>;
export interface ContextRuleLimits {
	maxColours?: number;
	outlineWidth?: number;
}

export type ColourMergeFailure =
	| "not_found"
	| "unreadable"
	| "stale_context_revision"
	| "nothing_to_merge"
	| "invalid_target"
	| "family_required"
	| "idempotency_conflict"
	| "storage_unavailable";

export type ColourMergeOutcome<T> =
	| { ok: true; value: T }
	| { ok: false; reason: ColourMergeFailure };

export interface ContextRuleCheckStore {
	applyMerge: (
		userId: string,
		input: z.output<typeof colourMergeApplyInputSchema>
	) => Promise<ColourMergeOutcome<ColourMergeResult>>;
	overview: (
		userId: string,
		projectId: string
	) => Promise<ContextRuleCheckOverview | null>;
	previewMerge: (
		userId: string,
		input: z.output<typeof colourMergePreviewInputSchema>
	) => Promise<ColourMergeOutcome<ColourMergePreview>>;
	/** Repeats the measurement only; it records no review decision. */
	recheck: (
		userId: string,
		projectId: string,
		assetRecordIds: string[]
	) => Promise<ContextRuleCheckOverview | null>;
}

/**
 * The result group of one version for the rules the viewer selected. Server and
 * interface share it so filtering by rule cannot change what a group means.
 */
export function contextRuleCheckGroup({
	results,
	mergeChangesBoundary,
	qaBlocked,
}: {
	results: ContextRuleCheckResult[];
	mergeChangesBoundary: boolean;
	qaBlocked: boolean;
}): ContextRuleCheckGroup {
	const failing = results.filter((result) => !result.passes);
	if (failing.length === 0) {
		return "passing";
	}
	if (qaBlocked) {
		return "blocked";
	}
	return mergeChangesBoundary ||
		failing.some((result) => result.ruleId === "outline.width")
		? "needs_a_look"
		: "safe_to_merge";
}
