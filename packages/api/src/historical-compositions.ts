import { z } from "zod";

const idSchema = z.string().trim().min(1).max(128);
const idsSchema = idSchema
	.array()
	.max(256)
	.refine(
		(ids) => new Set(ids).size === ids.length,
		"Selections must be distinct."
	);

export const historicalCompositionInputSchema = z
	.object({
		projectId: idSchema,
		idempotencyKey: z.string().uuid(),
		compositeVersionId: idSchema,
		contextRevisionId: idSchema,
		canonicalDesignVersionId: idSchema,
		dependencyLinkIds: idsSchema,
		dependencyVersionIds: idsSchema,
		readinessEvidenceIds: idsSchema,
		profileContractRevisionIds: idsSchema,
		reviewEventIds: idsSchema,
	})
	.strict();

export const historicalCompositionReportSchema = z
	.object({
		mode: z.literal("historical"),
		exportEligible: z.boolean(),
		blockers: z
			.object({
				code: z.enum([
					"integrity",
					"dependency",
					"applicability",
					"approval",
					"quality_contract",
					"quality",
					"availability",
				]),
				targetId: idSchema,
				message: z.string(),
			})
			.strict()
			.array(),
	})
	.strict();

export const historicalCompositionSchema = z
	.object({
		id: idSchema,
		selection: historicalCompositionInputSchema,
		unitVersionIds: idsSchema,
		assetVersionIds: idsSchema,
		report: historicalCompositionReportSchema,
		createdAt: z.string().datetime(),
	})
	.strict();

export const historicalCompositionListSchema = z
	.object({ pins: historicalCompositionSchema.array() })
	.strict();
export const historicalCompositionOptionsSchema = z
	.object({
		evidence: z
			.object({
				id: idSchema,
				kind: z.string(),
				result: z.string(),
				requirementId: idSchema.nullable(),
				contextRevisionId: idSchema.nullable(),
				canonicalDesignVersionId: idSchema.nullable(),
				assetVersionIds: idsSchema,
				versionTargetId: idSchema.nullable(),
				profileContractRevisionIds: idSchema.nullable().array(),
				createdAt: z.string().datetime(),
			})
			.strict()
			.array(),
		contracts: z.object({ id: idSchema, name: z.string() }).strict().array(),
	})
	.strict();
export type HistoricalCompositionOptions = z.infer<
	typeof historicalCompositionOptionsSchema
>;
export type HistoricalCompositionInput = z.infer<
	typeof historicalCompositionInputSchema
>;
export type HistoricalComposition = z.infer<typeof historicalCompositionSchema>;
export type HistoricalCompositionReport = z.infer<
	typeof historicalCompositionReportSchema
>;
export type HistoricalCompositionPinResult =
	| { kind: "saved"; pin: HistoricalComposition }
	| { kind: "invalid-selection" }
	| { kind: "idempotency-conflict" };
