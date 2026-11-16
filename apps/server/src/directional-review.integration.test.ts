import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type { DirectionalReviewInput } from "@sprite-anvil/api/directional-reviews";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import type { Database } from "@sprite-anvil/db";
import { assetFamilyCanonicalDesigns } from "@sprite-anvil/db/schema/asset-families";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { directionalReviews } from "@sprite-anvil/db/schema/directional-reviews";
import { project } from "@sprite-anvil/db/schema/project";
import { projectSpecializedProfileContracts } from "@sprite-anvil/db/schema/specialized-profile-contracts";
import { SQL } from "bun";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createDirectionalReviewStore } from "./features/character-animation-profile/server/directional-review-store";
import { createSpecializedProfileContractStore } from "./features/quality-evidence/server/specialized-profile-contract-store";

const databaseUrl = process.env.DIRECTIONAL_REVIEW_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"persists four/eight direction reviews across PostgreSQL connections and protects exact targets",
	async () => {
		if (!databaseUrl) {
			throw new Error("Missing test database URL");
		}
		const target = new URL(databaseUrl);
		if (
			target.hostname !== "127.0.0.1" ||
			target.pathname !== "/directional_test"
		) {
			throw new Error(
				"Directional review integration requires a disposable loopback directional_test database."
			);
		}
		const connection = new SQL(databaseUrl);
		const second = new SQL(databaseUrl);
		const db = drizzle({ client: connection }) as unknown as Database;
		const rereadDb = drizzle({ client: second }) as unknown as Database;
		const userId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const worldId = crypto.randomUUID();
		const familyId = crypto.randomUUID();
		const recordId = crypto.randomUUID();
		const versionId = crypto.randomUUID();
		const designId = crypto.randomUUID();
		const contractStore = createSpecializedProfileContractStore(db);
		const reviewStore = createDirectionalReviewStore(db);
		const context = {
			session: { user: { id: userId } },
			directionalReviewStore: reviewStore,
			assetVersionStore: createAssetVersionStore(db),
			specializedProfileContractStore: contractStore,
			verifyAssetVersionContent: async () => true,
		} as unknown as Context;
		try {
			await db.insert(user).values({
				id: userId,
				name: "Directional review test",
				email: `directional-${userId}@example.test`,
			});
			await db.insert(project).values({
				id: projectId,
				ownerUserId: userId,
				name: "Directional review test",
			});
			await db.insert(visualWorlds).values({
				id: worldId,
				projectId,
				name: "Gameplay",
				createdByUserId: userId,
			});
			await db.insert(assetFamilies).values({
				id: familyId,
				projectId,
				visualWorldId: worldId,
				name: "Knight",
				useContext: "Walk",
				createdByUserId: userId,
			});
			await db.insert(assetRecords).values({
				id: recordId,
				projectId,
				assetFamilyId: familyId,
				name: "Knight walk",
				supportLevel: "general",
				availability: "active",
				createdByUserId: userId,
			});
			await db.insert(assetVersions).values({
				id: versionId,
				projectId,
				assetFamilyId: familyId,
				assetRecordId: recordId,
				versionNumber: 1,
				contentType: "image/png",
				byteSize: 91,
				objectKey: `test/${versionId}`,
				contentDigest: "a".repeat(64),
				integrityVerified: true,
				createdByUserId: userId,
			});
			await db.insert(assetFamilyCanonicalDesigns).values({
				id: designId,
				projectId,
				assetFamilyId: familyId,
				assetRecordId: recordId,
				assetVersionId: versionId,
				createdByUserId: userId,
			});
			await contractStore.activate(
				userId,
				projectId,
				"character_creature_animation",
				specializedProfileContractCatalog[0]
			);
			const activation = await contractStore.getActive(
				userId,
				projectId,
				"character_creature_animation"
			);
			if (!activation) {
				throw new Error("Profile activation failed");
			}
			const input: DirectionalReviewInput = {
				id: crypto.randomUUID(),
				projectId,
				assetFamilyId: familyId,
				canonicalDesignId: designId,
				contractRevisionId: activation.contractRevisionId,
				directions: ["south", "west", "north", "east"].map((direction) => ({
					direction,
					frames: [
						{
							assetVersionId: versionId,
							durationMs: 100,
							region: { x: 0, y: 0, width: 1, height: 1 },
						},
						{ assetVersionId: versionId, durationMs: 250, region: null },
					],
				})),
				observations: {
					silhouette: "Unchanged",
					proportions: "Unchanged",
					equipmentSide: "Right",
					palette: "Gray",
					perspective: "Side",
					scale: "1x",
					groundContact: "Different",
				},
				outcome: "needs_follow_up",
				rationale: "Human observation; no automatic artistic verdict.",
			};
			const saved = await call(appRouter.directionalReviews.save, input, {
				context,
			});
			const rereadContext = {
				...context,
				directionalReviewStore: createDirectionalReviewStore(rereadDb),
			};
			expect(
				await call(
					appRouter.directionalReviews.list,
					{ projectId, assetFamilyId: familyId },
					{ context: rereadContext }
				)
			).toEqual([saved]);
			const duplicate = await Promise.all([
				call(appRouter.directionalReviews.save, input, { context }),
				call(appRouter.directionalReviews.save, input, {
					context: rereadContext,
				}),
			]);
			expect(duplicate).toEqual([saved, saved]);
			const eight = {
				...input,
				id: crypto.randomUUID(),
				directions: [
					...input.directions,
					...["south-west", "north-west", "north-east", "south-east"].map(
						(direction) => ({
							direction,
							frames: input.directions.at(0)?.frames ?? [],
						})
					),
				],
			};
			expect(
				await call(appRouter.directionalReviews.save, eight, { context })
			).toMatchObject({ directions: eight.directions });
			await expect(
				call(
					appRouter.directionalReviews.list,
					{ projectId, assetFamilyId: familyId },
					{
						context: {
							...context,
							session: { user: { id: "outsider" } },
						} as Context,
					}
				)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			// A concurrent canonical selection between API validation and write must not become a saved review.
			const changingContext = {
				...context,
				directionalReviewStore: {
					...reviewStore,
					append: async (
						owner: string,
						record: Parameters<
							NonNullable<Context["directionalReviewStore"]>["append"]
						>[1]
					) => {
						await db.insert(assetFamilyCanonicalDesigns).values({
							id: crypto.randomUUID(),
							projectId,
							assetFamilyId: familyId,
							assetRecordId: recordId,
							assetVersionId: versionId,
							createdByUserId: userId,
							createdAt: sql`now() + interval '1 second'`,
						});
						return await createDirectionalReviewStore(db).append(owner, record);
					},
				},
			};
			await expect(
				call(
					appRouter.directionalReviews.save,
					{ ...input, id: crypto.randomUUID() },
					{ context: changingContext }
				)
			).rejects.toMatchObject({ code: "CONFLICT" });
			await db
				.update(assetRecords)
				.set({ availability: "erased" })
				.where(eq(assetRecords.id, recordId));
			expect(
				await call(
					appRouter.directionalReviews.list,
					{ projectId, assetFamilyId: familyId },
					{ context: rereadContext }
				)
			).toEqual([]);
		} finally {
			await db
				.delete(directionalReviews)
				.where(eq(directionalReviews.projectId, projectId));
			await db
				.delete(assetFamilyCanonicalDesigns)
				.where(eq(assetFamilyCanonicalDesigns.projectId, projectId));
			await db
				.delete(assetVersions)
				.where(eq(assetVersions.projectId, projectId));
			await db
				.delete(assetRecords)
				.where(eq(assetRecords.projectId, projectId));
			await db
				.delete(assetFamilies)
				.where(eq(assetFamilies.projectId, projectId));
			await db
				.delete(visualWorlds)
				.where(eq(visualWorlds.projectId, projectId));
			await db
				.delete(projectSpecializedProfileContracts)
				.where(eq(projectSpecializedProfileContracts.projectId, projectId));
			await db.delete(project).where(eq(project.id, projectId));
			await db.delete(user).where(eq(user.id, userId));
			await connection.close();
			await second.close();
		}
	}
);
