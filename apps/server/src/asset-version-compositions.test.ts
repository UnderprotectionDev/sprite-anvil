import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type {
	AssetVersion,
	CompositeVersion,
	UnitVersion,
} from "@sprite-anvil/api/asset-versions";
import { appRouter } from "@sprite-anvil/api/routers/index";

const projectId = "project-compositions";
const assetRecordId = "asset-record-knight";
const userId = "user-compositions";
const createdAt = "2026-09-27T12:00:00.000Z";

test("creates a Candidate Composite Version from exact Unit Versions and reviews it separately", async () => {
	const unitVersions: UnitVersion[] = [
		{
			id: "unit-frame-v1",
			projectId,
			assetRecordId,
			assetVersionId: "asset-version-frame-v1",
			sourceAssetVersionId: "asset-version-source",
			unitType: "frame",
			unitKey: "attack/frame-3",
			versionNumber: 1,
			createdAt,
		},
		{
			id: "unit-frame-v2",
			projectId,
			assetRecordId,
			assetVersionId: "asset-version-frame-v2",
			sourceAssetVersionId: "asset-version-frame-v1",
			unitType: "frame",
			unitKey: "attack/frame-3",
			versionNumber: 2,
			createdAt,
		},
		{
			id: "unit-direction-north-v1",
			projectId,
			assetRecordId,
			assetVersionId: "asset-version-direction-north-v1",
			sourceAssetVersionId: "asset-version-source",
			unitType: "direction",
			unitKey: "north",
			versionNumber: 1,
			createdAt,
		},
	];
	const approvedUnitAssetVersions: AssetVersion[] = [
		"asset-version-frame-v1",
		"asset-version-frame-v2",
		"asset-version-direction-north-v1",
	].map((id, index) => ({
		id,
		projectId,
		assetFamilyId: "family-knight",
		assetRecordId,
		versionNumber: index + 1,
		contentType: "image/png" as const,
		contentLength: 128,
		contentDigest: "a".repeat(64),
		productionEvidence: {
			evidenceLevel: "unknown" as const,
			managedSnapshots: [],
			manualImportEvidence: null,
			sourceKind: "unknown" as const,
		},
		integrityVerified: true,
		previewUrl: `/api/projects/${projectId}/asset-versions/${id}/preview`,
		reviewDisposition: "approved" as const,
		reviewEvents: [],
		createdAt,
	}));
	const oldCompositeVersion: CompositeVersion = {
		id: "composite-v1",
		projectId,
		assetRecordId,
		versionNumber: 1,
		reviewDisposition: "approved" as const,
		reviewEvents: [
			{
				id: "composite-review-v1",
				compositeVersionId: "composite-v1",
				type: "approved" as const,
				rationale: "The earlier composition was accepted.",
				createdAt,
			},
		],
		compositionMemberships: [
			{
				id: "membership-frame-v1",
				projectId,
				assetRecordId,
				compositeVersionId: "composite-v1",
				unitVersionId: "unit-frame-v1",
				unitType: "frame" as const,
				unitKey: "attack/frame-3",
				createdAt,
			},
			{
				id: "membership-direction-v1",
				projectId,
				assetRecordId,
				compositeVersionId: "composite-v1",
				unitVersionId: "unit-direction-north-v1",
				unitType: "direction" as const,
				unitKey: "north",
				createdAt,
			},
		],
		createdAt,
	};
	const state: {
		assetVersions: AssetVersion[];
		unitVersions: UnitVersion[];
		compositeVersions: CompositeVersion[];
	} = {
		assetVersions: approvedUnitAssetVersions,
		unitVersions,
		compositeVersions: [oldCompositeVersion],
	};
	const compositeVersionStore = {
		list(requestingUserId: string, requestedProjectId: string) {
			return requestingUserId === userId && requestedProjectId === projectId
				? {
						assetVersions: state.assetVersions,
						canonicalDesigns: [],
						unitVersions: state.unitVersions,
						compositeVersions: state.compositeVersions,
					}
				: null;
		},
		createCompositeVersion(
			requestingUserId: string,
			input: {
				assetRecordId: string;
				idempotencyKey: string;
				projectId: string;
				unitVersionIds: string[];
			}
		) {
			if (
				requestingUserId !== userId ||
				input.projectId !== projectId ||
				input.assetRecordId !== assetRecordId
			) {
				return Promise.resolve(null);
			}
			const id = `composite-v${state.compositeVersions.length + 1}`;
			const memberships = input.unitVersionIds.map((unitVersionId) => {
				const unitVersion = state.unitVersions.find(
					(candidate) => candidate.id === unitVersionId
				);
				if (!unitVersion) {
					throw new Error("Expected selected Unit Version");
				}
				return {
					id: `membership-${id}-${unitVersion.id}`,
					projectId,
					assetRecordId,
					compositeVersionId: id,
					unitVersionId,
					unitType: unitVersion.unitType,
					unitKey: unitVersion.unitKey,
					createdAt,
				};
			});
			const compositeVersion = {
				id,
				projectId,
				assetRecordId,
				versionNumber: state.compositeVersions.length + 1,
				reviewDisposition: "candidate" as const,
				reviewEvents: [
					{
						id: `composite-review-${id}`,
						compositeVersionId: id,
						type: "candidate" as const,
						rationale: null,
						createdAt,
					},
				],
				compositionMemberships: memberships,
				createdAt,
			};
			state.compositeVersions.push(compositeVersion);
			return Promise.resolve({ kind: "created", compositeVersion });
		},
		recordCompositeVersionReviewEvent(
			requestingUserId: string,
			input: {
				compositeVersionId: string;
				decision: "candidate" | "approved" | "rejected";
				rationale: string;
			}
		) {
			const compositeVersion = state.compositeVersions.find(
				(candidate) => candidate.id === input.compositeVersionId
			);
			if (requestingUserId !== userId || !compositeVersion) {
				return Promise.resolve(null);
			}
			const event = {
				id: "composite-review-new",
				compositeVersionId: input.compositeVersionId,
				type: input.decision,
				rationale: input.rationale,
				createdAt,
			};
			compositeVersion.reviewEvents.push(event);
			compositeVersion.reviewDisposition = input.decision;
			return Promise.resolve(event);
		},
	};
	const context = {
		assetVersionStore: compositeVersionStore,
		session: { user: { id: userId } },
	};
	const oldCompositeVersionBefore = structuredClone(oldCompositeVersion);
	const unitVersionsBefore = structuredClone(unitVersions);

	await call(
		appRouter.assetVersions.createCompositeVersion,
		{
			projectId,
			assetRecordId,
			unitVersionIds: ["unit-frame-v2", "unit-direction-north-v1"],
			idempotencyKey: "repair-one-frame-and-preserve-direction",
		},
		{ context: context as never }
	);

	const reread = await call(
		appRouter.assetVersions.list,
		{ projectId },
		{ context: context as never }
	);
	expect(reread.compositeVersions).toHaveLength(2);
	expect(reread.compositeVersions[0]).toEqual(oldCompositeVersionBefore);
	expect(reread.compositeVersions[1]).toMatchObject({
		id: "composite-v2",
		versionNumber: 2,
		reviewDisposition: "candidate",
		compositionMemberships: [
			{ unitVersionId: "unit-frame-v2", unitType: "frame" },
			{ unitVersionId: "unit-direction-north-v1", unitType: "direction" },
		],
	});
	expect(reread.unitVersions).toEqual(unitVersionsBefore);
	// The selected unit files are approved above; approval does not carry to this new Composite Version.
	expect(reread.compositeVersions[1]?.reviewDisposition).toBe("candidate");

	await call(
		appRouter.assetVersions.reviewCompositeVersion,
		{
			projectId,
			compositeVersionId: "composite-v2",
			decision: "approved",
			rationale: "The exact frame and direction were reviewed together.",
		},
		{ context: context as never }
	);

	const reviewed = await call(
		appRouter.assetVersions.list,
		{ projectId },
		{ context: context as never }
	);
	expect(reviewed.compositeVersions[0]).toEqual(oldCompositeVersionBefore);
	expect(reviewed.compositeVersions[1]?.reviewDisposition).toBe("approved");
	expect(
		reviewed.assetVersions.every(
			(version) => version.reviewDisposition === "approved"
		)
	).toBe(true);
});
