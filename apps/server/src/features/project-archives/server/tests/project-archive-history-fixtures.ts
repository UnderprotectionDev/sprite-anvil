import type { ProjectArchiveSource } from "@sprite-anvil/api/project-archives";
import { digest, foundationSource, ids } from "./project-archive-fixtures";

export const historyIds = {
	contractRevision: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01",
	experiment: "cccccccc-cccc-4ccc-8ccc-cccccccccc01",
	generationPackage: "dddddddd-dddd-4ddd-8ddd-dddddddddd01",
	manualEvidence: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01",
	proposal: "ffffffff-ffff-4fff-8fff-ffffffffff01",
	recipe: "12121212-1212-4212-8212-121212121201",
	recipeVersion: "12121212-1212-4212-8212-121212121202",
	review: "13131313-1313-4313-8313-131313131301",
	rights: "14141414-1414-4414-8414-141414141401",
	trial: "15151515-1515-4515-8515-151515151501",
};

/** A foundation source plus a populated production and review history group. */
export function historySource(): ProjectArchiveSource {
	const source = foundationSource();
	source.history = {
		contractRevisions: [
			{
				contractSchemaVersion: "asset-profile/1.0.0",
				contractVersion: "1.0.0",
				createdAt: "2026-11-01T08:00:00.000Z",
				definition: { rules: ["eight directions"] },
				id: historyIds.contractRevision,
				profileId: "character",
			},
		],
		experimentTrials: [
			{
				assetRecordId: ids.record,
				assetVersionId: ids.version2,
				createdAt: "2026-11-03T09:00:00.000Z",
				experimentId: historyIds.experiment,
				generationPackageId: historyIds.generationPackage,
				id: historyIds.trial,
				label: "Trial A",
				position: 0,
			},
		],
		experiments: [
			{
				assetRecordId: ids.record,
				concludedAt: "2026-11-04T09:00:00.000Z",
				createdAt: "2026-11-03T08:00:00.000Z",
				id: historyIds.experiment,
				outcome: "selection_made",
				outcomeNote: "A reads better at 1x.",
				selectedTrialId: historyIds.trial,
				title: "Idle silhouette",
			},
		],
		gameplayMetadata: [],
		generationPackages: [
			{
				assetRecordId: ids.record,
				createdAt: "2026-11-03T07:00:00.000Z",
				id: historyIds.generationPackage,
				snapshot: { instruction: "hero idle, side view" },
			},
		],
		legacyAttestations: [],
		manualImportEvidence: [
			{
				assetRecordId: ids.record,
				assetVersionId: ids.version2,
				createdAt: "2026-11-03T10:30:00.000Z",
				generationInstruction: "hero idle, side view",
				generationPackageId: historyIds.generationPackage,
				id: historyIds.manualEvidence,
				revision: 1,
				sourceSurface: "external image tool",
			},
		],
		metadataDecisions: [
			{
				assetRecordId: ids.record,
				assetVersionId: ids.version2,
				createdAt: "2026-11-03T12:30:00.000Z",
				decisions: [{ field: "tags", value: "accepted" }],
				id: historyIds.proposal,
				status: "completed",
			},
		],
		metadataProposals: [
			{
				createdAt: "2026-11-03T12:00:00.000Z",
				id: historyIds.proposal,
				proposal: { tags: ["hero"] },
				sourceEntryId: "inbox-entry-1",
			},
		],
		providerGenerationRecords: [],
		recipeVersions: [
			{
				content: {
					expectedOutputStructure: "one frame",
					fields: [],
					instructionSkeleton: "draw {subject}",
					referenceRoles: [],
				},
				createdAt: "2026-11-05T08:00:00.000Z",
				id: historyIds.recipeVersion,
				note: null,
				recipeId: historyIds.recipe,
				versionNumber: 1,
			},
		],
		recipes: [
			{
				createdAt: "2026-11-05T07:00:00.000Z",
				id: historyIds.recipe,
				sourceAssetRecordId: ids.record,
				sourceExperimentId: historyIds.experiment,
				sourceGenerationPackageId: historyIds.generationPackage,
				sourceTrialId: historyIds.trial,
				title: "Idle recipe",
			},
		],
		reviews: [
			{
				assetFamilyId: ids.family,
				canonicalDesignId: null,
				contractRevisionId: historyIds.contractRevision,
				createdAt: "2026-11-04T10:00:00.000Z",
				id: historyIds.review,
				kind: "icon_family",
				record: { verdict: "consistent" },
			},
		],
		rightsRecords: [
			{
				assertedScope: "commercial",
				assetRecordId: ids.record,
				createdAt: "2026-11-02T09:00:00.000Z",
				evidence: null,
				evidenceFile: {
					byteSize: 400_000,
					contentType: "application/pdf",
					fileName: "licence.pdf",
					sha256: digest("f"),
				},
				id: historyIds.rights,
				referenceId: null,
				restrictions: null,
				rightsHolderOrProvider: "Studio",
				source: "commissioned",
				state: "documented",
				uncertainty: null,
				versionNumber: 1,
			},
		],
	};
	source.files.push({
		assetRecordId: ids.record,
		assetVersionId: null,
		byteSize: 400_000,
		contentType: "application/pdf",
		fileName: "licence.pdf",
		kind: "rights_evidence_file",
		objectKey: "projects/p/rights/licence",
		sha256: digest("f"),
		sourceId: historyIds.rights,
	});
	return source;
}
