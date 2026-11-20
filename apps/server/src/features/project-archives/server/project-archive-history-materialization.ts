import { isDeepStrictEqual } from "node:util";
import type { HistoryRecords } from "@sprite-anvil/api/project-archive-history";
import { historySectionSchemas } from "@sprite-anvil/api/project-archive-history";
import type { Database } from "@sprite-anvil/db";
import type { InteractiveTransaction } from "@sprite-anvil/db/interactive-database";
import { animationTimingReviews } from "@sprite-anvil/db/schema/animation-timing-reviews";
import { assetFamilyComparisons } from "@sprite-anvil/db/schema/asset-family-comparisons";
import {
	legacyAssetAttestations,
	manualImportEvidence,
} from "@sprite-anvil/db/schema/asset-production-history";
import {
	assetVersionQualityEvidence,
	assetVersionReviewEvents,
	compositeVersionReviewEvents,
} from "@sprite-anvil/db/schema/asset-versions";
import { backgroundLayerLayouts } from "@sprite-anvil/db/schema/background-layer-layouts";
import { backgroundScrollingTests } from "@sprite-anvil/db/schema/background-scrolling-tests";
import { directionalReviews } from "@sprite-anvil/db/schema/directional-reviews";
import {
	familyReadinessEvidence,
	familyRequiredSetActivations,
	familyRequiredSetHeads,
	familyRequiredSetRevisions,
} from "@sprite-anvil/db/schema/family-readiness";
import { gameplayMetadataRecords } from "@sprite-anvil/db/schema/gameplay-metadata";
import { generationPackages } from "@sprite-anvil/db/schema/generation-packages";
import { iconFamilyReviews } from "@sprite-anvil/db/schema/icon-family-reviews";
import { marketingUsageReviews } from "@sprite-anvil/db/schema/marketing-usage-reviews";
import { portraitIdentityReviews } from "@sprite-anvil/db/schema/portrait-identity-reviews";
import {
	productionExperiments,
	productionExperimentTrials,
} from "@sprite-anvil/db/schema/production-experiments";
import {
	productionRecipes,
	productionRecipeVersions,
} from "@sprite-anvil/db/schema/production-recipes";
import { providerGenerationRecords } from "@sprite-anvil/db/schema/provider-generation-records";
import { rightsRecords } from "@sprite-anvil/db/schema/rights-records";
import { sceneQaPlaygrounds } from "@sprite-anvil/db/schema/scene-qa";
import {
	sourceMetadataMappingFinalizations,
	sourceMetadataMappingProposals,
} from "@sprite-anvil/db/schema/source-metadata-mapping";
import {
	projectSpecializedProfileContracts,
	specializedProfileContractRevisions,
} from "@sprite-anvil/db/schema/specialized-profile-contracts";
import { textureRepetitionReviews } from "@sprite-anvil/db/schema/texture-repetition-reviews";
import { tilesetAdjacencyReviews } from "@sprite-anvil/db/schema/tileset-adjacency-reviews";
import { uiStateComparisons } from "@sprite-anvil/db/schema/ui-state-comparisons";
import { uiStretchTests } from "@sprite-anvil/db/schema/ui-stretch-tests";
import { vfxAppearanceReviews } from "@sprite-anvil/db/schema/vfx-appearance-reviews";
import { vfxSynchronizationReviews } from "@sprite-anvil/db/schema/vfx-synchronization";
import { and, eq } from "drizzle-orm";
import type { StoredProjectArchiveRestoreRecord } from "./project-archive-restore-storage";

type Tx = Pick<InteractiveTransaction, "insert" | "select">;

async function insertBatches<T>(
	rows: T[],
	insert: (rows: T[]) => PromiseLike<unknown>
) {
	for (let index = 0; index < rows.length; index += 500) {
		// biome-ignore lint/performance/noAwaitInLoops: FK-ordered batches share one transaction.
		await insert(rows.slice(index, index + 500));
	}
}

const familyTables = {
	animation_timing: animationTimingReviews,
	background_layer_layout: backgroundLayerLayouts,
	background_scrolling_test: backgroundScrollingTests,
	icon_family: iconFamilyReviews,
	marketing_usage: marketingUsageReviews,
	portrait_identity: portraitIdentityReviews,
	texture_repetition: textureRepetitionReviews,
	tileset_adjacency: tilesetAdjacencyReviews,
	ui_state_comparison: uiStateComparisons,
	ui_stretch_test: uiStretchTests,
	vfx_appearance: vfxAppearanceReviews,
	vfx_synchronization: vfxSynchronizationReviews,
} as const;

function sections(
	record: Pick<StoredProjectArchiveRestoreRecord, "sections">
): HistoryRecords {
	const result = {} as HistoryRecords;
	for (const name of Object.keys(
		historySectionSchemas
	) as (keyof HistoryRecords)[]) {
		const section = record.sections.find(
			(item) => item.group === "history" && item.name === name
		);
		Object.assign(result, {
			[name]: historySectionSchemas[name].array().parse(section?.records ?? []),
		});
	}
	return result;
}

