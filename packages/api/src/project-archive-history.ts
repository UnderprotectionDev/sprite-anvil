import { z } from "zod";
import type {
	FoundationRecords,
	ProjectArchiveFileEntry,
} from "./project-archives";

/**
 * The production and review history record group of a Project Archive:
 * review and quality history, metadata proposals with the user decisions on
 * them, production evidence and experiments, recipes, and rights records.
 * Every record keeps its source id. No record carries the user who made it.
 */

const idSchema = z.string().trim().min(1).max(128);
const timestampSchema = z.iso.datetime();
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const historyGroup = "history";

/** Every review and quality record kind, one source table each. */
export const reviewKinds = [
	"animation_timing",
	"asset_family_comparison",
	"background_layer_layout",
	"background_scrolling_test",
	"directional",
	"icon_family",
	"marketing_usage",
	"portrait_identity",
	"scene_qa_playground",
	"texture_repetition",
	"tileset_adjacency",
	"ui_state_comparison",
	"ui_stretch_test",
	"vfx_appearance",
	"vfx_synchronization",
] as const;

export const rightsRecordStates = [
	"documented",
	"assertion_only",
	"unknown",
	"restricted",
] as const;

export const historySectionSchemas = {
	contractRevisions: z
		.object({
			contractSchemaVersion: z.string(),
			contractVersion: z.string(),
			createdAt: timestampSchema,
			definition: jsonObjectSchema,
			id: idSchema,
			profileId: z.string(),
		})
		.strict(),
	experimentTrials: z
		.object({
			assetRecordId: idSchema,
			assetVersionId: idSchema,
			createdAt: timestampSchema,
			experimentId: idSchema,
			generationPackageId: idSchema,
			id: idSchema,
			label: z.string(),
			position: z.number().int().nonnegative(),
		})
		.strict(),
	experiments: z
		.object({
			assetRecordId: idSchema,
			concludedAt: timestampSchema.nullable(),
			createdAt: timestampSchema,
			id: idSchema,
			outcome: z
				.enum(["selection_made", "inconclusive", "abandoned"])
				.nullable(),
			outcomeNote: z.string().nullable(),
			selectedTrialId: idSchema.nullable(),
			title: z.string(),
		})
		.strict(),
	gameplayMetadata: z
		.object({
			assetRecordId: idSchema,
			assetVersionId: idSchema,
			contractRevisionId: idSchema,
			createdAt: timestampSchema,
			id: idSchema,
			record: jsonObjectSchema,
		})
		.strict(),
	generationPackages: z
		.object({
			assetRecordId: idSchema,
			createdAt: timestampSchema,
			id: idSchema,
			snapshot: jsonObjectSchema,
		})
		.strict(),
	legacyAttestations: z
		.object({
			assetVersionId: idSchema,
			createdAt: timestampSchema,
			historyUnknown: z.boolean(),
			id: idSchema,
			knownSource: z.string().nullable(),
			supportingEvidence: z.string().nullable(),
			unknownHistoryDetails: z.string().nullable(),
			userRelationship: z.enum([
				"created_by_user",
				"received_from_team",
				"licensed_third_party",
				"unknown",
			]),
		})
		.strict(),
	manualImportEvidence: z
		.object({
			assetRecordId: idSchema,
			assetVersionId: idSchema,
			createdAt: timestampSchema,
			generationInstruction: z.string(),
			generationPackageId: idSchema,
			id: idSchema,
			revision: z.number().int().positive(),
			sourceSurface: z.string(),
		})
		.strict(),
	/** One row per finalization; its id is the id of the proposal it decides. */
	metadataDecisions: z
		.object({
			assetRecordId: idSchema,
			assetVersionId: idSchema.nullable(),
			createdAt: timestampSchema,
			decisions: z.unknown(),
			id: idSchema,
			status: z.enum(["pending", "completed"]),
		})
		.strict(),
	metadataProposals: z
		.object({
			createdAt: timestampSchema,
			id: idSchema,
			proposal: z.unknown(),
			/** The import inbox entry the proposal was read from; the inbox is not part of the archive. */
			sourceEntryId: idSchema,
		})
		.strict(),
	providerGenerationRecords: z
		.object({
			actualHeight: z.number().int().positive().nullable(),
			actualWidth: z.number().int().positive().nullable(),
			assetRecordId: idSchema,
			assetVersionId: idSchema,
			createdAt: timestampSchema,
			id: idSchema,
			interface: z.string().nullable(),
			model: z.string().nullable(),
			modelVersion: z.string().nullable(),
			palette: z.array(z.string()),
			parameterSnapshot: jsonObjectSchema,
			provider: z.string(),
			referenceIds: z.array(z.string()),
			requestedHeight: z.number().int().positive().nullable(),
			requestedWidth: z.number().int().positive().nullable(),
			seed: z.union([z.string(), z.number()]).nullable(),
		})
		.strict(),
	recipeVersions: z
		.object({
			content: z
				.object({
					expectedOutputStructure: z.string(),
					fields: z.array(
						z
							.object({
								key: z.string(),
								label: z.string(),
								mode: z.enum(["fixed", "fill_in"]),
								value: z.string().nullable(),
							})
							.strict()
					),
					instructionSkeleton: z.string(),
					referenceRoles: z.array(
						z
							.object({
								customPurpose: z.string().nullable(),
								forbiddenFeatures: z.array(z.string()),
								notes: z.string().nullable(),
								role: z.string(),
								transferredFeatures: z.array(z.string()),
							})
							.strict()
					),
				})
				.strict(),
			createdAt: timestampSchema,
			id: idSchema,
			note: z.string().nullable(),
			recipeId: idSchema,
			versionNumber: z.number().int().positive(),
		})
		.strict(),
	/** Source ids are provenance only: a recipe outlives the experiment it came from. */
	recipes: z
		.object({
			createdAt: timestampSchema,
			id: idSchema,
			sourceAssetRecordId: idSchema.nullable(),
			sourceExperimentId: idSchema.nullable(),
			sourceGenerationPackageId: idSchema.nullable(),
			sourceTrialId: idSchema.nullable(),
			title: z.string(),
		})
		.strict(),
	reviews: z
		.object({
			assetFamilyId: idSchema.nullable(),
			canonicalDesignId: idSchema.nullable(),
			contractRevisionId: idSchema.nullable(),
			createdAt: timestampSchema,
			id: idSchema,
			kind: z.enum(reviewKinds),
			record: jsonObjectSchema,
		})
		.strict(),
	rightsRecords: z
		.object({
			assertedScope: z.string().nullable(),
			assetRecordId: idSchema,
			createdAt: timestampSchema,
			evidence: z.string().nullable(),
			/** Identity, digest and size of the evidence file; the file itself is listed in the manifest. */
			evidenceFile: z
				.object({
					byteSize: z.number().int().positive(),
					contentType: z.string(),
					fileName: z.string(),
					sha256: sha256Schema,
				})
				.strict()
				.nullable(),
			id: idSchema,
			referenceId: idSchema.nullable(),
			restrictions: z.string().nullable(),
			rightsHolderOrProvider: z.string().nullable(),
			source: z.string().nullable(),
			state: z.enum(rightsRecordStates),
			uncertainty: z.string().nullable(),
			versionNumber: z.number().int().positive(),
		})
		.strict(),
} as const;

