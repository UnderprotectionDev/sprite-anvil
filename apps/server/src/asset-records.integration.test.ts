import { expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { call } from "@orpc/server";
import {
	type AssetRecordMeasurements,
	createEmptyAssetRecordMeasurements,
} from "@sprite-anvil/api/asset-records";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb } from "@sprite-anvil/db";
import { legacyAssetAttestations } from "@sprite-anvil/db/schema/asset-production-history";
import { assetRecordDerivatives } from "@sprite-anvil/db/schema/asset-record-derivatives";
import { assetRecordMeasurements } from "@sprite-anvil/db/schema/asset-record-measurements";
import { assetRecordReferences } from "@sprite-anvil/db/schema/asset-record-references";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersionQualityEvidence,
	assetVersionReviewEvents,
	assetVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { project } from "@sprite-anvil/db/schema/project";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetRecordStore } from "./features/asset-records/server/asset-record-store";
import { createAssetRecordTrackingStore } from "./features/asset-records/server/asset-record-tracking-store";
import type { AssetVersionObjectStorage } from "./features/asset-records/server/asset-version-store";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createProjectAccessStore } from "./features/projects/server/project-access-store";
import { createProjectContextScopeStore } from "./features/visual-worlds/server/project-context-scope-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;
const imageBase64 = (
	await sharp({
		create: {
			background: { alpha: 1, b: 200, g: 100, r: 40 },
			channels: 4,
			height: 1,
			width: 1,
		},
	})
		.png()
		.toBuffer()
).toString("base64");

function createMemoryStorage() {
	const objects = new Map<string, Uint8Array>();
	const storage: AssetVersionObjectStorage = {
		async put(key, body) {
			objects.set(key, new Uint8Array(await new Response(body).arrayBuffer()));
		},
		delete(key) {
			objects.delete(key);
			return Promise.resolve();
		},
	};
	return { size: () => objects.size, storage };
}

