import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { AnimationTimingReviewInput } from "@sprite-anvil/api/animation-timing-reviews";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import type { Database } from "@sprite-anvil/db";
import { animationTimingReviews } from "@sprite-anvil/db/schema/animation-timing-reviews";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { project } from "@sprite-anvil/db/schema/project";
import { projectSpecializedProfileContracts } from "@sprite-anvil/db/schema/specialized-profile-contracts";
import { SQL } from "bun";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createAnimationTimingReviewStore } from "./features/character-animation-profile/server/animation-timing-review-store";
import { createSpecializedProfileContractStore } from "./features/quality-evidence/server/specialized-profile-contract-store";

const databaseUrl = process.env.ANIMATION_TIMING_REVIEW_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"persists variable frame timing across PostgreSQL connections and protects review targets",
	async () => {
		if (!databaseUrl) {
			throw new Error("Missing test database URL");
		}
		const target = new URL(databaseUrl);
		if (
			target.hostname !== "127.0.0.1" ||
			target.pathname !== "/animation_timing_test"
		) {
			throw new Error(
				"Animation timing review integration requires a disposable loopback animation_timing_test database."
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
		const contractStore = createSpecializedProfileContractStore(db);
		const reviewStore = createAnimationTimingReviewStore(db);
		const context = {
			session: { user: { id: userId } },
			animationTimingReviewStore: reviewStore,
			assetVersionStore: createAssetVersionStore(db),
			specializedProfileContractStore: contractStore,
			verifyAssetVersionContent: async () => true,
		} as unknown as Context;
		try {
			await db.insert(user).values({
				id: userId,
				name: "Animation timing review test",
				email: `animation-timing-${userId}@example.test`,
			});
			await db.insert(project).values({
				id: projectId,
				ownerUserId: userId,
				name: "Animation timing review test",
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
				useContext: "Walk cycle",
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

			const input: AnimationTimingReviewInput = {
				id: crypto.randomUUID(),
				projectId,
				assetFamilyId: familyId,
				contractRevisionId: activation.contractRevisionId,
				animationName: "Walk cycle",
				playbackSpeed: 1,
				looping: true,
				directions: ["south", "west", "north", "east"].map((direction) => ({
					direction,
					frames: [
						{
							assetVersionId: versionId,
							frameKey: `${direction}-contact`,
							durationMs: 80,
							region: null,
							motionPhase: "Contact",
						},
						{
							assetVersionId: versionId,
							frameKey: `${direction}-recovery`,
							durationMs: 220,
							region: null,
							motionPhase: null,
						},
					],
				})),
				outcome: "consistent",
				rationale: "Four directions reviewed by a person.",
			};
			const saved = await call(appRouter.animationTimingReviews.save, input, {
				context,
			});
			const rereadContext = {
				...context,
				animationTimingReviewStore: createAnimationTimingReviewStore(rereadDb),
			};
			expect(
				await call(
					appRouter.animationTimingReviews.list,
					{ projectId, assetFamilyId: familyId },
					{ context: rereadContext }
				)
			).toEqual([saved]);
			expect(
				saved.directions[0]?.frames.map((frame) => frame.durationMs)
			).toEqual([80, 220]);
			expect(saved.directions[0]?.frames[1]?.motionPhase).toBeNull();
			expect(
				await call(appRouter.animationTimingReviews.save, input, {
					context: rereadContext,
				})
			).toEqual(saved);

			const eightDirectionInput = {
				...input,
				id: crypto.randomUUID(),
				directions: [
					...input.directions,
					...["south-west", "north-west", "north-east", "south-east"].map(
						(direction) => ({
							direction,
							frames: input.directions[0]?.frames ?? [],
						})
					),
				],
			};
			const eightDirectionRecord = await call(
				appRouter.animationTimingReviews.save,
				eightDirectionInput,
				{ context }
			);
			expect(eightDirectionRecord.directions).toEqual(
				eightDirectionInput.directions
			);
			expect(
				await call(
					appRouter.animationTimingReviews.list,
					{ projectId, assetFamilyId: familyId },
					{ context: rereadContext }
				)
			).toEqual([eightDirectionRecord, saved]);

			await expect(
				call(
					appRouter.animationTimingReviews.list,
					{ projectId, assetFamilyId: familyId },
					{
						context: {
							...context,
							session: { user: { id: "outsider" } },
						} as Context,
					}
				)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			await db
				.update(assetRecords)
				.set({ availability: "erased" })
				.where(eq(assetRecords.id, recordId));
			expect(
				await call(
					appRouter.animationTimingReviews.list,
					{ projectId, assetFamilyId: familyId },
					{ context: rereadContext }
				)
			).toEqual([]);
		} finally {
			await db
				.delete(animationTimingReviews)
				.where(eq(animationTimingReviews.projectId, projectId));
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