export type HistorySectionName = keyof typeof historySectionSchemas;
export type HistoryRecords = {
	[Name in HistorySectionName]: z.infer<(typeof historySectionSchemas)[Name]>[];
};

export function emptyHistoryRecords(): HistoryRecords {
	return Object.fromEntries(
		Object.keys(historySectionSchemas).map((name) => [name, []])
	) as unknown as HistoryRecords;
}

/** The foundation ids the history group points into. */
export type HistoryFoundation = Pick<
	FoundationRecords,
	"assetFamilies" | "assetRecords" | "assetVersions" | "canonicalDesigns"
>;

interface RelationScope {
	assetRecords: Set<string>;
	contracts: Set<string>;
	designs: Set<string>;
	families: Set<string>;
	packages: Set<string>;
	versions: Set<string>;
}

const idSet = (list: { id: string }[]) => new Set(list.map((r) => r.id));

function reviewFailures(history: HistoryRecords, scope: RelationScope) {
	const failures: string[] = [];
	for (const review of history.reviews) {
		const ok =
			(review.assetFamilyId === null ||
				scope.families.has(review.assetFamilyId)) &&
			(review.canonicalDesignId === null ||
				scope.designs.has(review.canonicalDesignId)) &&
			(review.contractRevisionId === null ||
				scope.contracts.has(review.contractRevisionId));
		if (!ok) {
			failures.push(`Review ${review.id} points at a missing record.`);
		}
	}
	for (const entry of history.gameplayMetadata) {
		if (
			!(
				scope.assetRecords.has(entry.assetRecordId) &&
				scope.versions.has(entry.assetVersionId) &&
				scope.contracts.has(entry.contractRevisionId)
			)
		) {
			failures.push(
				`Gameplay metadata ${entry.id} points at a missing record.`
			);
		}
	}
	const proposals = idSet(history.metadataProposals);
	for (const decision of history.metadataDecisions) {
		const ok =
			proposals.has(decision.id) &&
			scope.assetRecords.has(decision.assetRecordId) &&
			(decision.assetVersionId === null ||
				scope.versions.has(decision.assetVersionId));
		if (!ok) {
			failures.push(
				`Metadata decision ${decision.id} points at a missing record.`
			);
		}
	}
	return failures;
}

