import type {
	HistoryRecords,
	reviewKinds,
} from "@sprite-anvil/api/project-archive-history";
import type { ProjectArchiveSourceFile } from "@sprite-anvil/api/project-archives";
import type { Database } from "@sprite-anvil/db";
import { animationTimingReviews } from "@sprite-anvil/db/schema/animation-timing-reviews";
import { assetFamilyComparisons } from "@sprite-anvil/db/schema/asset-family-comparisons";
import {
	legacyAssetAttestations,
	manualImportEvidence,
} from "@sprite-anvil/db/schema/asset-production-history";
import { backgroundLayerLayouts } from "@sprite-anvil/db/schema/background-layer-layouts";
import { backgroundScrollingTests } from "@sprite-anvil/db/schema/background-scrolling-tests";
import { directionalReviews } from "@sprite-anvil/db/schema/directional-reviews";
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
import { specializedProfileContractRevisions } from "@sprite-anvil/db/schema/specialized-profile-contracts";
import { textureRepetitionReviews } from "@sprite-anvil/db/schema/texture-repetition-reviews";
import { tilesetAdjacencyReviews } from "@sprite-anvil/db/schema/tileset-adjacency-reviews";
import { uiStateComparisons } from "@sprite-anvil/db/schema/ui-state-comparisons";
import { uiStretchTests } from "@sprite-anvil/db/schema/ui-stretch-tests";
import { vfxAppearanceReviews } from "@sprite-anvil/db/schema/vfx-appearance-reviews";
import { vfxSynchronizationReviews } from "@sprite-anvil/db/schema/vfx-synchronization";
import { eq, inArray } from "drizzle-orm";
import { iso } from "./iso";

type ReviewKind = (typeof reviewKinds)[number];

/** A review row of any kind; only the family reviews carry a contract revision, and only the directional review a canonical design. */
export interface ReviewRow {
	assetFamilyId?: string | null;
	canonicalDesignId?: string | null;
	contractRevisionId?: string | null;
	createdAt: Date;
	id: string;
	record: Record<string, unknown>;
}

export interface HistoryRows {
	attestations: (typeof legacyAssetAttestations.$inferSelect)[];
	contractRevisions: (typeof specializedProfileContractRevisions.$inferSelect)[];
	experiments: (typeof productionExperiments.$inferSelect)[];
	finalizations: (typeof sourceMetadataMappingFinalizations.$inferSelect)[];
	gameplayMetadata: (typeof gameplayMetadataRecords.$inferSelect)[];
	generationPackages: (typeof generationPackages.$inferSelect)[];
	manualEvidence: (typeof manualImportEvidence.$inferSelect)[];
	proposals: (typeof sourceMetadataMappingProposals.$inferSelect)[];
	providerRecords: (typeof providerGenerationRecords.$inferSelect)[];
	recipes: (typeof productionRecipes.$inferSelect)[];
	recipeVersions: (typeof productionRecipeVersions.$inferSelect)[];
	reviews: { kind: ReviewKind; rows: ReviewRow[] }[];
	rights: (typeof rightsRecords.$inferSelect)[];
	trials: (typeof productionExperimentTrials.$inferSelect)[];
}

const isoOrNull = (value: Date | null) => (value ? iso(value) : null);

/**
 * Copies only the fields the archive format names. No author, storage
 * location or other user identity travels: rights evidence files keep their
 * name, type, digest and size, and the storage location stays beside the
 * archive as a file location.
 */
