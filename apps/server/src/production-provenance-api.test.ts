import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type { Context } from "@sprite-anvil/api/context";
import { createVersionProductionEvidence } from "@sprite-anvil/api/production-provenance";
import { appRouter } from "@sprite-anvil/api/routers/index";

const projectId = "a17f5ff0-a50d-438f-8bf2-a0152b42c300";
const assetRecordId = "a17f5ff0-a50d-438f-8bf2-a0152b42c301";
const assetVersionId = "a17f5ff0-a50d-438f-8bf2-a0152b42c302";
const generationPackageId = "a17f5ff0-a50d-438f-8bf2-a0152b42c305";
const userId = "a17f5ff0-a50d-438f-8bf2-a0152b42c306";

const manualCandidateVersion: AssetVersion = {
	assetFamilyId: "a17f5ff0-a50d-438f-8bf2-a0152b42c303",
	assetRecordId,
	contentDigest: "a".repeat(64),
	contentLength: 12,
	contentType: "image/png",
	createdAt: "2026-09-28T12:00:00.000Z",
	id: assetVersionId,
	integrityVerified: true,
	previewUrl:
		"/api/projects/production-provenance-project/asset-versions/preview",
	productionEvidence: {
		evidenceLevel: "incomplete",
		managedSnapshots: [],
		manualImportEvidence: null,
		sourceKind: "manual_import",
	},
	projectId,
	reviewDisposition: "candidate",
	reviewEvents: [],
	versionNumber: 1,
};

