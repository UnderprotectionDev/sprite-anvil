import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { user } from "@sprite-anvil/db/schema/auth";
import { project } from "@sprite-anvil/db/schema/project";
import { eq } from "drizzle-orm";
import { createAssetRecordStore } from "./features/asset-records/server/asset-record-store";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createProjectAccessStore } from "./features/projects/server/project-access-store";
import { createProjectContextScopeStore } from "./features/visual-worlds/server/project-context-scope-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"creates and rereads an Asset Record through a fresh Neon store",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
		}

		const db = createDb({ DATABASE_URL: databaseUrl });
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

			const rereadDb = createDb({ DATABASE_URL: databaseUrl });
			const rereadContext: Context = {
				...context,
				assetRecordStore: createAssetRecordStore(rereadDb),
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

			await expect(
				db.delete(project).where(eq(project.id, projectId))
			).rejects.toThrow();
		} finally {
			if (assetRecordId) {
				await db.delete(assetRecords).where(eq(assetRecords.id, assetRecordId));
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
