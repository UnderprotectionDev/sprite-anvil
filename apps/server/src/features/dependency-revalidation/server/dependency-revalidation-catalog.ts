import {
	changeImpactSchema,
	type DependencyCatalog,
	type DependencyLink,
	dependencyLinkSchema,
	derivativeReReviewSchema,
} from "@sprite-anvil/api/dependency-revalidation";
import type { Database } from "@sprite-anvil/db";
import { assetFamilyCanonicalDesigns } from "@sprite-anvil/db/schema/asset-families";
import {
	assetVersionReviewEvents,
	assetVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import {
	changeImpacts,
	dependencyLinks,
	derivativeRevalidationReviews,
} from "@sprite-anvil/db/schema/dependency-revalidation";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import { and, asc, eq } from "drizzle-orm";

export function toDependencyLink(
	row: typeof dependencyLinks.$inferSelect
): DependencyLink {
	return dependencyLinkSchema.parse({
		id: row.id,
		projectId: row.projectId,
		source: row.sourceAssetVersionId
			? { kind: "asset_version", id: row.sourceAssetVersionId }
			: { kind: "context_revision", id: row.sourceContextRevisionId },
		targetAssetVersionId: row.targetAssetVersionId,
		facets: row.facets,
		createdAt: row.createdAt.toISOString(),
	});
}
export function toChangeImpact(row: typeof changeImpacts.$inferSelect) {
	return changeImpactSchema.parse({
		id: row.id,
		projectId: row.projectId,
		source: row.sourceAssetVersionId
			? { kind: "canonical_design", id: row.sourceAssetVersionId }
			: { kind: "context_revision", id: row.sourceContextRevisionId },
		facets: row.facets,
		affectedVersions: row.affectedVersions,
		createdAt: row.createdAt.toISOString(),
	});
}

interface DerivativeRevalidationFacts {
	canonicalRows: (typeof assetFamilyCanonicalDesigns.$inferSelect)[];
	contexts: (typeof contextRevisions.$inferSelect)[];
	impacts: (typeof changeImpacts.$inferSelect)[];
	reviewRows: {
		event: typeof assetVersionReviewEvents.$inferSelect;
		review: typeof derivativeRevalidationReviews.$inferSelect;
	}[];
	versions: { assetFamilyId: string | null; id: string }[];
}

// Shared read for every consumer that derives revalidation state. It skips
// Dependency Links and API schema parsing because only the raw pins matter
// here; family readiness calls this once per family on the asset-families
// page, so the read stays limited to the columns the state needs.
async function readDerivativeRevalidationFacts(
	database: Database,
	projectId: string
): Promise<DerivativeRevalidationFacts> {
	const [impacts, contexts, canonicalRows, versions, reviewRows] =
		await Promise.all([
			database
				.select()
				.from(changeImpacts)
				.where(eq(changeImpacts.projectId, projectId))
				.orderBy(asc(changeImpacts.createdAt), asc(changeImpacts.id)),
			database
				.select()
				.from(contextRevisions)
				.where(eq(contextRevisions.projectId, projectId))
				.orderBy(asc(contextRevisions.revisionNumber)),
			database
				.select()
				.from(assetFamilyCanonicalDesigns)
				.where(eq(assetFamilyCanonicalDesigns.projectId, projectId))
				.orderBy(
					asc(assetFamilyCanonicalDesigns.createdAt),
					asc(assetFamilyCanonicalDesigns.id)
				),
			database
				.select({
					id: assetVersions.id,
					assetFamilyId: assetVersions.assetFamilyId,
				})
				.from(assetVersions)
				.where(eq(assetVersions.projectId, projectId)),
			database
				.select({
					review: derivativeRevalidationReviews,
					event: assetVersionReviewEvents,
				})
				.from(derivativeRevalidationReviews)
				.innerJoin(
					assetVersionReviewEvents,
					and(
						eq(assetVersionReviewEvents.id, derivativeRevalidationReviews.id),
						eq(
							assetVersionReviewEvents.projectId,
							derivativeRevalidationReviews.projectId
						),
						eq(
							assetVersionReviewEvents.versionId,
							derivativeRevalidationReviews.assetVersionId
						)
					)
				)
				.where(eq(derivativeRevalidationReviews.projectId, projectId))
				.orderBy(
					asc(assetVersionReviewEvents.createdAt),
					asc(assetVersionReviewEvents.id)
				),
		]);
	return { canonicalRows, contexts, impacts, reviewRows, versions };
}

function computeRevalidationRequiredVersionIds(
	facts: DerivativeRevalidationFacts
) {
	const canonicalByFamily = new Map(
		facts.canonicalRows.map((row) => [row.assetFamilyId, row.assetVersionId])
	);
	const familyByVersion = new Map(
		facts.versions.map((row) => [row.id, row.assetFamilyId])
	);
	const activeContextId = facts.contexts.find(
		(revision) => revision.state === "active"
	)?.id;
	const latestByVersion = new Map(
		facts.reviewRows.map(({ review, event }) => [
			review.assetVersionId,
			{
				canonicalDesignVersionId: review.canonicalDesignVersionId,
				changeImpactIds: review.changeImpactIds,
				contextRevisionId: review.contextRevisionId,
				decision: event.decision,
			},
		])
	);
	const required = new Set<string>();
	for (const impact of facts.impacts) {
		for (const version of impact.affectedVersions) {
			const review = latestByVersion.get(version.assetVersionId);
			const familyId = familyByVersion.get(version.assetVersionId);
			if (
				!(
					review?.decision === "approved" &&
					review.contextRevisionId === activeContextId &&
					familyId &&
					review.canonicalDesignVersionId === canonicalByFamily.get(familyId) &&
					review.changeImpactIds.includes(impact.id)
				)
			) {
				required.add(version.assetVersionId);
			}
		}
	}
	return required;
}

export async function readDerivativeRevalidationState(
	database: Database,
	projectId: string
) {
	const facts = await readDerivativeRevalidationFacts(database, projectId);
	const requiredVersionIds = computeRevalidationRequiredVersionIds(facts);
	return {
		requiredVersionIds,
		reviewedVersionIds: new Set(
			facts.reviewRows
				.map(({ review }) => review.assetVersionId)
				.filter((versionId) => !requiredVersionIds.has(versionId))
		),
	};
}

export async function readDependencyCatalog(
	database: Database,
	projectId: string
): Promise<DependencyCatalog> {
	const [links, facts] = await Promise.all([
		database
			.select()
			.from(dependencyLinks)
			.where(eq(dependencyLinks.projectId, projectId))
			.orderBy(asc(dependencyLinks.createdAt), asc(dependencyLinks.id)),
		readDerivativeRevalidationFacts(database, projectId),
	]);
	const canonicalByFamily = new Map(
		facts.canonicalRows.map((row) => [row.assetFamilyId, row.assetVersionId])
	);
	const reviews = facts.reviewRows.map(({ review, event }) =>
		derivativeReReviewSchema.parse({
			...review,
			decision: event.decision,
			rationale: event.rationale,
			createdAt: event.createdAt.toISOString(),
		})
	);
	return {
		dependencyLinks: links.map(toDependencyLink),
		changeImpacts: facts.impacts.map(toChangeImpact),
		revalidationRequiredVersionIds: [
			...computeRevalidationRequiredVersionIds(facts),
		],
		reviews,
		canonicalDesigns: [...canonicalByFamily].map(
			([assetFamilyId, assetVersionId]) => ({ assetFamilyId, assetVersionId })
		),
		contextRevisions: facts.contexts.map((revision) => ({
			id: revision.id,
			revisionNumber: revision.revisionNumber,
			isActive: revision.state === "active",
		})),
	};
}
