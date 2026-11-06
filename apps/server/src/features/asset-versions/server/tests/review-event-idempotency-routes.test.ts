import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import { createVersionProductionEvidence } from "@sprite-anvil/api/production-provenance";
import {
	IdempotencyConflictError,
	RecordIntegrityError,
} from "@sprite-anvil/api/record-publication";
import { appRouter } from "@sprite-anvil/api/routers/index";

const projectId = "project-replay";
const assetVersionId = "version-replay";
const createdAt = "2026-11-06T12:00:00.000Z";

function context(
	reviewDisposition: "candidate" | "approved",
	recordReviewEvent: () => unknown
) {
	return {
		assetRecordTrackingStore: {
			getTracking: async () => ({
				tracking: {
					manualImportEvidence: [],
					manualImportEvidenceRequiredVersionIds: [],
				},
			}),
		},
		assetVersionStore: {
			list: async () => ({
				assetVersions: [
					{
						assetFamilyId: "family-1",
						assetRecordId: "record-1",
						contentDigest: "a".repeat(64),
						contentLength: 68,
						contentType: "image/png" as const,
						createdAt,
						id: assetVersionId,
						integrityVerified: true,
						previewUrl: `/api/projects/${projectId}/asset-versions/${assetVersionId}/preview`,
						productionEvidence: createVersionProductionEvidence("legacy_asset"),
						projectId,
						reviewDisposition,
						reviewEvents: [],
						sourceKind: "legacy_asset" as const,
						versionNumber: 1,
					},
				],
				canonicalDesigns: [],
				compositeVersions: [],
				unitVersions: [],
			}),
			recordReviewEvent,
		},
		session: { user: { id: "user-1" } },
		verifyAssetVersionContent: async () => true,
	};
}

const review = {
	assetVersionId,
	decision: "approved" as const,
	idempotencyKey: "request-1",
	projectId,
	rationale: "Ready for the library.",
};

test("a keyed repeat of an applied decision replays the first Review Event instead of failing", async () => {
	const event = {
		assetVersionId,
		createdAt,
		id: "event-first",
		rationale: review.rationale,
		type: "approved",
	};
	const result = await call(appRouter.assetVersions.review, review, {
		context: context("approved", () => event) as never,
	});
	expect(result.id).toBe("event-first");
});

test("an unkeyed repeat of an applied decision is still rejected", async () => {
	const { idempotencyKey: _key, ...unkeyed } = review;
	await expect(
		call(appRouter.assetVersions.review, unkeyed, {
			context: context("approved", () => null) as never,
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("a key reused with different content surfaces as a user-facing conflict", async () => {
	await expect(
		call(appRouter.assetVersions.review, review, {
			context: context("candidate", () => {
				throw new IdempotencyConflictError("Review Event");
			}) as never,
		})
	).rejects.toMatchObject({ code: "CONFLICT" });
});

test("a digest or relation failure surfaces as a retryable conflict, not an internal error", async () => {
	await expect(
		call(appRouter.assetVersions.review, review, {
			context: context("candidate", () => {
				throw new RecordIntegrityError("digest mismatch");
			}) as never,
		})
	).rejects.toMatchObject({ code: "CONFLICT" });
});
