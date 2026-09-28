import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { generationPackageSnapshotSchema } from "@sprite-anvil/api/generation-packages";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb } from "@sprite-anvil/db";
import {
	legacyAssetAttestations,
	manualImportEvidence,
} from "@sprite-anvil/db/schema/asset-production-history";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersionQualityEvidence,
	assetVersionReviewEvents,
	assetVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { generationPackages } from "@sprite-anvil/db/schema/generation-packages";
import { project } from "@sprite-anvil/db/schema/project";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { createAssetRecordTrackingStore } from "./features/asset-records/server/asset-record-tracking-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;
const imageBytes = await sharp({
	create: {
		background: { alpha: 1, b: 200, g: 100, r: 40 },
		channels: 4,
		height: 1,
		width: 1,
	},
})
	.png()
	.toBuffer();
const imageBase64 = imageBytes.toString("base64");

function legacyVersionInput(input: {
	assetRecordId: string;
	fileName: string;
	id: string;
	projectId: string;
}) {
	return {
		...input,
		contentBase64: imageBase64,
		contentType: "image/png" as const,
		historyUnknown: true as const,
		knownSource: "Project archive",
		supportingEvidence: null,
		unknownHistoryDetails: "The original production history is unknown.",
		userRelationship: "received_from_team" as const,
	};
}

function createMemoryStorage() {
	const objects = new Map<string, Uint8Array>();
	return {
		storage: {
			async put(key: string, body: ReadableStream<Uint8Array>) {
				objects.set(
					key,
					new Uint8Array(await new Response(body).arrayBuffer())
				);
			},
			delete(key: string) {
				objects.delete(key);
				return Promise.resolve();
			},
		},
		storedFileCount: () => objects.size,
	};
}

