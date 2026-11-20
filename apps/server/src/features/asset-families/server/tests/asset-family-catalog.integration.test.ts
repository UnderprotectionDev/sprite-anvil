import { expect, test } from "bun:test";
import type { Database } from "@sprite-anvil/db";
import {
	assetFamilies,
	subjectIdentities,
} from "@sprite-anvil/db/schema/asset-records";
import { user } from "@sprite-anvil/db/schema/auth";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { project } from "@sprite-anvil/db/schema/project";
import {
	createLocalTestDb,
	isLoopbackTestDatabaseUrl,
} from "@sprite-anvil/db/testing";
import { createAssetFamilyStore } from "../asset-family-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

test.skipIf(!isLoopbackTestDatabaseUrl(databaseUrl))(
	"pages by subject identity and can read a family outside the first page",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL required");
		}
		const db = createLocalTestDb({ DATABASE_URL: databaseUrl });
		const userId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const worldId = crypto.randomUUID();
		const firstId = crypto.randomUUID();
		const secondId = crypto.randomUUID();
		const secondFamilyId = crypto.randomUUID();
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
						.values({ id: projectId, ownerUserId: userId, name: "Catalog" });
					await tx.insert(visualWorlds).values({
						id: worldId,
						projectId,
						name: "World",
						createdByUserId: userId,
					});
					await tx.insert(subjectIdentities).values([
						{
							id: firstId,
							projectId,
							name: "A Shield",
							createdByUserId: userId,
						},
						{
							id: secondId,
							projectId,
							name: "B Knight",
							createdByUserId: userId,
						},
					]);
					await tx.insert(assetFamilies).values({
						id: secondFamilyId,
						projectId,
						subjectIdentityId: secondId,
						visualWorldId: worldId,
						name: "Knight sprite",
						useContext: "Game",
						createdByUserId: userId,
					});
					const store = createAssetFamilyStore(tx as unknown as Database);
					const first = await store.list(userId, projectId, {
						kind: "identity-page",
						limit: 1,
					});
					expect(
						first?.subjectIdentities.map((identity) => identity.id)
					).toEqual([firstId]);
					expect(first?.assetFamilies).toEqual([]);
					const second = await store.list(userId, projectId, {
						kind: "identity-page",
						limit: 1,
						after: { id: firstId, name: "A Shield" },
					});
					expect(second?.assetFamilies.map((family) => family.id)).toEqual([
						secondFamilyId,
					]);
					expect(
						await store.list(userId, projectId, {
							kind: "family",
							familyId: secondFamilyId,
						})
					).toEqual(second);
					expect(
						await store.list(crypto.randomUUID(), projectId, {
							kind: "family",
							familyId: secondFamilyId,
						})
					).toBeNull();
					throw rollback;
				})
			).rejects.toBe(rollback);
		} finally {
			await db.close();
		}
	}
);
