import type {
	AffectedVersion,
	ChangeFacetInput,
	DependencyLink,
	DependencyRevalidationStore,
} from "@sprite-anvil/api/dependency-revalidation";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import {
	assetFamilyCanonicalDesigns,
	assetFamilyRelationships,
} from "@sprite-anvil/db/schema/asset-families";
import {
	assetVersionReviewEvents,
	assetVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import {
	changeImpacts,
	dependencyLinks,
} from "@sprite-anvil/db/schema/dependency-revalidation";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { checkReviewApproval } from "../../asset-versions/server/asset-version-store";
import {
	readDependencyCatalog,
	toChangeImpact,
	toDependencyLink,
} from "./dependency-revalidation-catalog";

async function readDependencyGraph(database: Database, projectId: string) {
	const [versions, links, relationships] = await Promise.all([
		database
			.select()
			.from(assetVersions)
			.where(eq(assetVersions.projectId, projectId))
			.orderBy(asc(assetVersions.id)),
		database
			.select()
			.from(dependencyLinks)
			.where(eq(dependencyLinks.projectId, projectId)),
		database
			.select()
			.from(assetFamilyRelationships)
			.where(eq(assetFamilyRelationships.projectId, projectId)),
	]);
	const edges = links.map(toDependencyLink);
	for (const relationship of relationships) {
		const sourceVersions = versions.filter(
			(version) =>
				version.assetRecordId === relationship.sourceAssetRecordId &&
				(!relationship.sourceAssetVersionId ||
					version.id === relationship.sourceAssetVersionId)
		);
		const targetVersions = versions.filter(
			(version) => version.assetRecordId === relationship.targetAssetRecordId
		);
		for (const source of sourceVersions) {
			for (const target of targetVersions) {
				if (
					!edges.some(
						(edge) =>
							edge.source.kind === "asset_version" &&
							edge.source.id === source.id &&
							edge.targetAssetVersionId === target.id
					)
				) {
					edges.push({
						id: relationship.id,
						projectId,
						source: { kind: "asset_version", id: source.id },
						targetAssetVersionId: target.id,
						facets: [],
						createdAt: relationship.createdAt.toISOString(),
					});
				}
			}
		}
	}
	return { versions, edges };
}

function addIncompleteDependencies(
	{ versions, edges }: Awaited<ReturnType<typeof readDependencyGraph>>,
	input: ChangeFacetInput
) {
	if (input.source.kind === "canonical_design") {
		const canonical = versions.find(
			(version) => version.id === input.source.id
		);
		for (const version of versions) {
			if (
				version.sourceKind === "derived" &&
				version.assetFamilyId === canonical?.assetFamilyId &&
				version.id !== input.source.id &&
				!edges.some(
					(edge) =>
						edge.source.kind === "asset_version" &&
						edge.targetAssetVersionId === version.id
				)
			) {
				edges.push({
					id: version.id,
					projectId: input.projectId,
					source: { kind: "asset_version", id: input.source.id },
					targetAssetVersionId: version.id,
					facets: [],
					createdAt: version.createdAt.toISOString(),
				});
			}
		}
	}
	if (input.source.kind === "context_revision") {
		const derivativeIds = new Set(
			edges.map((edge) => edge.targetAssetVersionId)
		);
		for (const version of versions) {
			if (
				(derivativeIds.has(version.id) || version.sourceKind === "derived") &&
				!edges.some(
					(edge) =>
						edge.source.kind === "context_revision" &&
						edge.targetAssetVersionId === version.id
				)
			) {
				edges.push({
					id: version.id,
					projectId: input.projectId,
					source: { kind: "context_revision", id: input.source.id },
					targetAssetVersionId: version.id,
					facets: [],
					createdAt: version.createdAt.toISOString(),
				});
			}
		}
	}
	return edges;
}

async function determineAffectedVersions(
	database: Database,
	input: ChangeFacetInput
) {
	const graph = await readDependencyGraph(database, input.projectId);
	const edges = addIncompleteDependencies(graph, input);
	const versionsById = new Map(
		graph.versions.map((version) => [version.id, version])
	);
	const sourceKind =
		input.source.kind === "canonical_design"
			? "asset_version"
			: "context_revision";
	const queue = [{ kind: sourceKind, id: input.source.id }];
	const visited = new Set<string>();
	const affected = new Map<string, AffectedVersion>();
	while (queue.length > 0) {
		const source = queue.shift();
		if (!source) {
			break;
		}
		const sourceKey = `${source.kind}:${source.id}`;
		if (visited.has(sourceKey)) {
			continue;
		}
		visited.add(sourceKey);
		const matchingEdges = edges.filter((edge) =>
			matchesChangeFacet(edge, source, input.facets)
		);
		for (const edge of matchingEdges) {
			const target = versionsById.get(edge.targetAssetVersionId);
			if (
				!target ||
				(sourceKind === "asset_version" && target.id === input.source.id)
			) {
				continue;
			}
			const reason =
				edge.facets.length === 0
					? "incomplete_dependency"
					: "matching_dependency";
			if (!affected.has(target.id) || reason === "incomplete_dependency") {
				affected.set(target.id, {
					assetVersionId: target.id,
					assetRecordId: target.assetRecordId,
					status: "revalidation_required",
					reason,
					dependencySourceId: source.id,
				});
			}
			queue.push({ kind: "asset_version", id: target.id });
		}
	}
	return [...affected.values()].sort((first, second) =>
		first.assetVersionId.localeCompare(second.assetVersionId)
	);
}

function matchesChangeFacet(
	edge: DependencyLink,
	source: { kind: string; id: string },
	facets: string[]
) {
	return (
		edge.source.kind === source.kind &&
		edge.source.id === source.id &&
		(edge.facets.length === 0 ||
			edge.facets.some((facet) => facets.includes(facet)))
	);
}

async function isCurrentCanonicalDesignSelection(
	database: Database,
	projectId: string,
	assetVersionId: string
) {
	const [selection] = await database
		.select({ assetFamilyId: assetFamilyCanonicalDesigns.assetFamilyId })
		.from(assetFamilyCanonicalDesigns)
		.where(
			and(
				eq(assetFamilyCanonicalDesigns.projectId, projectId),
				eq(assetFamilyCanonicalDesigns.assetVersionId, assetVersionId)
			)
		)
		.orderBy(
			desc(assetFamilyCanonicalDesigns.createdAt),
			desc(assetFamilyCanonicalDesigns.id)
		)
		.limit(1);
	if (!selection) {
		return false;
	}
	const [latest] = await database
		.select({ assetVersionId: assetFamilyCanonicalDesigns.assetVersionId })
		.from(assetFamilyCanonicalDesigns)
		.where(
			and(
				eq(assetFamilyCanonicalDesigns.projectId, projectId),
				eq(assetFamilyCanonicalDesigns.assetFamilyId, selection.assetFamilyId)
			)
		)
		.orderBy(
			desc(assetFamilyCanonicalDesigns.createdAt),
			desc(assetFamilyCanonicalDesigns.id)
		)
		.limit(1);
	return latest?.assetVersionId === assetVersionId;
}

export function createDependencyRevalidationStore(
	database: Database
): DependencyRevalidationStore {
	return {
		async reReview(userId, input) {
			if (!(await getProjectForUser(database, userId, input.projectId))) {
				return null;
			}
			const catalog = await readDependencyCatalog(database, input.projectId);
			if (
				!catalog.revalidationRequiredVersionIds.includes(input.assetVersionId)
			) {
				return null;
			}
			const [version] = await database
				.select()
				.from(assetVersions)
				.where(
					and(
						eq(assetVersions.projectId, input.projectId),
						eq(assetVersions.id, input.assetVersionId)
					)
				)
				.limit(1);
			const [latestEvent] = await database
				.select()
				.from(assetVersionReviewEvents)
				.where(
					and(
						eq(assetVersionReviewEvents.projectId, input.projectId),
						eq(assetVersionReviewEvents.versionId, input.assetVersionId)
					)
				)
				.orderBy(
					desc(assetVersionReviewEvents.createdAt),
					desc(assetVersionReviewEvents.id)
				)
				.limit(1);
			if (
				!version ||
				(input.decision === "approved" &&
					latestEvent?.decision !== "approved" &&
					(await checkReviewApproval(database, userId, version)) !== true)
			) {
				return null;
			}
			const reviewId = crypto.randomUUID();
			const impactIds = JSON.stringify(input.changeImpactIds);
			await database.execute(sql`
				WITH eligible_version AS (
					SELECT version.* FROM asset_versions AS version
					WHERE version.project_id = ${input.projectId} AND version.id = ${input.assetVersionId}
						AND version.source_kind = 'derived'
						AND EXISTS (SELECT 1 FROM context_revisions WHERE project_id = version.project_id AND id = ${input.contextRevisionId} AND state = 'active')
						AND ${input.canonicalDesignVersionId} = (SELECT asset_version_id FROM asset_family_canonical_designs WHERE project_id = version.project_id AND asset_family_id = version.asset_family_id ORDER BY created_at DESC, id DESC LIMIT 1)
						AND (SELECT id FROM asset_version_review_events WHERE project_id = version.project_id AND version_id = version.id ORDER BY created_at DESC, id DESC LIMIT 1) IS NOT DISTINCT FROM ${latestEvent?.id ?? null}::text
						AND NOT EXISTS (SELECT 1 FROM change_impacts AS impact WHERE impact.project_id = version.project_id AND impact.affected_versions @> jsonb_build_array(jsonb_build_object('assetVersionId', version.id)) AND NOT ${impactIds}::text::jsonb ? impact.id)
						AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(${impactIds}::text::jsonb) AS selected(id) WHERE NOT EXISTS (SELECT 1 FROM change_impacts AS impact WHERE impact.project_id = version.project_id AND impact.id = selected.id AND impact.affected_versions @> jsonb_build_array(jsonb_build_object('assetVersionId', version.id))))
				), new_event AS (
					INSERT INTO asset_version_review_events (id, project_id, asset_record_id, version_id, decision, rationale, created_by_user_id)
					SELECT ${reviewId}, project_id, asset_record_id, id, ${input.decision}, ${input.rationale}, ${userId} FROM eligible_version RETURNING id, project_id, version_id
				)
				INSERT INTO derivative_revalidation_reviews (id, project_id, asset_version_id, context_revision_id, canonical_design_version_id, change_impact_ids)
				SELECT id, project_id, version_id, ${input.contextRevisionId}, ${input.canonicalDesignVersionId}, ${impactIds}::text::jsonb FROM new_event
			`);
			const saved = await readDependencyCatalog(database, input.projectId);
			return saved.reviews.find((review) => review.id === reviewId) ?? null;
		},
		async list(userId, projectId) {
			if (!(await getProjectForUser(database, userId, projectId))) {
				return null;
			}
			return readDependencyCatalog(database, projectId);
		},
		async createLink(userId, input) {
			if (!(await getProjectForUser(database, userId, input.projectId))) {
				return null;
			}
			const [target] = await database
				.select()
				.from(assetVersions)
				.where(
					and(
						eq(assetVersions.projectId, input.projectId),
						eq(assetVersions.id, input.targetAssetVersionId)
					)
				)
				.limit(1);
			const sourceTable =
				input.source.kind === "asset_version"
					? assetVersions
					: contextRevisions;
			const [source] = await database
				.select({ id: sourceTable.id })
				.from(sourceTable)
				.where(
					and(
						eq(sourceTable.projectId, input.projectId),
						eq(sourceTable.id, input.source.id)
					)
				)
				.limit(1);
			if (
				!(target && source) ||
				target.sourceKind !== "derived" ||
				(input.source.kind === "asset_version" && source.id === target.id)
			) {
				return null;
			}
			const [row] = await database
				.insert(dependencyLinks)
				.values({
					id: crypto.randomUUID(),
					projectId: input.projectId,
					sourceAssetVersionId:
						input.source.kind === "asset_version" ? input.source.id : null,
					sourceContextRevisionId:
						input.source.kind === "context_revision" ? input.source.id : null,
					targetAssetVersionId: target.id,
					facets: input.facets,
					createdByUserId: userId,
				})
				.onConflictDoNothing()
				.returning();
			return row ? toDependencyLink(row) : null;
		},
		async determine(userId, input) {
			if (!(await getProjectForUser(database, userId, input.projectId))) {
				return null;
			}
			const sourceTable =
				input.source.kind === "canonical_design"
					? assetFamilyCanonicalDesigns
					: contextRevisions;
			const sourceIdColumn =
				input.source.kind === "canonical_design"
					? assetFamilyCanonicalDesigns.assetVersionId
					: contextRevisions.id;
			const [source] = await database
				.select({ id: sourceTable.id })
				.from(sourceTable)
				.where(
					and(
						eq(sourceTable.projectId, input.projectId),
						eq(sourceIdColumn, input.source.id)
					)
				)
				.limit(1);
			if (!source) {
				return null;
			}
			if (
				input.source.kind === "canonical_design" &&
				!(await isCurrentCanonicalDesignSelection(
					database,
					input.projectId,
					input.source.id
				))
			) {
				return null;
			}
			const affectedVersions = await determineAffectedVersions(database, input);
			const [row] = await database
				.insert(changeImpacts)
				.values({
					id: crypto.randomUUID(),
					projectId: input.projectId,
					sourceAssetVersionId:
						input.source.kind === "canonical_design" ? input.source.id : null,
					sourceContextRevisionId:
						input.source.kind === "context_revision" ? input.source.id : null,
					facets: input.facets,
					affectedVersions,
					createdByUserId: userId,
				})
				.returning();
			return row ? toChangeImpact(row) : null;
		},
	};
}