test.skipIf(!databaseUrl)(
	"creates and rereads an Asset Record through a fresh Neon store",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
		}

		const db = createDb({ DATABASE_URL: databaseUrl });
		const storage = createMemoryStorage();
		const userId = crypto.randomUUID();
		let projectId: string | null = null;
		let assetRecordId: string | null = null;
		let insertedUser = false;

		try {
			await db.insert(user).values({
				id: userId,
				name: "Asset Record Integration Test",
				email: `asset-record-${userId}@example.test`,
			});
			insertedUser = true;

			const projectContextStore = createProjectContextStore(db);
			const context: Context = {
				assetFamilyStore: createAssetFamilyStore(db),
				assetVersionStore: createAssetVersionStore(db),
				assetRecordStore: createAssetRecordStore(db),
				assetRecordTrackingStore: createAssetRecordTrackingStore(
					db,
					storage.storage
				),
				db,
				projectAccess: createProjectAccessStore(db, projectContextStore),
				projectContextScopeStore: createProjectContextScopeStore(db),
				projectContextStore,
				session: { user: { id: userId } } as Context["session"],
			};
			const createdProject = await call(
				appRouter.projects.create,
				{
					name: "Ash Knight production",
					generalArtDirection: "Clear silhouettes with restrained highlights",
				},
				{ context }
			);
			projectId = createdProject.id;

			assetRecordId = crypto.randomUUID();
			const created = await call(
				appRouter.assetRecords.create,
				{
					id: assetRecordId,
					identityCriteria: [
						"independent_product_meaning",
						"delivery_identity",
					],
					name: "Ash Knight",
					projectId,
				},
				{ context }
			);
			const measurements: AssetRecordMeasurements = {
				atlasDimensions: {
					proposal: { width: 1024, height: 512 },
					confirmed: null,
				},
				cellDimensions: {
					proposal: null,
					confirmed: { width: 24, height: 32 },
				},
				displayScale: { proposal: 2.5, confirmed: 2 },
				logicalResolution: {
					proposal: { width: 72, height: 80 },
					confirmed: { width: 72, height: 80 },
				},
				sourceImageDimensions: {
					proposal: { width: 512, height: 256 },
					confirmed: { width: 512, height: 256 },
				},
				visibleContentBounds: {
					proposal: {
						coordinateSpace: "logicalResolution",
						x: 3,
						y: 4,
						width: 66,
						height: 74,
					},
					confirmed: {
						coordinateSpace: "logicalResolution",
						x: 3,
						y: 4,
						width: 66,
						height: 74,
					},
				},
			};
			await call(
				appRouter.assetRecords.updateMeasurements,
				{ assetRecordId: created.id, measurements, projectId },
				{ context }
			);
			const invalidVersionId = crypto.randomUUID();
			const truncatedPngBase64 = Buffer.from(imageBase64, "base64")
				.subarray(0, 33)
				.toString("base64");
			await expect(
				call(
					appRouter.assetRecords.createVersion,
					{
						assetRecordId: created.id,
						contentBase64: truncatedPngBase64,
						contentType: "image/png",
						fileName: "truncated.png",
						historyUnknown: true,
						id: invalidVersionId,
						knownSource: null,
						projectId,
						supportingEvidence: null,
						userRelationship: "unknown",
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "CONFLICT" });
			const [invalidVersion] = await db
				.select()
				.from(assetVersions)
				.where(eq(assetVersions.id, invalidVersionId))
				.limit(1);
			expect(invalidVersion).toBeUndefined();
			expect(storage.size()).toBe(0);

			const versionId = crypto.randomUUID();
			const createdVersion = await call(
				appRouter.assetRecords.createVersion,
				{
					assetRecordId: created.id,
					contentBase64: imageBase64,
					contentType: "image/png",
					fileName: "ash-knight.png",
					historyUnknown: true,
					id: versionId,
					knownSource: "Imported from the project archive",
					projectId,
					supportingEvidence: "Owner provided an archive note.",
					userRelationship: "received_from_team",
				},
				{ context }
			);
			await call(
				appRouter.assetRecords.recordReview,
				{
					assetRecordId: created.id,
					decision: "approved",
					id: crypto.randomUUID(),
					projectId,
					rationale: "Reviewed through the persistent API path.",
					versionId,
				},
				{ context }
			);
			const world = await call(
				appRouter.contextScopes.createVisualWorld,
				{
					projectId,
					name: "Ash Knight World",
					description: "Persistent asset family integration fixture",
				},
				{ context }
			);
			const theme = await call(
				appRouter.contextScopes.createTheme,
				{
					projectId,
					visualWorldId: world.id,
					name: "Ash Knight Theme",
					description: "Metadata discovery integration fixture",
				},
				{ context }
			);
			const metadataRecord = await call(
				appRouter.assetRecords.updateMetadata,
				{
					assetCategory: "icon",
					assetRecordId: created.id,
					projectId,
					tags: ["Inventory"],
					themeId: theme.id,
					visualWorldId: world.id,
				},
				{ context }
			);
			expect(metadataRecord).toMatchObject({
				assetCategory: "icon",
				tags: ["inventory"],
				themeId: theme.id,
				visualWorldId: world.id,
			});
			await expect(
				call(
					appRouter.assetRecords.updateMetadata,
					{
						assetCategory: "icon",
						assetRecordId: created.id,
						projectId,
						tags: [],
						themeId: null,
						visualWorldId: crypto.randomUUID(),
					},
					{ context }
				)
			).rejects.toMatchObject({
				code: "BAD_REQUEST",
				message: "Tema veya Görsel Dünya seçilen proje kapsamında olmalıdır.",
			});
			const familyId = crypto.randomUUID();
			await call(
				appRouter.assetRecords.createFamily,
				{
					assetRecordId: created.id,
					canonicalVersionId: versionId,
					id: familyId,
					name: "Ash Knight Family",
					projectId,
					useContext: "Playable world sprite",
					visualWorldId: world.id,
				},
				{ context }
			);
			const derivativeRecord = await call(
				appRouter.assetRecords.create,
				{
					id: crypto.randomUUID(),
					identityCriteria: ["independent_lifecycle"],
					name: "Ash Knight Idle",
					projectId,
				},
				{ context }
			);
			const derivativeVersionId = crypto.randomUUID();
			await call(
				appRouter.assetRecords.createVersion,
				{
					assetRecordId: derivativeRecord.id,
					contentBase64: imageBase64,
					contentType: "image/png",
					fileName: "ash-knight-idle.png",
					historyUnknown: true,
					id: derivativeVersionId,
					knownSource: "Created from the canonical design",
					projectId,
					supportingEvidence: "Versioned for the derivative relation.",
					userRelationship: "created_by_user",
				},
				{ context }
			);
			const derivativeId = crypto.randomUUID();
			await call(
				appRouter.assetRecords.createDerivative,
				{
					canonicalVersionId: versionId,
					dependencyFacets: ["identity", "timing"],
					derivedAssetRecordId: derivativeRecord.id,
					id: derivativeId,
					projectId,
					sourceAssetRecordId: created.id,
				},
				{ context }
			);
			const referenceId = crypto.randomUUID();
			await call(
				appRouter.assetRecords.createReference,
				{
					assetRecordId: created.id,
					forbiddenFeatures: ["identity"],
					id: referenceId,
					notes: "Use the pose only.",
					projectId,
					role: "pose",
					targetVersionId: derivativeVersionId,
					transferredFeatures: ["pose"],
				},
				{ context }
			);

			const rereadDb = createDb({ DATABASE_URL: databaseUrl });
			const rereadContext: Context = {
				...context,
				assetFamilyStore: createAssetFamilyStore(rereadDb),
				assetVersionStore: createAssetVersionStore(rereadDb),
				assetRecordStore: createAssetRecordStore(rereadDb),
				assetRecordTrackingStore: createAssetRecordTrackingStore(
					rereadDb,
					storage.storage
				),
				db: rereadDb,
			};
			const reread = await call(
				appRouter.assetRecords.get,
				{ assetRecordId: created.id, projectId },
				{ context: rereadContext }
			);

			expect(reread).toMatchObject({
				assetCategory: "icon",
				availability: "active",
				identityCriteria: ["independent_product_meaning", "delivery_identity"],
				id: created.id,
				measurements,
				name: "Ash Knight",
				projectId,
				supportLevel: "general",
				tags: ["inventory"],
				themeId: theme.id,
				visualWorldId: world.id,
			});
			const search = await call(
				appRouter.assetRecords.search,
				{
					assetCategory: "icon",
					projectId,
					sourceImageHeight: 1,
					sourceImageWidth: 1,
					tag: "inventory",
					themeId: theme.id,
					visualWorldId: world.id,
				},
				{ context: rereadContext }
			);
			expect(search).toMatchObject({
				records: [
					{
						matchingVersions: [
							{
								fileName: "ash-knight.png",
								id: versionId,
								sourceImageHeight: 1,
								sourceImageWidth: 1,
								versionNumber: 1,
							},
						],
						record: { id: created.id },
					},
				],
				totalCount: 1,
			});
			const tracking = await call(
				appRouter.assetRecords.tracking,
				{ assetRecordId: created.id, projectId },
				{ context: rereadContext }
			);
			expect(tracking.record).toMatchObject({
				assetCategory: "icon",
				measurements,
				tags: ["inventory"],
				themeId: theme.id,
				visualWorldId: world.id,
			});
			expect(createdVersion).toMatchObject({
				fileName: "ash-knight.png",
				id: versionId,
				sourceImageHeight: 1,
				sourceImageWidth: 1,
				versionNumber: 1,
			});
			expect(tracking.tracking).toMatchObject({
				approvedVersion: {
					id: versionId,
					reviewDisposition: "approved",
					sourceImageHeight: 1,
					sourceImageWidth: 1,
				},
				productionHistory: [
					{
						knownSource: "Imported from the project archive",
						historyUnknown: true,
						supportingEvidence: "Owner provided an archive note.",
						userRelationship: "received_from_team",
						versionNumber: 1,
					},
				],
				quality: {
					integrityStatus: "format_signature_matched",
					profileStatus: "general_support",
					verifiedVersionCount: 1,
				},
				reviewEvents: [
					{
						decision: "approved",
						rationale: "Reviewed through the persistent API path.",
						versionId,
					},
				],
				family: {
					canonicalVersionId: versionId,
					id: familyId,
					visualWorldId: world.id,
				},
				derivatives: [
					{
						assetRecordId: derivativeRecord.id,
						canonicalVersionId: versionId,
						dependencyFacets: ["identity", "timing"],
						familyStatus: "matched",
						id: derivativeId,
					},
				],
				references: [
					{
						assetRecordName: "Ash Knight Idle",
						conflictFeatures: [],
						forbiddenFeatures: ["identity"],
						id: referenceId,
						role: "pose",
						transferredFeatures: ["pose"],
						versionId: derivativeVersionId,
						versionNumber: 1,
					},
				],
			});

			const archived = await call(
				appRouter.assetRecords.archive,
				{ assetRecordId: created.id, projectId },
				{ context: rereadContext }
			);
			expect(archived).toMatchObject({
				availability: "archived",
				measurements,
			});
			const archivedList = await call(
				appRouter.assetRecords.list,
				{ projectId },
				{ context: rereadContext }
			);
			expect(archivedList).toContainEqual(archived);
			const archivedTracking = await call(
				appRouter.assetRecords.tracking,
				{ assetRecordId: created.id, projectId },
				{ context: rereadContext }
			);
			expect(archivedTracking.record.measurements).toEqual(measurements);
			expect(archivedTracking.tracking).toEqual(tracking.tracking);

			const restored = await call(
				appRouter.assetRecords.restore,
				{ assetRecordId: created.id, projectId },
				{ context: rereadContext }
			);
			expect(restored).toMatchObject({
				availability: "active",
				measurements,
			});
			const restoredTracking = await call(
				appRouter.assetRecords.tracking,
				{ assetRecordId: created.id, projectId },
				{ context: rereadContext }
			);
			expect(restoredTracking.record.measurements).toEqual(measurements);
			expect(restoredTracking.tracking).toEqual(tracking.tracking);

			await db
				.update(assetRecords)
				.set({ availability: "erased" })
				.where(eq(assetRecords.id, created.id));
			await expect(
				call(
					appRouter.assetRecords.updateMetadata,
					{
						assetCategory: "other",
						assetRecordId: created.id,
						projectId,
						tags: ["should-not-return"],
						themeId: null,
						visualWorldId: null,
					},
					{ context: rereadContext }
				)
			).rejects.toMatchObject({
				code: "CONFLICT",
				message: "Silinmiş Varlık Kaydının metadata’sı değiştirilemez.",
			});
			const erasedMetadataRecord = await call(
				appRouter.assetRecords.get,
				{ assetRecordId: created.id, projectId },
				{ context: rereadContext }
			);
			expect(erasedMetadataRecord).toMatchObject({
				assetCategory: "icon",
				availability: "erased",
				tags: ["inventory"],
			});
			await expect(
				call(
					appRouter.assetRecords.updateMeasurements,
					{ assetRecordId: created.id, measurements, projectId },
					{ context: rereadContext }
				)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			const erasedRecord = await call(
				appRouter.assetRecords.get,
				{ assetRecordId: created.id, projectId },
				{ context: rereadContext }
			);
			expect(erasedRecord.measurements).toEqual(
				createEmptyAssetRecordMeasurements()
			);
			const erasedTracking = await call(
				appRouter.assetRecords.tracking,
				{ assetRecordId: created.id, projectId },
				{ context: rereadContext }
			);
			expect(erasedTracking.record.measurements).toEqual(
				createEmptyAssetRecordMeasurements()
			);

			await expect(
				db.delete(project).where(eq(project.id, projectId))
			).rejects.toThrow();
		} finally {
			if (projectId) {
				await db
					.delete(assetRecordReferences)
					.where(eq(assetRecordReferences.projectId, projectId));
				await db
					.delete(assetRecordDerivatives)
					.where(eq(assetRecordDerivatives.projectId, projectId));
				await db
					.delete(assetVersionReviewEvents)
					.where(eq(assetVersionReviewEvents.projectId, projectId));
				await db
					.delete(assetVersionQualityEvidence)
					.where(eq(assetVersionQualityEvidence.projectId, projectId));
				await db
					.delete(legacyAssetAttestations)
					.where(eq(legacyAssetAttestations.projectId, projectId));
				await db
					.delete(assetVersions)
					.where(eq(assetVersions.projectId, projectId));
				await db
					.delete(assetRecordMeasurements)
					.where(eq(assetRecordMeasurements.projectId, projectId));
				await db
					.delete(assetRecords)
					.where(eq(assetRecords.projectId, projectId));
				await db
					.delete(assetFamilies)
					.where(eq(assetFamilies.projectId, projectId));
			}
			if (projectId) {
				await db.delete(project).where(eq(project.id, projectId));
			}
			if (insertedUser) {
				await db.delete(user).where(eq(user.id, userId));
			}
		}
	}
);
