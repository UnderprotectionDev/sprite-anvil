import { expect, test } from "bun:test";
import { historySectionSchemas } from "@sprite-anvil/api/project-archive-history";
import {
	type HistoryRows,
	mapHistoryRows,
} from "../project-archive-history-reader";

const at = new Date("2026-11-02T09:00:00.000Z");
const empty: HistoryRows = {
	attestations: [],
	contractRevisions: [],
	experiments: [],
	finalizations: [],
	gameplayMetadata: [],
	generationPackages: [],
	manualEvidence: [],
	proposals: [],
	providerRecords: [],
	recipeVersions: [],
	recipes: [],
	reviews: [],
	rights: [],
	trials: [],
};

test("source rows become archive records without the user who made them or any storage location", () => {
	const { files, history } = mapHistoryRows({
		...empty,
		experiments: [
			{
				assetRecordId: "rec-1",
				concludedAt: null,
				concludedByUserId: null,
				createdAt: at,
				createdByUserId: "user-1",
				id: "exp-1",
				outcome: null,
				outcomeNote: null,
				projectId: "p",
				selectedTrialId: null,
				title: "Silhouette",
			},
		],
		reviews: [
			{
				kind: "directional",
				rows: [
					{
						assetFamilyId: "fam-1",
						canonicalDesignId: "design-1",
						contractRevisionId: "contract-1",
						createdAt: at,
						createdByUserId: "user-1",
						id: "rev-1",
						record: { verdict: "ok" },
					} as never,
				],
			},
		],
		rights: [
			{
				assertedScope: null,
				assetRecordId: "rec-1",
				createdAt: at,
				createdByUserId: "user-1",
				evidence: null,
				evidenceFile: {
					contentLength: 10,
					fileName: "licence.pdf",
					objectKey: "projects/p/rights/licence",
					sha256: "f".repeat(64),
					sourceContentType: "application/pdf",
				},
				id: "rights-1",
				projectId: "p",
				referenceId: null,
				restrictions: null,
				rightsHolderOrProvider: null,
				source: null,
				state: "documented",
				uncertainty: null,
				versionNumber: 1,
			},
		],
	});

	for (const [name, schema] of Object.entries(historySectionSchemas)) {
		for (const record of history[name as keyof typeof history]) {
			expect(schema.safeParse(record).success).toBe(true);
		}
	}
	expect(JSON.stringify(history)).not.toContain("user-1");
	expect(JSON.stringify(history)).not.toContain("projects/p/");
	expect(history.reviews).toMatchObject([
		{ canonicalDesignId: "design-1", id: "rev-1", kind: "directional" },
	]);
	expect(files).toMatchObject([
		{
			kind: "rights_evidence_file",
			objectKey: "projects/p/rights/licence",
			sha256: "f".repeat(64),
			sourceId: "rights-1",
		},
	]);
});

test("a review kind without a family or contract keeps those links empty", () => {
	const { history } = mapHistoryRows({
		...empty,
		reviews: [
			{
				kind: "scene_qa_playground",
				rows: [{ createdAt: at, id: "qa-1", record: {} }],
			},
		],
	});
	expect(history.reviews).toEqual([
		{
			assetFamilyId: null,
			canonicalDesignId: null,
			contractRevisionId: null,
			createdAt: at.toISOString(),
			id: "qa-1",
			kind: "scene_qa_playground",
			record: {},
		},
	]);
});