export function mapHistoryRows(rows: HistoryRows): {
	files: ProjectArchiveSourceFile[];
	history: HistoryRecords;
} {
	const history: HistoryRecords = {
		contractRevisions: rows.contractRevisions.map((row) => ({
			contractSchemaVersion: row.contractSchemaVersion,
			contractVersion: row.contractVersion,
			createdAt: iso(row.createdAt),
			definition: row.definition,
			id: row.id,
			profileId: row.profileId,
		})),
		experimentTrials: rows.trials.map((row) => ({
			assetRecordId: row.assetRecordId,
			assetVersionId: row.assetVersionId,
			createdAt: iso(row.createdAt),
			experimentId: row.experimentId,
			generationPackageId: row.generationPackageId,
			id: row.id,
			label: row.label,
			position: row.position,
		})),
		experiments: rows.experiments.map((row) => ({
			assetRecordId: row.assetRecordId,
			concludedAt: isoOrNull(row.concludedAt),
			createdAt: iso(row.createdAt),
			id: row.id,
			outcome: row.outcome,
			outcomeNote: row.outcomeNote,
			selectedTrialId: row.selectedTrialId,
			title: row.title,
		})),
		gameplayMetadata: rows.gameplayMetadata.map((row) => ({
			assetRecordId: row.assetRecordId,
			assetVersionId: row.assetVersionId,
			contractRevisionId: row.contractRevisionId,
			createdAt: iso(row.createdAt),
			id: row.id,
			record: row.record,
		})),
		generationPackages: rows.generationPackages.map((row) => ({
			assetRecordId: row.assetRecordId,
			createdAt: iso(row.createdAt),
			id: row.id,
			snapshot: row.snapshot,
		})),
		legacyAttestations: rows.attestations.map((row) => ({
			assetVersionId: row.versionId,
			createdAt: iso(row.createdAt),
			historyUnknown: row.historyUnknown,
			id: row.id,
			knownSource: row.knownSource,
			supportingEvidence: row.supportingEvidence,
			unknownHistoryDetails: row.unknownHistoryDetails,
			userRelationship: row.userRelationship,
		})),
		manualImportEvidence: rows.manualEvidence.map((row) => ({
			assetRecordId: row.assetRecordId,
			assetVersionId: row.versionId,
			createdAt: iso(row.createdAt),
			generationInstruction: row.generationInstruction,
			generationPackageId: row.generationPackageId,
			id: row.id,
			revision: row.revision,
			sourceSurface: row.sourceSurface,
		})),
		metadataDecisions: rows.finalizations.map((row) => ({
			assetRecordId: row.assetRecordId,
			assetVersionId: row.assetVersionId,
			createdAt: iso(row.createdAt),
			decisions: row.decisions,
			id: row.proposalId,
			status: row.status,
		})),
		metadataProposals: rows.proposals.map((row) => ({
			createdAt: iso(row.createdAt),
			id: row.id,
			proposal: row.proposal,
			sourceEntryId: row.sourceEntryId,
		})),
		providerGenerationRecords: rows.providerRecords.map((row) => ({
			actualHeight: row.actualHeight,
			actualWidth: row.actualWidth,
			assetRecordId: row.assetRecordId,
			assetVersionId: row.assetVersionId,
			createdAt: iso(row.createdAt),
			id: row.id,
			interface: row.interface,
			model: row.model,
			modelVersion: row.modelVersion,
			palette: row.palette,
			parameterSnapshot: row.parameterSnapshot,
			provider: row.provider,
			referenceIds: row.referenceIds,
			requestedHeight: row.requestedHeight,
			requestedWidth: row.requestedWidth,
			seed: row.seed ?? null,
		})),
		recipeVersions: rows.recipeVersions.map((row) => ({
			content: row.content,
			createdAt: iso(row.createdAt),
			id: row.id,
			note: row.note,
			recipeId: row.recipeId,
			versionNumber: row.versionNumber,
		})),
		recipes: rows.recipes.map((row) => ({
			createdAt: iso(row.createdAt),
			id: row.id,
			sourceAssetRecordId: row.sourceAssetRecordId,
			sourceExperimentId: row.sourceExperimentId,
			sourceGenerationPackageId: row.sourceGenerationPackageId,
			sourceTrialId: row.sourceTrialId,
			title: row.title,
		})),
		reviews: rows.reviews.flatMap(({ kind, rows: reviewRows }) =>
			reviewRows.map((row) => ({
				assetFamilyId: row.assetFamilyId ?? null,
				canonicalDesignId: row.canonicalDesignId ?? null,
				contractRevisionId: row.contractRevisionId ?? null,
				createdAt: iso(row.createdAt),
				id: row.id,
				kind,
				record: row.record,
			}))
		),
		rightsRecords: rows.rights.map((row) => ({
			assertedScope: row.assertedScope,
			assetRecordId: row.assetRecordId,
			createdAt: iso(row.createdAt),
			evidence: row.evidence,
			evidenceFile: row.evidenceFile
				? {
						byteSize: row.evidenceFile.contentLength,
						contentType: row.evidenceFile.sourceContentType,
						fileName: row.evidenceFile.fileName,
						sha256: row.evidenceFile.sha256,
					}
				: null,
			id: row.id,
			referenceId: row.referenceId,
			restrictions: row.restrictions,
			rightsHolderOrProvider: row.rightsHolderOrProvider,
			source: row.source,
			state: row.state,
			uncertainty: row.uncertainty,
			versionNumber: row.versionNumber,
		})),
	};
	const files: ProjectArchiveSourceFile[] = rows.rights.flatMap((row) =>
		row.evidenceFile
			? [
					{
						assetRecordId: row.assetRecordId,
						assetVersionId: null,
						byteSize: row.evidenceFile.contentLength,
						contentType: row.evidenceFile.sourceContentType,
						fileName: row.evidenceFile.fileName,
						kind: "rights_evidence_file" as const,
						objectKey: row.evidenceFile.objectKey,
						sha256: row.evidenceFile.sha256,
						sourceId: row.id,
					},
				]
			: []
	);
	return { files, history };
}

