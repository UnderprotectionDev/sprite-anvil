import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import { assetVersionCreateInputSchema } from "@sprite-anvil/api/asset-record-tracking";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";

const projectId = "44e8fa5d-61ad-43b1-9766-89788268a745";
const assetRecordId = "2a580d46-c4af-4d05-9b4a-461dc679f625";
const versionId = "f7b32d26-6b7c-4e16-a578-dac3e0dab68b";
const userId = "user-asset-record-owner";

test("requires user-declared details for unknown legacy production history", () => {
	const input = {
		assetRecordId,
		contentBase64: "aGVsbG8=",
		contentType: "image/png",
		fileName: "ash-knight.png",
		historyUnknown: true,
		id: versionId,
		knownSource: null,
		projectId,
		supportingEvidence: null,
		unknownHistoryDetails:
			"The original generation instruction is unavailable.",
		userRelationship: "unknown",
	};

	expect(assetVersionCreateInputSchema.safeParse(input).success).toBe(true);
	expect(
		assetVersionCreateInputSchema.safeParse({
			...input,
			unknownHistoryDetails: "  ",
		}).success
	).toBe(false);
	expect(
		assetVersionCreateInputSchema.safeParse({
			...input,
			unknownHistoryDetails: undefined,
		}).success
	).toBe(false);
	expect(
		assetVersionCreateInputSchema.safeParse({
			...input,
			attestedAt: "2020-01-01T00:00:00.000Z",
		}).success
	).toBe(false);
	expect(
		assetVersionCreateInputSchema.safeParse({
			...input,
			providerApiKey: "secret",
		}).success
	).toBe(false);
});

const tracking = {
	availableRecords: [],
	availableVersions: [],
	approvedVersion: {
		createdAt: "2026-09-25T08:01:00.000Z",
		fileName: "ash-knight.png",
		id: versionId,
		reviewDisposition: "approved" as const,
		sha256: "a".repeat(64),
		versionNumber: 1,
	},
	alternatives: [],
	derivatives: [],
	family: null,
	productionHistory: [
		{
			createdAt: "2026-09-25T08:01:00.000Z",
			historyUnknown: true as const,
			id: "0f3c648b-0b67-4b05-9f94-7c2bcd940949",
			kind: "legacy_asset_attestation" as const,
			knownSource: "Imported from the project archive",
			supportingEvidence: "Owner-provided archive note.",
			unknownHistoryDetails:
				"The original generation instruction is unavailable.",
			userRelationship: "received_from_team" as const,
			versionNumber: 1,
		},
	],
	manualImportEvidenceRequiredVersionIds: [],
	quality: {
		integrityStatus: "format_signature_matched" as const,
		profileStatus: "general_support" as const,
		verifiedVersionCount: 1,
	},
	references: [],
	reviewEvents: [],
	visualWorlds: [],
};

function createContext(overrides: Record<string, unknown> = {}) {
	const record = {
		availability: "active" as const,
		createdAt: "2026-09-25T08:00:00.000Z",
		id: assetRecordId,
		identityCriteria: ["independent_product_meaning"],
		name: "Ash Knight",
		projectId,
		supportLevel: "general" as const,
	};
	return {
		assetRecordStore: {} as never,
		assetRecordTrackingStore: {
			getTracking: async () => ({ record, tracking }),
			recordReview: async (...args: unknown[]) => ({
				ok: true as const,
				value: {
					createdAt: "2026-09-25T08:10:00.000Z",
					decision: "approved" as const,
					id: "6c259c96-37e1-4c08-a879-7d7f563d10b7",
					rationale: "Reviewed by the project owner.",
					versionId,
				},
				args,
			}),
		},
		session: { user: { id: userId } },
		...overrides,
	} as unknown as Context;
}

test("reads Asset Record tracking state through the protected API", async () => {
	const result = await call(
		appRouter.assetRecords.tracking,
		{ assetRecordId, projectId },
		{ context: createContext() }
	);

	expect(result.tracking).toEqual(tracking);
	expect(result.record.id).toBe(assetRecordId);
});

test("records a Review Event as the authenticated user", async () => {
	let receivedArgs: unknown[] = [];
	const context = createContext({
		assetRecordTrackingStore: {
			getTracking: async () => ({ record: {} as never, tracking }),
			recordReview: (...args: unknown[]) => {
				receivedArgs = args;
				return Promise.resolve({
					ok: true as const,
					value: {
						createdAt: "2026-09-25T08:10:00.000Z",
						decision: "approved" as const,
						id: "6c259c96-37e1-4c08-a879-7d7f563d10b7",
						rationale: "Reviewed by the project owner.",
						versionId,
					},
				});
			},
		},
	});

	const result = await call(
		appRouter.assetRecords.recordReview,
		{
			assetRecordId,
			decision: "approved",
			id: "6c259c96-37e1-4c08-a879-7d7f563d10b7",
			projectId,
			rationale: "Reviewed by the project owner.",
			versionId,
		},
		{ context }
	);

	expect(result.decision).toBe("approved");
	expect(receivedArgs[0]).toBe(userId);
	expect(receivedArgs[1]).toMatchObject({
		assetRecordId,
		decision: "approved",
		versionId,
	});
});

test("creates a manual import result with its exact production evidence", async () => {
	const input = {
		assetRecordId,
		contentBase64: "aGk=",
		contentType: "image/png" as const,
		fileName: "ash-knight.png",
		generationInstruction:
			"Keep the armor silhouette and add one attack frame.",
		generationPackageId: "c36a3e66-1650-480d-a8df-4019b3305a5c",
		id: "0e3b5194-b0ac-4600-947c-2cf4a606d3ef",
		projectId,
		sourceSurface: "ChatGPT web",
	};
	const savedVersion = {
		createdAt: "2026-09-25T08:10:00.000Z",
		fileName: input.fileName,
		id: input.id,
		sourceKind: "manual_import" as const,
		reviewDisposition: "candidate" as const,
		sha256: "a".repeat(64),
		versionNumber: 2,
	};
	let receivedArgs: unknown[] = [];
	const context = createContext({
		assetRecordTrackingStore: {
			createManualImportVersion: (...args: unknown[]) => {
				receivedArgs = args;
				return Promise.resolve({ ok: true as const, value: savedVersion });
			},
		},
	});

	const result = await call(
		appRouter.assetRecords.createManualImportVersion,
		input,
		{ context }
	);

	expect(result).toEqual(savedVersion);
	expect(receivedArgs[0]).toBe(userId);
	expect(receivedArgs[1]).toEqual(input);
});
