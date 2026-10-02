import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { AssetVersionReviewEvent } from "@sprite-anvil/api/asset-versions";
import { createVersionProductionEvidence } from "@sprite-anvil/api/production-provenance";
import { appRouter } from "@sprite-anvil/api/routers/index";

const createdAt = "2026-10-02T12:00:00.000Z";

function reviewContext() {
	const versions = ["version-one", "version-two"].map((id) => ({
		id,
		projectId: "project-review",
		assetFamilyId: "family-review",
		assetRecordId: `record-${id}`,
		versionNumber: 1,
		contentType: "image/png",
		contentLength: 68,
		contentDigest: "a".repeat(64),
		productionEvidence: createVersionProductionEvidence("unknown"),
		integrityVerified: true,
		previewUrl: `/preview/${id}`,
		reviewDisposition: "candidate",
		reviewEvents: [],
		createdAt,
	}));
	return {
		assetVersionStore: {
			list: async () => ({
				assetVersions: versions,
				canonicalDesigns: [],
				unitVersions: [],
				compositeVersions: [],
			}),
			readReviewBlockers: async (): Promise<string[]> => [],
			readBatchReviewEvents: async (): Promise<
				AssetVersionReviewEvent[] | "conflict" | null
			> => null,
			recordBatchReviewEvents: () =>
				Promise.reject(new Error("Blocked batches must not write.")),
		},
		session: { user: { id: "reviewer" } },
		verifyAssetVersionContent: async () => true,
	};
}

test("previews every exact version without recording Review Events", async () => {
	const preview = await call(
		appRouter.assetVersions.previewBatchReview,
		{
			projectId: "project-review",
			assetVersionIds: ["version-one", "version-two"],
			decision: "approved",
		},
		{ context: reviewContext() as never }
	);
	expect(preview.items).toEqual([
		{
			assetVersionId: "version-one",
			expectedReviewEventId: null,
			blockers: [],
		},
		{
			assetVersionId: "version-two",
			expectedReviewEventId: null,
			blockers: [],
		},
	]);
});

test("reports a blocked item and refuses the entire batch", async () => {
	const context = reviewContext();
	context.assetVersionStore.readReviewBlockers = async () => [
		"Required usage test is missing",
	];
	const preview = await call(
		appRouter.assetVersions.previewBatchReview,
		{
			projectId: "project-review",
			assetVersionIds: ["version-one", "version-two"],
			decision: "approved",
		},
		{ context: context as never }
	);
	expect(preview.items).toHaveLength(2);
	expect(preview.items[0]?.blockers).toContain(
		"Required usage test is missing"
	);
	await expect(
		call(
			appRouter.assetVersions.reviewBatch,
			{
				projectId: "project-review",
				idempotencyKey: crypto.randomUUID(),
				decision: "approved",
				rationale: "User accepts the selected versions",
				targets: preview.items.map(
					({ assetVersionId, expectedReviewEventId }) => ({
						assetVersionId,
						expectedReviewEventId,
					})
				),
			},
			{ context: context as never }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("serves an idempotent replay without re-reading the version catalog", async () => {
	const context = reviewContext();
	const replayedEvent: AssetVersionReviewEvent = {
		id: `batch:project-review:${crypto.randomUUID()}:000`,
		assetVersionId: "version-one",
		type: "approved",
		rationale: "Replayed batch decision",
		createdAt,
	};
	context.assetVersionStore.list = () => {
		throw new Error("Replayed batch requests must not re-read the catalog.");
	};
	context.assetVersionStore.readBatchReviewEvents = async () => [replayedEvent];
	const result = await call(
		appRouter.assetVersions.reviewBatch,
		{
			projectId: "project-review",
			idempotencyKey: crypto.randomUUID(),
			decision: "approved",
			rationale: "Replayed batch decision",
			targets: [
				{
					assetVersionId: "version-one",
					expectedReviewEventId: replayedEvent.id,
				},
			],
		},
		{ context: context as never }
	);
	expect(result.reviewEvents).toEqual([replayedEvent]);
});

test("rejects duplicate versions, empty rationales, unknown versions, and unauthenticated previews", async () => {
	const context = reviewContext();
	const preview = {
		projectId: "project-review",
		assetVersionIds: ["version-one"],
		decision: "approved" as const,
	};
	await expect(
		call(
			appRouter.assetVersions.previewBatchReview,
			{ ...preview, assetVersionIds: ["version-one", "version-one"] },
			{ context: context as never }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		call(
			appRouter.assetVersions.previewBatchReview,
			{ ...preview, assetVersionIds: ["unknown-version"] },
			{ context: context as never }
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		call(appRouter.assetVersions.previewBatchReview, preview, {
			context: { ...context, session: null } as never,
		})
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	await expect(
		call(
			appRouter.assetVersions.reviewBatch,
			{
				projectId: "project-review",
				idempotencyKey: crypto.randomUUID(),
				decision: "approved",
				rationale: "   ",
				targets: [
					{ assetVersionId: "version-one", expectedReviewEventId: null },
				],
			},
			{ context: context as never }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