function evidenceFailures(history: HistoryRecords, scope: RelationScope) {
	const failures: string[] = [];
	const missing = (label: string, id: string) =>
		failures.push(`${label} ${id} points at a missing record.`);
	for (const entry of history.generationPackages) {
		if (!scope.assetRecords.has(entry.assetRecordId)) {
			missing("Generation package", entry.id);
		}
	}
	for (const entry of history.providerGenerationRecords) {
		if (
			!(
				scope.assetRecords.has(entry.assetRecordId) &&
				scope.versions.has(entry.assetVersionId)
			)
		) {
			missing("Provider generation record", entry.id);
		}
	}
	for (const entry of history.manualImportEvidence) {
		if (
			!(
				scope.assetRecords.has(entry.assetRecordId) &&
				scope.versions.has(entry.assetVersionId) &&
				scope.packages.has(entry.generationPackageId)
			)
		) {
			missing("Manual import evidence", entry.id);
		}
	}
	for (const entry of history.legacyAttestations) {
		if (!scope.versions.has(entry.assetVersionId)) {
			missing("Legacy attestation", entry.id);
		}
	}
	return failures;
}

function experimentFailures(history: HistoryRecords, scope: RelationScope) {
	const failures: string[] = [];
	const experiments = idSet(history.experiments);
	const trialsOf = new Map<string, Set<string>>();
	for (const trial of history.experimentTrials) {
		const set = trialsOf.get(trial.experimentId) ?? new Set<string>();
		set.add(trial.id);
		trialsOf.set(trial.experimentId, set);
	}
	for (const experiment of history.experiments) {
		const selection = experiment.selectedTrialId;
		if (
			!(
				scope.assetRecords.has(experiment.assetRecordId) &&
				(selection === null || trialsOf.get(experiment.id)?.has(selection))
			)
		) {
			failures.push(
				`Experiment ${experiment.id} points at a missing record or a trial that is not its own.`
			);
		}
	}
	for (const trial of history.experimentTrials) {
		if (
			!(
				experiments.has(trial.experimentId) &&
				scope.assetRecords.has(trial.assetRecordId) &&
				scope.versions.has(trial.assetVersionId) &&
				scope.packages.has(trial.generationPackageId)
			)
		) {
			failures.push(`Experiment trial ${trial.id} points at a missing record.`);
		}
	}
	const recipes = idSet(history.recipes);
	for (const version of history.recipeVersions) {
		if (!recipes.has(version.recipeId)) {
			failures.push(`Recipe version ${version.id} points at a missing recipe.`);
		}
	}
	return failures;
}

function rightsFailures(
	history: HistoryRecords,
	scope: RelationScope,
	files: Pick<
		ProjectArchiveFileEntry,
		"byteSize" | "kind" | "sha256" | "sourceId"
	>[]
) {
	const failures: string[] = [];
	const evidenceFiles = new Map(
		files
			.filter((file) => file.kind === "rights_evidence_file")
			.map((file) => [file.sourceId, file])
	);
	for (const rights of history.rightsRecords) {
		if (!scope.assetRecords.has(rights.assetRecordId)) {
			failures.push(
				`Rights record ${rights.id} points at a missing Asset Record.`
			);
		}
		const listed = evidenceFiles.get(rights.id);
		const evidence = rights.evidenceFile;
		const matches = evidence
			? listed?.sha256 === evidence.sha256 &&
				listed.byteSize === evidence.byteSize
			: listed === undefined;
		if (!matches) {
			failures.push(
				`Rights record ${rights.id} does not match its evidence file entry.`
			);
		}
	}
	const rightsIds = idSet(history.rightsRecords);
	for (const sourceId of evidenceFiles.keys()) {
		if (!rightsIds.has(sourceId)) {
			failures.push(
				`Evidence file ${sourceId} points at a missing rights record.`
			);
		}
	}
	return failures;
}

/**
 * The relations that must hold for the history group: every link points at a
 * record the archive holds, an experiment's selection is one of its own
 * trials, and a rights evidence file matches its manifest entry.
 */
export function historyRelationFailures(
	history: HistoryRecords,
	foundation: HistoryFoundation,
	files: Pick<
		ProjectArchiveFileEntry,
		"byteSize" | "kind" | "sha256" | "sourceId"
	>[]
): string[] {
	const scope: RelationScope = {
		assetRecords: idSet(foundation.assetRecords),
		contracts: idSet(history.contractRevisions),
		designs: idSet(foundation.canonicalDesigns),
		families: idSet(foundation.assetFamilies),
		packages: idSet(history.generationPackages),
		versions: idSet(foundation.assetVersions),
	};
	return [
		...reviewFailures(history, scope),
		...evidenceFailures(history, scope),
		...experimentFailures(history, scope),
		...rightsFailures(history, scope, files),
	];
}
