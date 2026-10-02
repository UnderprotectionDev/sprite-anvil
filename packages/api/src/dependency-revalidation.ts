import { z } from "zod";

const idSchema = z.string().trim().min(1).max(128);
export const dependencyFacetSchema = z.string().trim().min(1).max(80);
const facetsSchema = dependencyFacetSchema
	.array()
	.max(32)
	.refine(
		(facets) => new Set(facets).size === facets.length,
		"Facets must be distinct."
	);
const sourceSchema = z
	.object({ kind: z.enum(["asset_version", "context_revision"]), id: idSchema })
	.strict();
export const dependencyLinkInputSchema = z
	.object({
		projectId: idSchema,
		source: sourceSchema,
		targetAssetVersionId: idSchema,
		facets: facetsSchema,
	})
	.strict();
export const dependencyLinkSchema = dependencyLinkInputSchema.extend({
	id: idSchema,
	createdAt: z.string().datetime(),
});
export const changeFacetInputSchema = z
	.object({
		projectId: idSchema,
		source: z
			.object({
				kind: z.enum(["canonical_design", "context_revision"]),
				id: idSchema,
			})
			.strict(),
		facets: facetsSchema.refine(
			(facets) => facets.length > 0,
			"Select at least one Change Facet."
		),
	})
	.strict();
export const affectedVersionSchema = z
	.object({
		assetVersionId: idSchema,
		assetRecordId: idSchema,
		status: z.literal("revalidation_required"),
		reason: z.enum(["matching_dependency", "incomplete_dependency"]),
		dependencySourceId: idSchema,
	})
	.strict();
export const changeImpactSchema = changeFacetInputSchema.extend({
	id: idSchema,
	createdAt: z.string().datetime(),
	affectedVersions: affectedVersionSchema.array(),
});
export const dependencyCatalogInputSchema = z
	.object({ projectId: idSchema })
	.strict();
export const dependencyCatalogSchema = z
	.object({
		dependencyLinks: dependencyLinkSchema.array(),
		changeImpacts: changeImpactSchema.array(),
		revalidationRequiredVersionIds: idSchema.array(),
		contextRevisions: z
			.object({
				id: idSchema,
				revisionNumber: z.number().int().nonnegative(),
				isActive: z.boolean(),
			})
			.strict()
			.array(),
	})
	.strict();

export type DependencyLinkInput = z.infer<typeof dependencyLinkInputSchema>;
export type DependencyLink = z.infer<typeof dependencyLinkSchema>;
export type ChangeFacetInput = z.infer<typeof changeFacetInputSchema>;
export type ChangeImpact = z.infer<typeof changeImpactSchema>;
export type AffectedVersion = z.infer<typeof affectedVersionSchema>;
export type DependencyCatalog = z.infer<typeof dependencyCatalogSchema>;
export interface DependencyRevalidationStore {
	createLink: (
		userId: string,
		input: DependencyLinkInput
	) => Promise<DependencyLink | null>;
	determine: (
		userId: string,
		input: ChangeFacetInput
	) => Promise<ChangeImpact | null>;
	list: (
		userId: string,
		projectId: string
	) => Promise<DependencyCatalog | null>;
}