function replaceIds(value: unknown, ids: ReadonlyMap<string, string>): unknown {
	if (typeof value === "string") {
		return ids.get(value) ?? value;
	}
	if (Array.isArray(value)) {
		return value.map((item) => replaceIds(item, ids));
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [key, replaceIds(item, ids)])
		);
	}
	return value;
}

async function resolveContracts(
	tx: Tx,
	rows: HistoryRecords["contractRevisions"]
) {
	const ids = new Map<string, string>();
	for (const row of rows) {
		// A revision is global; use the existing identical immutable definition when it exists.
		// biome-ignore lint/performance/noAwaitInLoops: The selected immutable row must be verified after each upsert.
		await tx
			.insert(specializedProfileContractRevisions)
			.values({ ...row, createdAt: new Date(row.createdAt) })
			.onConflictDoNothing();
		const [existing] = await tx
			.select()
			.from(specializedProfileContractRevisions)
			.where(
				and(
					eq(specializedProfileContractRevisions.profileId, row.profileId),
					eq(
						specializedProfileContractRevisions.contractVersion,
						row.contractVersion
					)
				)
			)
			.limit(1);
		if (
			!existing ||
			existing.id !== row.id ||
			existing.contractSchemaVersion !== row.contractSchemaVersion ||
			!isDeepStrictEqual(existing.definition, row.definition)
		) {
			throw new Error(
				"Archive profile contract conflicts with an existing revision"
			);
		}
		ids.set(row.id, existing.id);
	}
	return ids;
}

/** Checks that every source and mandatory file exists before any object is copied. */
export function canMaterializeArchiveHistory(
	plan: Pick<
		import("@sprite-anvil/api/project-archive-restore").ProjectArchiveRestorePlan,
		"sections" | "files"
	>
): boolean {
	try {
		const history = sections(plan);
		const foundationRecords = (name: string) =>
			plan.sections.find(
				(section) => section.group === "foundation" && section.name === name
			)?.records ?? [];
		const hasId = (name: string, id: string) =>
			foundationRecords(name).some(
				(row) =>
					typeof row === "object" &&
					row !== null &&
					"id" in row &&
					row.id === id
			);
		return (
			history.metadataProposals.every((row) =>
				hasId("importInboxEntries", row.sourceEntryId)
			) &&
			history.rightsRecords.every(
				(row) =>
					(!row.referenceId ||
						hasId("referenceBoardImages", row.referenceId)) &&
					(!row.evidenceFile ||
						plan.files.some(
							(file) =>
								file.kind === "rights_evidence_file" &&
								file.restoredId === row.id
						))
			)
		);
	} catch {
		return false;
	}
}

function assertRecoverable(
	history: HistoryRecords,
	record: StoredProjectArchiveRestoreRecord
) {
	const foundationRecords = (name: string) =>
		record.sections.find(
			(section) => section.group === "foundation" && section.name === name
		)?.records ?? [];
	const hasId = (name: string, id: string) =>
		foundationRecords(name).some(
			(item) =>
				typeof item === "object" &&
				item !== null &&
				"id" in item &&
				item.id === id
		);
	for (const proposal of history.metadataProposals) {
		if (!hasId("importInboxEntries", proposal.sourceEntryId)) {
			throw new Error(
				"Archive lacks Import Inbox source records required for metadata history"
			);
		}
	}
	for (const rights of history.rightsRecords) {
		if (
			rights.referenceId &&
			!hasId("referenceBoardImages", rights.referenceId)
		) {
			throw new Error(
				"Archive lacks Reference Board image records required for rights history"
			);
		}
		if (
			rights.evidenceFile &&
			!record.files.some(
				(file) =>
					file.kind === "rights_evidence_file" &&
					file.restoredId === rights.id &&
					(file.presence === "excluded" || Boolean(file.objectKey))
			)
		) {
			throw new Error(
				"Archive lacks the rights evidence file required for restore"
			);
		}
	}
}

