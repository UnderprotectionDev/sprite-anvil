import z from "zod";

const facetSelection = {
	facets: z.array(z.string()),
	other: z.string(),
};

export const dependencyLinkFormSchema = z
	.object({
		kind: z.enum(["asset_version", "context_revision"]),
		sourceId: z.string().min(1),
		targetId: z.string().min(1),
		...facetSelection,
	})
	.refine(
		(value) =>
			!(value.kind === "asset_version" && value.sourceId === value.targetId)
	);

export const changeFacetFormSchema = z
	.object({
		kind: z.enum(["canonical_design", "context_revision"]),
		sourceId: z.string().min(1),
		...facetSelection,
	})
	.refine((value) => value.facets.length > 0 || value.other.trim() !== "");

export function derivativeReReviewFormSchema(
	contextRevisionId: string | undefined,
	canonicalDesignVersionId: string | undefined
) {
	return z.object({
		contextRevisionId: z
			.string()
			.refine(
				(value) => Boolean(contextRevisionId) && value === contextRevisionId
			),
		canonicalDesignVersionId: z
			.string()
			.refine(
				(value) =>
					Boolean(canonicalDesignVersionId) &&
					value === canonicalDesignVersionId
			),
		rationale: z.string().refine((value) => value.trim() !== ""),
	});
}

export const historicalCompositionFormSchema = z.object({
	compositeVersionId: z.string().min(1),
	contextRevisionId: z.string().min(1),
	canonicalDesignVersionId: z.string().min(1),
	dependencyLinkIds: z.array(z.string()),
	dependencyVersionIds: z.array(z.string()),
	readinessEvidenceIds: z.array(z.string()),
	profileContractRevisionIds: z.array(z.string()),
	reviewEventIds: z.array(z.string()),
});
