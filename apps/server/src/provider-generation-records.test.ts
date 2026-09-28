import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type {
	ProviderGenerationRecord,
	ProviderGenerationRecordCreateInput,
} from "@sprite-anvil/api/provider-generation-records";
import { appRouter } from "@sprite-anvil/api/routers/index";

const projectId = "00c1bc3a-8c39-436a-892e-0c3a6d37aed2";
const assetVersionId = "a7301990-3d79-49c8-887a-c1fa9a468f85";
const userId = "provider-generation-record-user";

const input: ProviderGenerationRecordCreateInput = {
	actualDimensions: { height: 96, width: 128 },
	assetVersionId,
	interface: "Images API v2",
	model: "pixel-art-v4",
	modelVersion: "2026-08-15",
	palette: ["#202030", "#f4c95d"],
	projectId,
	provider: "Example Provider",
	providerParameters: { steps: 28, sampler: "euler" },
	referenceIds: ["reference-42"],
	requestedDimensions: { height: 96, width: 96 },
	seed: 7231,
};

const record: ProviderGenerationRecord = {
	actualDimensions: input.actualDimensions,
	assetRecordId: "b73b2ff3-cccb-4e3b-bd65-99484d9109ba",
	assetVersionId: input.assetVersionId,
	createdAt: "2026-09-28T08:00:00.000Z",
	id: "5436c215-0cb2-4d5f-a979-cbe8ec5f33f2",
	interface: input.interface,
	model: input.model,
	modelVersion: input.modelVersion,
	palette: input.palette,
	parameterSnapshot: {
		parameters: input.providerParameters,
		schemaVersion: "provider-generation-parameters/1.0.0",
	},
	projectId: input.projectId,
	provider: input.provider,
	referenceIds: input.referenceIds,
	requestedDimensions: input.requestedDimensions,
	seed: input.seed,
};

test("records provider details through the authenticated API", async () => {
	const recordProviderGeneration = Reflect.get(
		appRouter.assetVersions,
		"recordProviderGeneration"
	);
	const context = {
		providerGenerationRecordStore: {
			create: async (
				requestedUserId: string,
				requestedInput: ProviderGenerationRecordCreateInput
			) =>
				requestedUserId === userId &&
				JSON.stringify(requestedInput) === JSON.stringify(input)
					? { kind: "created", record }
					: null,
		},
		session: { user: { id: userId } },
	} as unknown as Context;

	const created = await call(recordProviderGeneration as never, input, {
		context,
	});

	expect(created).toEqual(record);
});

function createReviewContext(
	productionSource: "unknown" | "connected_provider" | "user_reported_provider"
): Context {
	return {
		assetVersionStore: {
			list: async () => ({
				assetVersions: [
					{
						assetFamilyId: "b83b2ff3-cccb-4e3b-bd65-99484d9109ba",
						assetRecordId: record.assetRecordId,
						contentDigest: "a".repeat(64),
						contentLength: 12,
						contentType: "image/png",
						createdAt: record.createdAt,
						id: assetVersionId,
						integrityVerified: true,
						previewUrl: `/api/projects/${projectId}/asset-versions/${assetVersionId}/preview`,
						productionEvidence: {
							evidenceLevel: "unknown",
							managedSnapshots: [],
							manualImportEvidence: null,
							sourceKind: "unknown",
						},
						productionSource,
						projectId,
						reviewDisposition: "candidate",
						reviewEvents: [
							{
								assetVersionId,
								createdAt: record.createdAt,
								id: "a3f77a52-87fc-4305-a8b5-556b635a796d",
								rationale: null,
								type: "candidate",
							},
						],
						versionNumber: 1,
					},
				],
				canonicalDesigns: [],
				unitVersions: [],
				compositeVersions: [],
			}),
			recordReviewEvent: async () => ({
				assetVersionId,
				createdAt: record.createdAt,
				id: "a3f77a52-87fc-4305-a8b5-556b635a796e",
				rationale: "Verified output.",
				type: "approved",
			}),
		},
		providerGenerationRecordStore: { list: async () => [] },
		session: { user: { id: userId } },
		verifyAssetVersionContent: async () => true,
	} as unknown as Context;
}

test("blocks approval until a connected-provider result has its record", async () => {
	const context = createReviewContext("connected_provider");
	await expect(
		call(
			appRouter.assetVersions.review,
			{
				decision: "approved",
				assetVersionId,
				projectId,
				rationale: "Verified output.",
			},
			{ context }
		)
	).rejects.toThrow("needs its Provider Generation Record");
});

test("allows approval when unavailable provider details remain unknown", async () => {
	const context = createReviewContext("unknown");
	await expect(
		call(
			appRouter.assetVersions.review,
			{
				decision: "approved",
				assetVersionId,
				projectId,
				rationale: "Verified output.",
			},
			{ context }
		)
	).resolves.toMatchObject({ assetVersionId, type: "approved" });
});

test("allows approval of user-reported provider details without treating them as verified", async () => {
	const context = createReviewContext("user_reported_provider");
	await expect(
		call(
			appRouter.assetVersions.review,
			{
				decision: "approved",
				assetVersionId,
				projectId,
				rationale: "Reviewed the uploaded image.",
			},
			{ context }
		)
	).resolves.toMatchObject({ assetVersionId, type: "approved" });
});
