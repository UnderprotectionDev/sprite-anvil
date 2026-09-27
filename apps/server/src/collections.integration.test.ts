import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import { eq } from "drizzle-orm";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetRecordStore } from "./features/asset-records/server/asset-record-store";
import { createAssetRecordTrackingStore } from "./features/asset-records/server/asset-record-tracking-store";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createCollectionStore } from "./features/collections/server/collection-store";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createProjectAccessStore } from "./features/projects/server/project-access-store";
import { createProjectContextScopeStore } from "./features/visual-worlds/server/project-context-scope-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

function createContext(database: ReturnType<typeof createDb>, userId: string) {
	const projectContextStore = createProjectContextStore(database);
	return {
		assetFamilyStore: createAssetFamilyStore(database),
		assetRecordStore: createAssetRecordStore(database),
		assetRecordTrackingStore: createAssetRecordTrackingStore(database, null),
		assetVersionStore: createAssetVersionStore(database),
		collectionStore: createCollectionStore(database),
		db: database,
		projectAccess: createProjectAccessStore(database, projectContextStore),
		projectContextScopeStore: createProjectContextScopeStore(database),
		projectContextStore,
		session: { user: { id: userId } } as Context["session"],
	} satisfies Context;
}

test.skipIf(!databaseUrl)(
	"persists and rereads cross-family Collection membership without changing Asset Record history",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
		}

		const db = createDb({ DATABASE_URL: databaseUrl });
		const userId = crypto.randomUUID();
		let insertedUser = false;

		try {
			await db.insert(user).values({
				id: userId,
				name: "Collection Integration Test",
				email: `collections-${userId}@example.test`,
			});
			insertedUser = true;

			const context = createContext(db, userId);
			const project = await call(
				appRouter.projectContexts.create,
				{
					name: "Collection Integration Project",
					generalArtDirection: "Clear silhouettes and a limited palette",
				},
				{ context }
			);
			const visualWorld = await call(
				appRouter.contextScopes.createVisualWorld,
				{
					projectId: project.id,
					name: "Gameplay",
					description: "In-game assets",
				},
				{ context }
			);

			const firstIdentity = await call(
				appRouter.assetFamilies.createSubjectIdentity,
				{ projectId: project.id, name: "Ash Knight" },
				{ context }
			);
			const firstFamily = await call(
				appRouter.assetFamilies.createAssetFamily,
				{
					projectId: project.id,
					subjectIdentityId: firstIdentity.id,
					name: "Character sprite",
					visualWorldId: visualWorld.id,
					useContext: "combat",
				},
				{ context }
			);
			const firstRecord = await call(
				appRouter.assetFamilies.createAssetRecord,
				{
					projectId: project.id,
					assetFamilyId: firstFamily.id,
					name: "Idle animation",
					identityCriteria: ["independent_product_meaning"],
				},
				{ context }
			);
			const relatedRecord = await call(
				appRouter.assetFamilies.createAssetRecord,
				{
					projectId: project.id,
					assetFamilyId: firstFamily.id,
					name: "Attack animation",
					identityCriteria: ["independent_product_meaning"],
				},
				{ context }
			);
			await call(
				appRouter.assetFamilies.createRelationship,
				{
					projectId: project.id,
					assetFamilyId: firstFamily.id,
					sourceAssetRecordId: firstRecord.id,
					targetAssetRecordId: relatedRecord.id,
					type: "animation",
				},
				{ context }
			);

			const secondIdentity = await call(
				appRouter.assetFamilies.createSubjectIdentity,
				{ projectId: project.id, name: "Iron Key" },
				{ context }
			);
			const secondFamily = await call(
				appRouter.assetFamilies.createAssetFamily,
				{
					projectId: project.id,
					subjectIdentityId: secondIdentity.id,
					name: "Inventory icon",
					visualWorldId: visualWorld.id,
					useContext: "inventory",
				},
				{ context }
			);
			const secondRecord = await call(
				appRouter.assetFamilies.createAssetRecord,
				{
					projectId: project.id,
					assetFamilyId: secondFamily.id,
					name: "Key icon",
					identityCriteria: ["independent_product_meaning"],
				},
				{ context }
			);

			const familyCatalogBefore = await call(
				appRouter.assetFamilies.list,
				{ projectId: project.id },
				{ context }
			);
			const trackingBefore = await call(
				appRouter.assetRecordTracking.tracking,
				{ projectId: project.id, assetRecordId: firstRecord.id },
				{ context }
			);
			const collection = await call(
				appRouter.collections.create,
				{ projectId: project.id, name: "Combat and inventory notes" },
				{ context }
			);
			const secondCollection = await call(
				appRouter.collections.create,
				{ projectId: project.id, name: "Character references" },
				{ context }
			);
			await call(
				appRouter.collections.addAssetRecord,
				{
					projectId: project.id,
					collectionId: collection.id,
					assetRecordId: firstRecord.id,
				},
				{ context }
			);
			await call(
				appRouter.collections.addAssetRecord,
				{
					projectId: project.id,
					collectionId: collection.id,
					assetRecordId: secondRecord.id,
				},
				{ context }
			);
			await call(
				appRouter.collections.addAssetRecord,
				{
					projectId: project.id,
					collectionId: secondCollection.id,
					assetRecordId: firstRecord.id,
				},
				{ context }
			);

			const rereadDb = createDb({ DATABASE_URL: databaseUrl });
			const rereadContext = createContext(rereadDb, userId);
			const reread = await call(
				appRouter.collections.list,
				{ projectId: project.id },
				{ context: rereadContext }
			);
			expect(reread.collections).toContainEqual(collection);
			expect(reread.collections).toContainEqual(secondCollection);
			expect(reread.memberships).toHaveLength(3);
			expect(
				new Set(reread.memberships.map(({ assetRecordId }) => assetRecordId))
			).toEqual(new Set([firstRecord.id, secondRecord.id]));
			expect(
				new Set(
					reread.memberships.map(
						(membership) =>
							reread.assetRecords.find(
								(record) => record.id === membership.assetRecordId
							)?.assetFamilyId
					)
				)
			).toEqual(new Set([firstFamily.id, secondFamily.id]));

			await call(
				appRouter.collections.removeAssetRecord,
				{
					projectId: project.id,
					collectionId: collection.id,
					assetRecordId: firstRecord.id,
				},
				{ context: rereadContext }
			);
			const afterRemoval = await call(
				appRouter.collections.list,
				{ projectId: project.id },
				{
					context: createContext(
						createDb({ DATABASE_URL: databaseUrl }),
						userId
					),
				}
			);
			expect(afterRemoval.collections).toContainEqual(collection);
			expect(afterRemoval.memberships).toHaveLength(2);
			expect(afterRemoval.memberships).toContainEqual(
				expect.objectContaining({
					assetRecordId: firstRecord.id,
					collectionId: secondCollection.id,
				})
			);
			expect(afterRemoval.memberships).not.toContainEqual(
				expect.objectContaining({
					assetRecordId: firstRecord.id,
					collectionId: collection.id,
				})
			);
			const familyCatalogAfter = await call(
				appRouter.assetFamilies.list,
				{ projectId: project.id },
				{ context: rereadContext }
			);
			const trackingAfter = await call(
				appRouter.assetRecordTracking.tracking,
				{ projectId: project.id, assetRecordId: firstRecord.id },
				{ context: rereadContext }
			);
			expect(familyCatalogAfter).toEqual(familyCatalogBefore);
			expect(trackingAfter).toEqual(trackingBefore);
		} finally {
			if (insertedUser) {
				await db.delete(user).where(eq(user.id, userId));
			}
		}
	}
);
