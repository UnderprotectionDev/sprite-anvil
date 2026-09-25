import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import { appRouter } from "@sprite-anvil/api/routers/index";

const projectId = "project-lineage";
const userId = "user-lineage";
const familyId = "family-gameplay";
const sourceAssetRecordId = "asset-canonical";
const targetAssetRecordId = "asset-derivative";
const assetVersionId = "version-canonical-v1";
const createdAt = "2026-09-25T12:00:00.000Z";

test("records a derivative against the approved Canonical Design version", async () => {
	const version = {
		id: assetVersionId,
		projectId,
		assetFamilyId: familyId,
		assetRecordId: sourceAssetRecordId,
		versionNumber: 1,
		contentType: "image/png",
		contentLength: 68,
		contentDigest: "a".repeat(64),
		integrityVerified: true,
		previewUrl: `/api/projects/${projectId}/asset-versions/${assetVersionId}/preview`,
		reviewDisposition: "candidate",
		reviewEvents: [
			{
				id: "event-candidate",
				assetVersionId,
				type: "candidate",
				rationale: null as string | null,
				createdAt,
			},
		],
		createdAt,
	};
	const versionCatalog = {
		assetVersions: [version],
		canonicalDesigns: [] as Record<string, unknown>[],
	};
	const assetFamilyCatalog = {
		subjectIdentities: [],
		assetFamilies: [
			{
				id: familyId,
				projectId,
				subjectIdentityId: "identity-ash",
				name: "Gameplay",
				visualWorldId: "world-gameplay",
				useContext: "gameplay",
				createdAt,
			},
		],
		assetRecords: [
			{
				id: sourceAssetRecordId,
				projectId,
				assetFamilyId: familyId,
				name: "Ash Knight base",
				createdAt,
			},
			{
				id: targetAssetRecordId,
				projectId,
				assetFamilyId: familyId,
				name: "Ash Knight east",
				createdAt,
			},
		],
		relationships: [] as Record<string, unknown>[],
	};
	let selectedCanonicalVersionId: string | null = null;
	const familyStore = {
		list: () => Promise.resolve(assetFamilyCatalog),
		createRelationship: (
			_requestedUserId: string,
			input: Record<string, string>
		) => {
			if (
				input.type === "derivative" &&
				input.sourceAssetVersionId !== selectedCanonicalVersionId
			) {
				return Promise.resolve(null);
			}
			const relationship = {
				id: "relationship-derivative",
				projectId,
				assetFamilyId: familyId,
				sourceAssetRecordId: input.sourceAssetRecordId,
				targetAssetRecordId: input.targetAssetRecordId,
				sourceAssetVersionId: input.sourceAssetVersionId,
				type: "derivative",
				createdAt,
			};
			assetFamilyCatalog.relationships.push(relationship);
			return Promise.resolve(relationship);
		},
	};
	const versionStore = {
		list: () => Promise.resolve(versionCatalog),
		recordReviewEvent: (
			_requestedUserId: string,
			input: {
				assetVersionId: string;
				decision: "candidate" | "approved" | "rejected";
				rationale: string;
			}
		) => {
			if (version.reviewDisposition === input.decision) {
				return Promise.resolve(null);
			}
			const event = {
				id: "event-approved",
				assetVersionId: input.assetVersionId,
				type: input.decision,
				rationale: input.rationale ?? null,
				createdAt,
			};
			version.reviewEvents.push(event);
			version.reviewDisposition = input.decision;
			return Promise.resolve(event);
		},
		selectCanonicalDesign: (
			_requestedUserId: string,
			input: { assetFamilyId: string; assetVersionId: string }
		) => {
			if (
				input.assetFamilyId !== familyId ||
				input.assetVersionId !== assetVersionId ||
				version.reviewDisposition !== "approved"
			) {
				return Promise.resolve(null);
			}
			selectedCanonicalVersionId = input.assetVersionId;
			const canonicalDesign = {
				id: "canonical-selection-1",
				projectId,
				assetFamilyId: input.assetFamilyId,
				assetRecordId: sourceAssetRecordId,
				assetVersionId: input.assetVersionId,
				createdAt,
			};
			versionCatalog.canonicalDesigns.push(canonicalDesign);
			return Promise.resolve(canonicalDesign);
		},
	};
	const context = {
		assetFamilyStore: familyStore,
		assetVersionStore: versionStore,
		verifyAssetVersionContent: () => Promise.resolve(true),
		session: { user: { id: userId } },
	};
	const failedIntegrityContext = {
		...context,
		verifyAssetVersionContent: () => Promise.resolve(false),
	};
	await expect(
		call(
			appRouter.assetVersions.review,
			{
				projectId,
				assetVersionId,
				decision: "approved",
				rationale: "The source content has not passed integrity verification.",
			},
			{ context: failedIntegrityContext as never }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(version.reviewDisposition).toBe("candidate");

	await call(
		appRouter.assetVersions.review,
		{
			projectId,
			assetVersionId,
			decision: "approved",
			rationale: "Verified artwork is ready for the family.",
		},
		{ context: context as never }
	);
	await call(
		appRouter.assetVersions.selectCanonicalDesign,
		{ projectId, assetFamilyId: familyId, assetVersionId },
		{ context: context as never }
	);
	await call(
		appRouter.assetFamilies.createRelationship,
		{
			projectId,
			assetFamilyId: familyId,
			sourceAssetRecordId,
			targetAssetRecordId,
			type: "derivative",
			sourceAssetVersionId: assetVersionId,
		},
		{ context: context as never }
	);

	const rereadFamily = await call(
		appRouter.assetFamilies.list,
		{ projectId },
		{ context: context as never }
	);
	const rereadVersions = await call(
		appRouter.assetVersions.list,
		{ projectId },
		{ context: context as never }
	);

	expect(rereadVersions.assetVersions[0]).toMatchObject({
		id: assetVersionId,
		reviewDisposition: "approved",
		reviewEvents: [
			{ type: "candidate", rationale: null },
			{
				type: "approved",
				rationale: "Verified artwork is ready for the family.",
			},
		],
	});
	expect(rereadVersions.canonicalDesigns[0]).toMatchObject({
		assetFamilyId: familyId,
		assetVersionId,
	});
	expect(rereadFamily.relationships[0]).toMatchObject({
		type: "derivative",
		sourceAssetRecordId,
		sourceAssetVersionId: assetVersionId,
	});
});
