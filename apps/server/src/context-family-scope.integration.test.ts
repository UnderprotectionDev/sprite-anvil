import { expect, test } from "bun:test";
import { narrowestScopeChain } from "@sprite-anvil/api/project-context";
import type { Database } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import { user } from "@sprite-anvil/db/schema/auth";
import { themes, visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { project } from "@sprite-anvil/db/schema/project";
import {
	createLocalTestDb,
	isLoopbackTestDatabaseUrl,
} from "@sprite-anvil/db/testing";
import { createProjectContextScopeStore } from "./features/visual-worlds/server/project-context-scope-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;
test.skipIf(!isLoopbackTestDatabaseUrl(databaseUrl))(
	"reads actual family and Theme membership in the Project Context scope catalog",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL required");
		}
		const db = createLocalTestDb({ DATABASE_URL: databaseUrl });
		const userId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const worldId = crypto.randomUUID();
		const themeId = crypto.randomUUID();
		const familyId = crypto.randomUUID();
		const recordId = crypto.randomUUID();
		const rollback = new Error("deliberate rollback");
		try {
			await expect(
				db.transaction(async (tx) => {
					await tx.insert(user).values({
						id: userId,
						name: "Owner",
						email: `${userId}@example.test`,
					});
					await tx
						.insert(project)
						.values({ id: projectId, ownerUserId: userId, name: "Context" });
					await tx.insert(visualWorlds).values({
						id: worldId,
						projectId,
						name: "World",
						createdByUserId: userId,
					});
					await tx.insert(themes).values({
						id: themeId,
						projectId,
						visualWorldId: worldId,
						name: "Theme",
						createdByUserId: userId,
					});
					await tx.insert(assetFamilies).values({
						id: familyId,
						projectId,
						visualWorldId: worldId,
						name: "Family",
						useContext: "Game",
						createdByUserId: userId,
					});
					await tx.insert(assetRecords).values({
						id: recordId,
						projectId,
						assetFamilyId: familyId,
						visualWorldId: worldId,
						themeId,
						createdByUserId: userId,
						name: "Record",
						supportLevel: "general",
						availability: "active",
					});
					const store = createProjectContextScopeStore(
						tx as unknown as Database
					);
					const catalog = await store.list(userId, projectId);
					expect(catalog?.assetRecordFamilies).toContainEqual({
						assetRecordId: recordId,
						assetFamilyId: familyId,
						themeId,
					});
					if (!catalog) {
						throw new Error("Expected catalog");
					}
					expect(
						narrowestScopeChain(
							projectId,
							{ id: recordId, visualWorldId: worldId, themeId },
							catalog
						)
					).toEqual([
						{ kind: "asset_family", id: familyId },
						{ kind: "theme", id: themeId },
						{ kind: "visual_world", id: worldId },
						{ kind: "project", id: projectId },
					]);
					expect(await store.list(crypto.randomUUID(), projectId)).toBeNull();
					throw rollback;
				})
			).rejects.toBe(rollback);
		} finally {
			await db.close();
		}
	}
);