async function insertReview(
	tx: Tx,
	review: HistoryRecords["reviews"][number],
	identity: { projectId: string; createdByUserId: string },
	contracts: ReadonlyMap<string, string>
) {
	const contract = (id: string) => contracts.get(id) ?? id;
	const created = (value: string) => new Date(value);
	const base = {
		id: review.id,
		...identity,
		record: replaceIds(review.record, contracts) as Record<string, unknown>,
		createdAt: created(review.createdAt),
	};
	if (review.kind === "scene_qa_playground") {
		await tx.insert(sceneQaPlaygrounds).values(base);
		return;
	}
	if (!review.assetFamilyId) {
		throw new Error("Archive review is missing its Asset Family");
	}
	if (review.kind === "asset_family_comparison") {
		await tx
			.insert(assetFamilyComparisons)
			.values({ ...base, assetFamilyId: review.assetFamilyId });
		return;
	}
	if (!review.contractRevisionId) {
		throw new Error("Archive review is missing its profile contract");
	}
	const family = {
		...base,
		assetFamilyId: review.assetFamilyId,
		contractRevisionId: contract(review.contractRevisionId),
	};
	if (review.kind === "directional") {
		if (!review.canonicalDesignId) {
			throw new Error(
				"Archive directional review is missing its canonical design"
			);
		}
		await tx
			.insert(directionalReviews)
			.values({ ...family, canonicalDesignId: review.canonicalDesignId });
	} else {
		await tx.insert(familyTables[review.kind]).values(family);
	}
}

async function insertReadinessHistory(
	tx: Tx,
	history: HistoryRecords,
	identity: { projectId: string; createdByUserId: string }
) {
	const { projectId, createdByUserId } = identity;
	const created = (value: string) => new Date(value);
	if (history.requiredSetRevisions.length) {
		await insertBatches(
			history.requiredSetRevisions.map((row) => ({
				...row,
				...identity,
				createdAt: created(row.createdAt),
			})),
			(batch) => tx.insert(familyRequiredSetRevisions).values(batch)
		);
	}
	if (history.requiredSetHeads.length) {
		await insertBatches(
			history.requiredSetHeads.map(({ id: _id, ...row }) => ({
				...row,
				projectId,
				updatedAt: created(row.updatedAt),
			})),
			(batch) => tx.insert(familyRequiredSetHeads).values(batch)
		);
	}
	if (history.requiredSetActivations.length) {
		await insertBatches(
			history.requiredSetActivations.map((row) => ({
				...row,
				projectId,
				activatedByUserId: createdByUserId,
				activatedAt: created(row.activatedAt),
			})),
			(batch) => tx.insert(familyRequiredSetActivations).values(batch)
		);
	}
	if (history.compositeVersionReviews.length) {
		await insertBatches(
			history.compositeVersionReviews.map((row) => ({
				...row,
				...identity,
				createdAt: created(row.createdAt),
			})),
			(batch) => tx.insert(compositeVersionReviewEvents).values(batch)
		);
	}
	if (history.assetVersionReviews.length) {
		await insertBatches(
			history.assetVersionReviews.map((row) => ({
				...row,
				...identity,
				createdAt: created(row.createdAt),
			})),
			(batch) => tx.insert(assetVersionReviewEvents).values(batch)
		);
	}
	if (history.assetVersionQuality.length) {
		await insertBatches(
			history.assetVersionQuality.map((row) => ({
				...row,
				...identity,
				createdAt: created(row.createdAt),
			})),
			(batch) => tx.insert(assetVersionQualityEvidence).values(batch)
		);
	}
	if (history.familyReadinessEvidence.length) {
		await insertBatches(
			history.familyReadinessEvidence.map((row) => ({
				...row,
				...identity,
				createdAt: created(row.createdAt),
			})),
			(batch) => tx.insert(familyReadinessEvidence).values(batch)
		);
	}
}

