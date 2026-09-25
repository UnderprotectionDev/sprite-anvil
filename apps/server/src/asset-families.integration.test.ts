import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import { eq } from "drizzle-orm";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createProjectAccessStore } from "./features/projects/server/project-access-store";
import { createProjectContextScopeStore } from "./features/visual-worlds/server/project-context-scope-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"persists and rereads Subject Identities, Asset Families, and in-family relationships",
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
				name: "Asset Family Integration Test",
				email: `asset-families-${userId}@example.test`,
			});
			insertedUser = true;

			const projectContextStore = createProjectContextStore(db);
			const context: Context = {
				assetFamilyStore: createAssetFamilyStore(db),
				assetVersionStore: createAssetVersionStore(db),
				db,
				projectAccess: createProjectAccessStore(db, projectContextStore),
				projectContextScopeStore: createProjectContextScopeStore(db),
				projectContextStore,
				session: { user: { id: userId } } as Context["session"],
			};
			const project = await call(
				appRouter.projectContexts.create,
				{
					name: "Ash Knight Family Integration",
					generalArtDirection: "Pixel art with clear silhouettes",
				},
				{ context }
			);
			const visualWorld = await call(
				appRouter.contextScopes.createVisualWorld,
				{ projectId: project.id, name: "Gameplay", description: "In-game art" },
				{ context }
			);
			const identity = await call(
				appRouter.assetFamilies.createSubjectIdentity,
				{ projectId: project.id, name: "Ash Knight" },
				{ context }
			);
			const family = await call(
				appRouter.assetFamilies.createAssetFamily,
				{
					projectId: project.id,
					subjectIdentityId: identity.id,
					name: "Game Sprite",
					visualWorldId: visualWorld.id,
					useContext: "combat",
				},
				{ context }
			);
			const source = await call(
				appRouter.assetFamilies.createAssetRecord,
				{ projectId: project.id, assetFamilyId: family.id, name: "Base" },
				{ context }
			);
			const target = await call(
				appRouter.assetFamilies.createAssetRecord,
				{ projectId: project.id, assetFamilyId: family.id, name: "East" },
				{ context }
			);
			const relationship = await call(
				appRouter.assetFamilies.createRelationship,
				{
					projectId: project.id,
					assetFamilyId: family.id,
					sourceAssetRecordId: source.id,
					targetAssetRecordId: target.id,
					type: "direction",
				},
				{ context }
			);

			const rereadDb = createDb({ DATABASE_URL: databaseUrl });
			const rereadProjectContextStore = createProjectContextStore(rereadDb);
			const rereadContext: Context = {
				assetFamilyStore: createAssetFamilyStore(rereadDb),
				assetVersionStore: createAssetVersionStore(rereadDb),
				db: rereadDb,
				projectAccess: createProjectAccessStore(
					rereadDb,
					rereadProjectContextStore
				),
				projectContextScopeStore: createProjectContextScopeStore(rereadDb),
				projectContextStore: rereadProjectContextStore,
				session: { user: { id: userId } } as Context["session"],
			};
			const catalog = await call(
				appRouter.assetFamilies.list,
				{ projectId: project.id },
				{ context: rereadContext }
			);

			expect(catalog.subjectIdentities).toContainEqual(identity);
			expect(catalog.assetFamilies).toContainEqual(family);
			expect(catalog.assetRecords).toEqual([source, target]);
			expect(catalog.relationships).toContainEqual(relationship);
		} finally {
			if (insertedUser) {
				await db.delete(user).where(eq(user.id, userId));
			}
		}
	}
);
