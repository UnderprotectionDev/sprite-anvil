import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb } from "@sprite-anvil/db";
import { legacyAssetAttestations } from "@sprite-anvil/db/schema/asset-production-history";
import { assetRecordDerivatives } from "@sprite-anvil/db/schema/asset-record-derivatives";
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
import { createAssetRecordStore } from "./features/asset-records/server/asset-record-store";
import { createAssetRecordTrackingStore } from "./features/asset-records/server/asset-record-tracking-store";
import type { AssetVersionObjectStorage } from "./features/asset-records/server/asset-version-store";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createProjectAccessStore } from "./features/projects/server/project-access-store";
import { createProjectContextScopeStore } from "./features/visual-worlds/server/project-context-scope-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;
const imageBase64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ZpUAAAAASUVORK5CYII=";

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
	return storage;
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
				assetRecordStore: createAssetRecordStore(db),
				assetRecordTrackingStore: createAssetRecordTrackingStore(db, storage),
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
				assetRecordStore: createAssetRecordStore(rereadDb),
				assetRecordTrackingStore: createAssetRecordTrackingStore(
					rereadDb,
					storage
				),
				db: rereadDb,
			};
			const reread = await call(
				appRouter.assetRecords.get,
				{ assetRecordId: created.id, projectId },
				{ context: rereadContext }
			);

			expect(reread).toEqual(created);
			expect(reread).toMatchObject({
				availability: "active",
				identityCriteria: ["independent_product_meaning", "delivery_identity"],
				name: "Ash Knight",
				supportLevel: "general",
			});
			const tracking = await call(
				appRouter.assetRecords.tracking,
				{ assetRecordId: created.id, projectId },
				{ context: rereadContext }
			);
			expect(createdVersion).toMatchObject({
				fileName: "ash-knight.png",
				id: versionId,
				versionNumber: 1,
			});
			expect(tracking.tracking).toMatchObject({
				approvedVersion: {
					id: versionId,
					reviewDisposition: "approved",
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
			expect(archived).toEqual({ ...created, availability: "archived" });
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
			expect(archivedTracking.tracking).toEqual(tracking.tracking);

			const restored = await call(
				appRouter.assetRecords.restore,
				{ assetRecordId: created.id, projectId },
				{ context: rereadContext }
			);
			expect(restored).toEqual(created);
			const restoredTracking = await call(
				appRouter.assetRecords.tracking,
				{ assetRecordId: created.id, projectId },
				{ context: rereadContext }
			);
			expect(restoredTracking.tracking).toEqual(tracking.tracking);

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