test.skipIf(!databaseUrl)(
	"saves and rereads Manual Import Evidence before allowing approval",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
		}

		const db = createDb({ DATABASE_URL: databaseUrl });
		const storage = createMemoryStorage();
		const userId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const assetRecordId = crypto.randomUUID();
		const generationPackageId = crypto.randomUUID();
		const historicalLegacyVersionId = crypto.randomUUID();
		const lateImportedLegacyVersionId = crypto.randomUUID();
		const incompleteVersionId = crypto.randomUUID();
		let insertedUser = false;
		let insertedProject = false;
		let insertedAssetRecord = false;
		let insertedGenerationPackage = false;

		try {
			await db.insert(user).values({
				id: userId,
				name: "Manual Import Evidence Integration Test",
				email: `manual-import-evidence-${userId}@example.test`,
			});
			insertedUser = true;
			await db.insert(project).values({
				id: projectId,
				name: "Manual Import Evidence Integration Project",
				ownerUserId: userId,
			});
			insertedProject = true;
			await db.insert(assetRecords).values({
				id: assetRecordId,
				projectId,
				createdByUserId: userId,
				name: "Integration Asset Record",
				identityCriteria: ["independent_product_meaning"],
				supportLevel: "general",
				availability: "active",
			});
			insertedAssetRecord = true;

			const assetRecordTrackingStore = createAssetRecordTrackingStore(
				db,
				storage.storage
			);
			const context = {
				assetRecordTrackingStore,
				session: { user: { id: userId } },
			} as unknown as Context;
			const historicalLegacyVersion = await call(
				appRouter.assetRecords.createVersion,
				legacyVersionInput({
					assetRecordId,
					fileName: "historical-project-art.png",
					id: historicalLegacyVersionId,
					projectId,
				}),
				{ context }
			);

			const snapshot = generationPackageSnapshotSchema.parse({
				assetRecord: {
					availability: "active",
					createdAt: new Date().toISOString(),
					id: assetRecordId,
					identityCriteria: ["independent_product_meaning"],
					name: "Integration Asset Record",
					projectId,
					supportLevel: "general",
				},
				avoidConstraints: ["Avoid changing the silhouette."],
				canonicalDesign: null,
				changeConstraints: ["Change the attack timing."],
				expectedOutputStructure: "A one-frame PNG result.",
				lockedUnits: [],
				preserveConstraints: ["Keep the armor silhouette."],
				productionContextSnapshot: {
					contextRevisionId: crypto.randomUUID(),
					generalArtDirection: "Readable silhouettes with clean outlines.",
					ruleContractVersion: "context-rule/1.0.0",
					rules: [],
					revisionNumber: 1,
					theme: null,
					visualWorld: null,
				},
				referenceRoles: [],
				targetDimensions: { height: 80, width: 72 },
				targetTask: "Create one attack frame.",
			});
			await db.insert(generationPackages).values({
				id: generationPackageId,
				projectId,
				assetRecordId,
				createdByUserId: userId,
				snapshot,
			});
			insertedGenerationPackage = true;
			const lateImportedLegacyVersion = await call(
				appRouter.assetRecords.createVersion,
				legacyVersionInput({
					assetRecordId,
					fileName: "historic-project-file.png",
					id: lateImportedLegacyVersionId,
					projectId,
				}),
				{ context }
			);
			const generationInstruction =
				"\nKeep the armor silhouette.\nAdd one attack frame.\n";
			const version = await call(
				appRouter.assetRecords.createManualImportVersion,
				{
					assetRecordId,
					contentBase64: imageBase64,
					contentType: "image/png",
					fileName: "ash-knight-attack.png",
					generationInstruction,
					generationPackageId,
					id: crypto.randomUUID(),
					projectId,
					sourceSurface: "ChatGPT web",
				},
				{ context }
			);

			expect(version).toMatchObject({
				fileName: "ash-knight-attack.png",
				sourceKind: "manual_import",
				reviewDisposition: "candidate",
			});
			expect(storage.storedFileCount()).toBe(3);

			const reread = await call(
				appRouter.assetRecords.tracking,
				{ assetRecordId, projectId },
				{ context }
			);
			expect(reread.tracking.manualImportEvidence).toMatchObject([
				{
					assetVersionId: version.id,
					fileName: "ash-knight-attack.png",
					generationInstruction,
					generationPackageId,
					sha256: version.sha256,
					sourceSurface: "ChatGPT web",
					versionNumber: version.versionNumber,
				},
			]);
			expect(reread.tracking.productionHistory).toHaveLength(2);
			expect(reread.tracking.manualImportEvidenceRequiredVersionIds).toEqual([
				version.id,
			]);
			expect(
				reread.tracking.manualImportEvidenceRequiredVersionIds
			).not.toContain(historicalLegacyVersion.id);
			expect(
				reread.tracking.manualImportEvidenceRequiredVersionIds
			).not.toContain(lateImportedLegacyVersion.id);

			await call(
				appRouter.assetRecords.recordReview,
				{
					assetRecordId,
					decision: "approved",
					id: crypto.randomUUID(),
					projectId,
					rationale: "The file's original production history is unknown.",
					versionId: historicalLegacyVersion.id,
				},
				{ context }
			);
			await call(
				appRouter.assetRecords.recordReview,
				{
					assetRecordId,
					decision: "approved",
					id: crypto.randomUUID(),
					projectId,
					rationale:
						"The file's original history stays unknown regardless of import time.",
					versionId: lateImportedLegacyVersion.id,
				},
				{ context }
			);

			await db.insert(assetVersions).values({
				id: incompleteVersionId,
				projectId,
				assetRecordId,
				assetFamilyId: null,
				versionNumber: version.versionNumber + 1,
				fileName: "incomplete-manual-result.png",
				contentType: "image/png",
				sourceImageWidth: 1,
				sourceImageHeight: 1,
				sha256: "b".repeat(64),
				byteSize: imageBytes.byteLength,
				contentDigest: "b".repeat(64),
				integrityVerified: true,
				sourceKind: "manual_import",
				idempotencyKey: crypto.randomUUID(),
				objectKey: `test/${incompleteVersionId}`,
				createdByUserId: userId,
			});
			await db.insert(assetVersionQualityEvidence).values({
				id: crypto.randomUUID(),
				projectId,
				versionId: incompleteVersionId,
				gate: "format_signature",
				result: "matched",
				sha256: "b".repeat(64),
				byteSize: imageBytes.byteLength,
				createdByUserId: userId,
			});
			await expect(
				call(
					appRouter.assetRecords.recordReview,
					{
						assetRecordId,
						decision: "approved",
						id: crypto.randomUUID(),
						projectId,
						rationale: "Missing manual import evidence.",
						versionId: incompleteVersionId,
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

			await call(
				appRouter.assetRecords.recordReview,
				{
					assetRecordId,
					decision: "approved",
					id: crypto.randomUUID(),
					projectId,
					rationale: "Reviewed with complete Manual Import Evidence.",
					versionId: version.id,
				},
				{ context }
			);
			const reviewed = await call(
				appRouter.assetRecords.tracking,
				{ assetRecordId, projectId },
				{ context }
			);
			expect(reviewed.tracking.approvedVersion?.id).toBe(version.id);
		} finally {
			if (insertedAssetRecord) {
				await db
					.delete(assetVersionReviewEvents)
					.where(eq(assetVersionReviewEvents.assetRecordId, assetRecordId));
				await db
					.delete(legacyAssetAttestations)
					.where(eq(legacyAssetAttestations.projectId, projectId));
				await db
					.delete(manualImportEvidence)
					.where(eq(manualImportEvidence.assetRecordId, assetRecordId));
				await db
					.delete(assetVersionQualityEvidence)
					.where(eq(assetVersionQualityEvidence.projectId, projectId));
				await db
					.delete(assetVersions)
					.where(eq(assetVersions.assetRecordId, assetRecordId));
			}
			if (insertedGenerationPackage) {
				await db
					.delete(generationPackages)
					.where(eq(generationPackages.assetRecordId, assetRecordId));
			}
			if (insertedAssetRecord) {
				await db.delete(assetRecords).where(eq(assetRecords.id, assetRecordId));
			}
			if (insertedProject) {
				await db.delete(project).where(eq(project.id, projectId));
			}
			if (insertedUser) {
				await db.delete(user).where(eq(user.id, userId));
			}
		}
	}
);