test("manual candidates cannot be approved before their import evidence is complete", async () => {
	let reviewWasRecorded = false;
	const context = {
		assetVersionStore: {
			list: () =>
				Promise.resolve({
					assetVersions: [manualCandidateVersion],
					canonicalDesigns: [],
					unitVersions: [],
					compositeVersions: [],
				}),
			recordReviewEvent: () => {
				reviewWasRecorded = true;
				return Promise.resolve({
					assetVersionId,
					createdAt: "2026-09-28T12:00:00.000Z",
					id: "a17f5ff0-a50d-438f-8bf2-a0152b42c304",
					rationale: "The result looks ready.",
					type: "approved" as const,
				});
			},
		},
		session: { user: { id: userId } },
		verifyAssetVersionContent: () => Promise.resolve(true),
	} as unknown as Context;

	await expect(
		call(
			appRouter.assetVersions.review,
			{
				projectId,
				assetVersionId,
				decision: "approved",
				rationale: "The result looks ready.",
			},
			{ context }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(reviewWasRecorded).toBe(false);
});

test("recording manual import evidence completes a candidate and permits approval", async () => {
	let version = manualCandidateVersion;
	let reviewWasRecorded = false;
	const savedEvidence = {
		actualInstruction: "Export the idle pose as a transparent PNG.",
		generationPackageId,
		id: "a17f5ff0-a50d-438f-8bf2-a0152b42c307",
		recordedAt: "2026-09-28T12:30:00.000Z",
		revision: 1,
		sourceSurface: "Aseprite 1.3.15",
	};
	const context = {
		assetVersionStore: {
			list: () =>
				Promise.resolve({
					assetVersions: [version],
					canonicalDesigns: [],
					unitVersions: [],
					compositeVersions: [],
				}),
			saveManualImportEvidence: (
				_requestedUserId: string,
				input: {
					assetRecordId: string;
					generationPackageId: string;
					projectId: string;
					versionId: string;
				}
			) => {
				expect(input).toMatchObject({
					assetRecordId,
					generationPackageId,
					projectId,
					versionId: assetVersionId,
				});
				version = {
					...version,
					productionEvidence: {
						...version.productionEvidence,
						evidenceLevel: "complete",
						manualImportEvidence: savedEvidence,
					},
				};
				return Promise.resolve({
					kind: "created" as const,
					evidence: savedEvidence,
				});
			},
			recordReviewEvent: () => {
				reviewWasRecorded = true;
				return Promise.resolve({
					assetVersionId,
					createdAt: "2026-09-28T12:30:00.000Z",
					id: "a17f5ff0-a50d-438f-8bf2-a0152b42c308",
					rationale: "The result looks ready.",
					type: "approved" as const,
				});
			},
		},
		session: { user: { id: userId } },
		verifyAssetVersionContent: () => Promise.resolve(true),
	} as unknown as Context;

	const evidence = await call(
		appRouter.assetVersions.saveManualImportEvidence,
		{
			actualInstruction: savedEvidence.actualInstruction,
			assetRecordId,
			generationPackageId,
			projectId,
			sourceSurface: savedEvidence.sourceSurface,
			versionId: assetVersionId,
		},
		{ context }
	);
	expect(evidence).toMatchObject({ revision: 1, generationPackageId });

	const event = await call(
		appRouter.assetVersions.review,
		{
			projectId,
			assetVersionId,
			decision: "approved",
			rationale: "The result looks ready.",
		},
		{ context }
	);
	expect(event.type).toBe("approved");
	expect(reviewWasRecorded).toBe(true);
});

test("external working-file edits require a Managed Snapshot before their evidence is complete", () => {
	const incomplete = createVersionProductionEvidence(
		"external_working_file_edit"
	);
	expect(incomplete).toMatchObject({
		evidenceLevel: "incomplete",
		managedSnapshots: [],
		sourceKind: "external_working_file_edit",
	});

	const complete = createVersionProductionEvidence(
		"external_working_file_edit",
		null,
		[
			{
				assetVersionId,
				byteSize: 32,
				createdAt: "2026-09-28T13:00:00.000Z",
				downloadUrl: `/api/projects/${projectId}/managed-snapshots/snapshot/content`,
				fileName: "ash-knight.aseprite",
				id: "a17f5ff0-a50d-438f-8bf2-a0152b42c309",
				sha256: "b".repeat(64),
			},
		]
	);
	expect(complete).toMatchObject({
		evidenceLevel: "complete",
		managedSnapshots: [{ fileName: "ash-knight.aseprite" }],
		sourceKind: "external_working_file_edit",
	});
});

test("linked edit candidates cannot be approved until their Managed Snapshot is saved", async () => {
	let reviewWasRecorded = false;
	let version: AssetVersion = {
		...manualCandidateVersion,
		productionEvidence: {
			evidenceLevel: "incomplete",
			managedSnapshots: [],
			manualImportEvidence: null,
			sourceKind: "external_working_file_edit",
		},
	};
	const context = {
		assetVersionStore: {
			list: () =>
				Promise.resolve({
					assetVersions: [version],
					canonicalDesigns: [],
					unitVersions: [],
					compositeVersions: [],
				}),
			recordReviewEvent: () => {
				reviewWasRecorded = true;
				return Promise.resolve({
					assetVersionId,
					createdAt: "2026-09-28T13:00:00.000Z",
					id: "a17f5ff0-a50d-438f-8bf2-a0152b42c310",
					rationale: "The edited source is ready.",
					type: "approved" as const,
				});
			},
		},
		session: { user: { id: userId } },
		verifyAssetVersionContent: () => Promise.resolve(true),
	} as unknown as Context;
	const reviewInput = {
		projectId,
		assetVersionId,
		decision: "approved" as const,
		rationale: "The edited source is ready.",
	};

	await expect(
		call(appRouter.assetVersions.review, reviewInput, { context })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(reviewWasRecorded).toBe(false);

	version = {
		...version,
		productionEvidence: createVersionProductionEvidence(
			"external_working_file_edit",
			null,
			[
				{
					assetVersionId,
					byteSize: 32,
					createdAt: "2026-09-28T13:00:00.000Z",
					downloadUrl: `/api/projects/${projectId}/managed-snapshots/snapshot/content`,
					fileName: "ash-knight.aseprite",
					id: "a17f5ff0-a50d-438f-8bf2-a0152b42c309",
					sha256: "b".repeat(64),
				},
			]
		),
	};
	const event = await call(appRouter.assetVersions.review, reviewInput, {
		context,
	});
	expect(event.type).toBe("approved");
	expect(reviewWasRecorded).toBe(true);
});
