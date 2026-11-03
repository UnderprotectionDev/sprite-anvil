import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type { ProductionRecipeContent } from "@sprite-anvil/api/production-recipes";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import { productionRecipes } from "@sprite-anvil/db/schema/production-recipes";
import { eq, inArray } from "drizzle-orm";
import { createProductionRecipeStore } from "../production-recipe-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

const content: ProductionRecipeContent = {
	expectedOutputStructure: "A four-frame PNG sprite sheet.",
	fields: [
		{ key: "target_task", label: "Target task", mode: "fill_in", value: null },
	],
	instructionSkeleton: "Task: {{target_task}}",
	referenceRoles: [],
};

test.skipIf(!databaseUrl)(
	"persists, versions, and rereads Production Recipes per owner",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
		}
		const db = createDb({ DATABASE_URL: databaseUrl });
		const userId = crypto.randomUUID();
		const otherUserId = crypto.randomUUID();
		let insertedUsers = false;

		try {
			await db.insert(user).values(
				[userId, otherUserId].map((id) => ({
					id,
					name: "Production Recipe Integration Test",
					email: `production-recipes-${id}@example.test`,
				}))
			);
			insertedUsers = true;

			// Loading the app-root composition reads the server environment.
			const services = await import("../../../../services");
			const context: Context = {
				assetFamilyStore: services.assetFamilyStore,
				assetRecordStore: services.assetRecordStore,
				assetRecordTrackingStore: services.assetRecordTrackingStore,
				assetVersionStore: services.assetVersionStore,
				collectionStore: services.collectionStore,
				db: services.db,
				projectAccess: services.projectAccess,
				projectContextScopeStore: services.projectContextScopeStore,
				projectContextStore: services.projectContextStore,
				session: { user: { id: userId } } as Context["session"],
			};
			const project = await call(
				appRouter.projectContexts.create,
				{
					name: "Production Recipe Integration",
					generalArtDirection: "Readable silhouettes with clean outlines",
				},
				{ context }
			);

			const store = createProductionRecipeStore(db);
			const source = {
				assetRecordId: crypto.randomUUID(),
				experimentId: crypto.randomUUID(),
				generationPackageId: crypto.randomUUID(),
				trialId: crypto.randomUUID(),
			};
			const created = await store.create(userId, {
				content,
				projectId: project.id,
				source,
				title: "Attack recipe",
			});
			expect(created?.versions.map((v) => v.versionNumber)).toEqual([1]);
			if (!created) {
				throw new Error("The recipe should exist.");
			}

			const edited = await store.addVersion(userId, {
				baseVersionNumber: 1,
				content: { ...content, instructionSkeleton: "Do: {{target_task}}" },
				note: "Reworded.",
				projectId: project.id,
				recipeId: created.id,
			});
			expect(edited).toMatchObject({ kind: "created" });
			expect(
				await store.addVersion(userId, {
					baseVersionNumber: 1,
					content,
					note: null,
					projectId: project.id,
					recipeId: created.id,
				})
			).toEqual({ kind: "stale" });

			const reread = await store.get(userId, project.id, created.id);
			expect(reread?.source).toEqual(source);
			expect(
				reread?.versions.map((v) => v.content.instructionSkeleton)
			).toEqual(["Task: {{target_task}}", "Do: {{target_task}}"]);
			expect(await store.get(otherUserId, project.id, created.id)).toBeNull();
			expect(await store.list(otherUserId, project.id)).toBeNull();
		} finally {
			if (insertedUsers) {
				await db
					.delete(productionRecipes)
					.where(eq(productionRecipes.createdByUserId, userId));
				await db.delete(user).where(inArray(user.id, [userId, otherUserId]));
			}
		}
	}
);
