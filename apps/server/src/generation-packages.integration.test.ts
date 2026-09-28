import { expect, test } from "bun:test";
import { generationPackageSnapshotSchema } from "@sprite-anvil/api/generation-packages";
import { createDb } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { user } from "@sprite-anvil/db/schema/auth";
import { generationPackages } from "@sprite-anvil/db/schema/generation-packages";
import { project } from "@sprite-anvil/db/schema/project";
import { eq } from "drizzle-orm";
import { createGenerationPackageStore } from "./features/generation-packages/server/generation-package-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"persists and rereads an immutable Generation Package with owner checks",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
		}

		const db = createDb({ DATABASE_URL: databaseUrl });
		const userId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const assetRecordId = crypto.randomUUID();
		let insertedUser = false;
		let insertedProject = false;
		let insertedAssetRecord = false;

		try {
			await db.insert(user).values({
				id: userId,
				name: "Generation Package Integration Test",
				email: `generation-packages-${userId}@example.test`,
			});
			insertedUser = true;
			await db.insert(project).values({
				id: projectId,
				name: "Generation Package Integration Project",
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
				changeConstraints: ["Change the animation timing."],
				expectedOutputStructure: "A four-frame PNG sprite sheet.",
				lockedUnits: [],
				preserveConstraints: ["Keep the outline width."],
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
				targetTask: "Create a four-frame attack animation.",
			});
			const store = createGenerationPackageStore(db);
			const created = await store.create(userId, {
				assetRecordId,
				projectId,
				snapshot,
			});
			if (!created) {
				throw new Error("Expected the Generation Package to be saved.");
			}

			expect(created).toMatchObject({
				assetRecordId,
				productionContextSnapshot: snapshot.productionContextSnapshot,
				targetTask: snapshot.targetTask,
			});
			const reopenedStore = createGenerationPackageStore(db);
			expect(
				await reopenedStore.list(userId, projectId, assetRecordId)
			).toEqual([created]);
			expect(
				await reopenedStore.list(crypto.randomUUID(), projectId, assetRecordId)
			).toBeNull();
			expect(
				await reopenedStore.create(crypto.randomUUID(), {
					assetRecordId,
					projectId,
					snapshot,
				})
			).toBeNull();
			expect(
				await reopenedStore.list(userId, projectId, assetRecordId)
			).toHaveLength(1);
		} finally {
			if (insertedAssetRecord) {
				await db
					.delete(generationPackages)
					.where(eq(generationPackages.assetRecordId, assetRecordId));
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