/**
 * The review tables share the columns read here (id, project, record, creation
 * time, and optionally family, canonical design and contract revision); this
 * names that shared shape once.
 */
const reviewTable = (table: unknown) => table as typeof iconFamilyReviews;

/** One source table per review kind, all of them keyed by project. */
const reviewTables: [ReviewKind, typeof iconFamilyReviews][] = [
	["animation_timing", reviewTable(animationTimingReviews)],
	["asset_family_comparison", reviewTable(assetFamilyComparisons)],
	["background_layer_layout", reviewTable(backgroundLayerLayouts)],
	["background_scrolling_test", reviewTable(backgroundScrollingTests)],
	["directional", reviewTable(directionalReviews)],
	["icon_family", reviewTable(iconFamilyReviews)],
	["marketing_usage", reviewTable(marketingUsageReviews)],
	["portrait_identity", reviewTable(portraitIdentityReviews)],
	["scene_qa_playground", reviewTable(sceneQaPlaygrounds)],
	["texture_repetition", reviewTable(textureRepetitionReviews)],
	["tileset_adjacency", reviewTable(tilesetAdjacencyReviews)],
	["ui_state_comparison", reviewTable(uiStateComparisons)],
	["ui_stretch_test", reviewTable(uiStretchTests)],
	["vfx_appearance", reviewTable(vfxAppearanceReviews)],
	["vfx_synchronization", reviewTable(vfxSynchronizationReviews)],
];

/** Reads the production and review history of one project the caller already owns. */
export async function readProjectArchiveHistory(
	db: Database,
	projectId: string
): Promise<{ files: ProjectArchiveSourceFile[]; history: HistoryRecords }> {
	const reviews = await Promise.all(
		reviewTables.map(async ([kind, table]) => ({
			kind,
			rows: (await db
				.select()
				.from(table)
				.where(eq(table.projectId, projectId))) as ReviewRow[],
		}))
	);
	const [
		attestations,
		experiments,
		finalizations,
		gameplayMetadata,
		packages,
		manualEvidence,
		proposals,
		providerRecords,
		recipeVersions,
		recipes,
		rights,
		trials,
	] = await Promise.all([
		db
			.select()
			.from(legacyAssetAttestations)
			.where(eq(legacyAssetAttestations.projectId, projectId)),
		db
			.select()
			.from(productionExperiments)
			.where(eq(productionExperiments.projectId, projectId)),
		db
			.select()
			.from(sourceMetadataMappingFinalizations)
			.where(eq(sourceMetadataMappingFinalizations.projectId, projectId)),
		db
			.select()
			.from(gameplayMetadataRecords)
			.where(eq(gameplayMetadataRecords.projectId, projectId)),
		db
			.select()
			.from(generationPackages)
			.where(eq(generationPackages.projectId, projectId)),
		db
			.select()
			.from(manualImportEvidence)
			.where(eq(manualImportEvidence.projectId, projectId)),
		db
			.select()
			.from(sourceMetadataMappingProposals)
			.where(eq(sourceMetadataMappingProposals.projectId, projectId)),
		db
			.select()
			.from(providerGenerationRecords)
			.where(eq(providerGenerationRecords.projectId, projectId)),
		db
			.select()
			.from(productionRecipeVersions)
			.where(eq(productionRecipeVersions.projectId, projectId)),
		db
			.select()
			.from(productionRecipes)
			.where(eq(productionRecipes.projectId, projectId)),
		db
			.select()
			.from(rightsRecords)
			.where(eq(rightsRecords.projectId, projectId)),
		db
			.select()
			.from(productionExperimentTrials)
			.where(eq(productionExperimentTrials.projectId, projectId)),
	]);
	// Contract revisions are shared across projects; only those this history uses travel.
	const contractIds = [
		...new Set([
			...reviews.flatMap(({ rows }) =>
				rows.flatMap((row) =>
					row.contractRevisionId ? [row.contractRevisionId] : []
				)
			),
			...gameplayMetadata.map((row) => row.contractRevisionId),
		]),
	];
	const contractRevisions =
		contractIds.length === 0
			? []
			: await db
					.select()
					.from(specializedProfileContractRevisions)
					.where(inArray(specializedProfileContractRevisions.id, contractIds));
	return mapHistoryRows({
		attestations,
		contractRevisions,
		experiments,
		finalizations,
		gameplayMetadata,
		generationPackages: packages,
		manualEvidence,
		proposals,
		providerRecords,
		recipeVersions,
		recipes,
		reviews,
		rights,
		trials,
	});
}