export async function insertArchiveHistory(
	tx: Tx,
	record: StoredProjectArchiveRestoreRecord
) {
	const history = sections(record);
	assertRecoverable(history, record);
	const { restoredProjectId: projectId, createdByUserId } = record.restore;
	const identity = { projectId, createdByUserId };
	const contracts = await resolveContracts(tx, history.contractRevisions);
	const contract = (id: string) => contracts.get(id) ?? id;
	const created = (createdAt: string) => new Date(createdAt);
	if (history.contractActivations.length) {
		await insertBatches(
			history.contractActivations.map((row) => ({
				projectId,
				profileId: row.profileId,
				contractRevisionId: contract(row.contractRevisionId),
				activatedByUserId: createdByUserId,
				activatedAt: created(row.activatedAt),
			})),
			(batch) => tx.insert(projectSpecializedProfileContracts).values(batch)
		);
	}
	await insertReadinessHistory(tx, history, identity);
	if (history.generationPackages.length) {
		await insertBatches(
			history.generationPackages.map((row) => ({
				...row,
				...identity,
				createdAt: created(row.createdAt),
			})),
			(batch) => tx.insert(generationPackages).values(batch)
		);
	}
	if (history.legacyAttestations.length) {
		await insertBatches(
			history.legacyAttestations.map(({ assetVersionId, ...row }) => ({
				...row,
				projectId,
				versionId: assetVersionId,
				attestedByUserId: createdByUserId,
				createdAt: created(row.createdAt),
			})),
			(batch) => tx.insert(legacyAssetAttestations).values(batch)
		);
	}
	if (history.manualImportEvidence.length) {
		await insertBatches(
			history.manualImportEvidence.map(({ assetVersionId, ...row }) => ({
				...row,
				...identity,
				versionId: assetVersionId,
				createdAt: created(row.createdAt),
			})),
			(batch) => tx.insert(manualImportEvidence).values(batch)
		);
	}
	if (history.providerGenerationRecords.length) {
		await insertBatches(
			history.providerGenerationRecords.map((row) => ({
				...row,
				...identity,
				createdAt: created(row.createdAt),
			})),
			(batch) => tx.insert(providerGenerationRecords).values(batch)
		);
	}
	if (history.experiments.length) {
		await insertBatches(
			history.experiments.map((row) => ({
				...row,
				...identity,
				concludedByUserId: row.concludedAt ? createdByUserId : null,
				concludedAt: row.concludedAt ? created(row.concludedAt) : null,
				createdAt: created(row.createdAt),
			})),
			(batch) => tx.insert(productionExperiments).values(batch)
		);
	}
	if (history.experimentTrials.length) {
		await insertBatches(
			history.experimentTrials.map((row) => ({
				...row,
				projectId,
				createdAt: created(row.createdAt),
			})),
			(batch) => tx.insert(productionExperimentTrials).values(batch)
		);
	}
	if (history.recipes.length) {
		await insertBatches(
			history.recipes.map((row) => ({
				...row,
				...identity,
				createdAt: created(row.createdAt),
			})),
			(batch) => tx.insert(productionRecipes).values(batch)
		);
	}
	if (history.recipeVersions.length) {
		await insertBatches(
			history.recipeVersions.map((row) => ({
				...row,
				...identity,
				createdAt: created(row.createdAt),
			})),
			(batch) => tx.insert(productionRecipeVersions).values(batch)
		);
	}
	if (history.gameplayMetadata.length) {
		await insertBatches(
			history.gameplayMetadata.map((row) => ({
				...row,
				...identity,
				contractRevisionId: contract(row.contractRevisionId),
				record: replaceIds(row.record, contracts) as Record<string, unknown>,
				createdAt: created(row.createdAt),
			})),
			(batch) => tx.insert(gameplayMetadataRecords).values(batch)
		);
	}
	for (const review of history.reviews) {
		// biome-ignore lint/performance/noAwaitInLoops: Transaction inserts retain deterministic ordering.
		await insertReview(tx, review, identity, contracts);
	}
	if (history.metadataProposals.length) {
		await insertBatches(
			history.metadataProposals.map((row) => ({
				...row,
				...identity,
				createdAt: created(row.createdAt),
			})),
			(batch) => tx.insert(sourceMetadataMappingProposals).values(batch)
		);
	}
	if (history.metadataDecisions.length) {
		await insertBatches(
			history.metadataDecisions.map(({ id, ...row }) => ({
				...row,
				...identity,
				proposalId: id,
				createdAt: created(row.createdAt),
			})),
			(batch) => tx.insert(sourceMetadataMappingFinalizations).values(batch)
		);
	}

	if (history.rightsRecords.length) {
		await insertBatches(
			history.rightsRecords.map(({ evidenceFile, ...row }) => {
				const file = record.files.find(
					(entry) =>
						entry.kind === "rights_evidence_file" && entry.restoredId === row.id
				);
				return {
					...row,
					...identity,
					createdAt: created(row.createdAt),
					evidenceFile:
						evidenceFile && file
							? {
									objectKey: file.objectKey,
									contentLength: evidenceFile.byteSize,
									sourceContentType: evidenceFile.contentType,
									fileName: evidenceFile.fileName,
									sha256: evidenceFile.sha256,
								}
							: null,
				};
			}),
			(batch) => tx.insert(rightsRecords).values(batch)
		);
	}
}

/** Reverses history inserts before foundation deletion after failed verification. */
export function archiveHistoryDeleteQueries(
	db: Pick<Database, "delete">,
	projectId: string
) {
	const tables = [
		sourceMetadataMappingFinalizations,
		sourceMetadataMappingProposals,
		familyReadinessEvidence,
		familyRequiredSetActivations,
		familyRequiredSetHeads,
		familyRequiredSetRevisions,
		assetVersionQualityEvidence,
		assetVersionReviewEvents,
		compositeVersionReviewEvents,
		gameplayMetadataRecords,
		directionalReviews,
		assetFamilyComparisons,
		sceneQaPlaygrounds,
		...Object.values(familyTables),
		rightsRecords,
		manualImportEvidence,
		legacyAssetAttestations,
		providerGenerationRecords,
		productionExperimentTrials,
		productionRecipeVersions,
		productionRecipes,
		productionExperiments,
		generationPackages,
		projectSpecializedProfileContracts,
	];
	return tables.map((table) =>
		db.delete(table).where(eq(table.projectId, projectId))
	);
}
