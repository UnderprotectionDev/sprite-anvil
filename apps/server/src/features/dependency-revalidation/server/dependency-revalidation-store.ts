import {
	type AffectedVersion,
	type ChangeFacetInput,
	changeImpactSchema,
	type DependencyLink,
	type DependencyRevalidationStore,
	dependencyLinkSchema,
} from "@sprite-anvil/api/dependency-revalidation";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import {
	assetFamilyCanonicalDesigns,
	assetFamilyRelationships,
} from "@sprite-anvil/db/schema/asset-families";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import {
	changeImpacts,
	dependencyLinks,
} from "@sprite-anvil/db/schema/dependency-revalidation";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import { and, asc, desc, eq } from "drizzle-orm";
import {
	historicalCompositionOptions,
	listHistoricalCompositions,
	pinHistoricalComposition,
} from "./historical-composition-store";

function toDependencyLink(
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
function toChangeImpact(row: typeof changeImpacts.$inferSelect) {
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

export async function readRevalidationRequiredVersionIds(
	database: Database,
	projectId: string
) {
	const rows = await database
		.select({ affectedVersions: changeImpacts.affectedVersions })
		.from(changeImpacts)
		.where(eq(changeImpacts.projectId, projectId));
	return new Set(
		rows.flatMap((row) =>
			row.affectedVersions.map((version) => version.assetVersionId)
		)
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
		historicalCompositionOptions: (userId, projectId) =>
			historicalCompositionOptions(database, userId, projectId),
		listHistoricalCompositions: (userId, projectId) =>
			listHistoricalCompositions(database, userId, projectId),
		pinHistoricalComposition: (userId, input, verifyContent) =>
			pinHistoricalComposition(database, userId, input, verifyContent),
		async list(userId, projectId) {
			if (!(await getProjectForUser(database, userId, projectId))) {
				return null;
			}
			const [links, impacts, contexts] = await Promise.all([
				database
					.select()
					.from(dependencyLinks)
					.where(eq(dependencyLinks.projectId, projectId))
					.orderBy(asc(dependencyLinks.createdAt), asc(dependencyLinks.id)),
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
			]);
			return {
				dependencyLinks: links.map(toDependencyLink),
				changeImpacts: impacts.map(toChangeImpact),
				revalidationRequiredVersionIds: [
					...new Set(
						impacts.flatMap((impact) =>
							impact.affectedVersions.map((version) => version.assetVersionId)
						)
					),
				],
				contextRevisions: contexts.map((revision) => ({
					id: revision.id,
					revisionNumber: revision.revisionNumber,
					isActive: revision.state === "active",
				})),
			};
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
