import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import {
	type VfxAppearanceInput,
	vfxAppearanceRecordSchema,
} from "@sprite-anvil/api/vfx-appearance-reviews";
import type { Database } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { project } from "@sprite-anvil/db/schema/project";
import { projectSpecializedProfileContracts } from "@sprite-anvil/db/schema/specialized-profile-contracts";
import { vfxAppearanceReviews } from "@sprite-anvil/db/schema/vfx-appearance-reviews";
import { SQL } from "bun";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { createAssetRecordStore } from "../../../asset-records/server/asset-record-store";
import { createAssetVersionStore } from "../../../asset-versions/server/asset-version-store";
import { createSpecializedProfileContractStore } from "../../../quality-evidence/server/specialized-profile-contract-store";
import { createVfxAppearanceReviewStore } from "../vfx-appearance-review-store";

const databaseUrl = process.env.VFX_APPEARANCE_REVIEW_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"persists four-background VFX playback across PostgreSQL connections and protects review targets",
	async () => {
		if (!databaseUrl) {
			throw new Error("Missing test database URL");
		}
		const target = new URL(databaseUrl);
		if (
			target.hostname !== "127.0.0.1" ||
			target.pathname !== "/vfx_appearance_test"
		) {
			throw new Error(
				"VFX appearance review integration requires a disposable loopback vfx_appearance_test database."
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
		const reviewStore = createVfxAppearanceReviewStore(db);
		const context = {
			session: { user: { id: userId } },
			vfxAppearanceReviewStore: reviewStore,
			assetVersionStore: createAssetVersionStore(db),
			specializedProfileContractStore: contractStore,
			verifyAssetVersionContent: async () => true,
			verifyVfxFrameContent: async () => true,
			assetRecordStore: createAssetRecordStore(db),
		} as unknown as Context;
		try {
			await db.insert(user).values({
				id: userId,
				name: "VFX appearance review test",
				email: `vfx-appearance-${userId}@example.test`,
			});
			await db.insert(project).values({
				id: projectId,
				ownerUserId: userId,
				name: "VFX appearance review test",
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
				name: "Fire effects",
				useContext: "Combat effects",
				createdByUserId: userId,
			});
			await db.insert(assetRecords).values({
				id: recordId,
				projectId,
				assetFamilyId: familyId,
				name: "Fire burst",
				assetCategory: "visual_effect_projectile_shadow_mark",
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
				sourceImageWidth: 24,
				sourceImageHeight: 16,
				objectKey: `test/${versionId}`,
				contentDigest: "a".repeat(64),
				integrityVerified: true,
				createdByUserId: userId,
			});
			await contractStore.activate(
				userId,
				projectId,
				"visual_effect_projectile_shadow_mark",
				specializedProfileContractCatalog[3]
			);
			const activation = await contractStore.getActive(
				userId,
				projectId,
				"visual_effect_projectile_shadow_mark"
			);
			if (!activation) {
				throw new Error("Profile activation failed");
			}

			const input: VfxAppearanceInput = {
				id: crypto.randomUUID(),
				projectId,
				assetFamilyId: familyId,
				contractRevisionId: activation.contractRevisionId,
				name: "Fire burst",
				cell: { width: 16, height: 16 },
				frames: [
					{
						assetVersionId: versionId,
						frameKey: "burst",
						durationMs: 80,
						region: { x: 0, y: 0, width: 24, height: 16 },
						offset: { x: -4, y: 0 },
					},
				],
				sceneAssetVersionId: versionId,
				opacity: 0.75,
				looping: true,
				overflowAllowed: true,
				qualityWaiverEvidenceId: null,
				backgrounds: ["light", "dark", "transparent", "scene"],
				outcome: "passed",
				rationale: "Reviewed all four backgrounds.",
			};

			const saved = await call(appRouter.vfxAppearanceReviews.save, input, {
				context,
			});
			const forgedWaiver = vfxAppearanceRecordSchema.parse({
				...saved,
				id: crypto.randomUUID(),
				qualityWaiverEvidenceId: "absent-waiver",
				qualityWaiverSnapshot: {
					id: "absent-waiver",
					projectId,
					assetFamilyId: familyId,
					revisionId: "absent-required-set",
					itemId: "burst",
					kind: "quality",
					result: "waived",
					assetVersionIds: [versionId],
					profileContractRevisionIds: [activation.contractRevisionId],
					contextRevisionId: null,
					visualWorldId: worldId,
					useContext: "Combat effects",
					canonicalDesignVersionId: null,
					ruleId: "effect.cell_overflow",
					ruleClass: "waivable_requirement",
					testId: null,
					usageTestContext: null,
					usageVariant: null,
					targetDimensions: null,
					grayscaleReviewed: null,
					observedValue: "4 px",
					versionTarget: { kind: "unit", id: "absent-unit" },
					method: "Frame bounds",
					rationale: "Intentional overflow",
					createdAt: saved.createdAt,
					createdByUserId: userId,
					isCurrent: true,
				},
			});
			expect(await reviewStore.append(userId, forgedWaiver)).toBeNull();

			const rereadContext = {
				...context,
				vfxAppearanceReviewStore: createVfxAppearanceReviewStore(rereadDb),
			};
			expect(
				await call(
					appRouter.vfxAppearanceReviews.list,
					{ projectId, assetFamilyId: familyId },
					{ context: rereadContext }
				)
			).toEqual([saved]);
			expect(saved.frames[0]?.durationMs).toBe(80);
			expect(saved.measuredOverflowPx).toBe(4);
			expect(saved.opacity).toBe(0.75);
			expect(
				await call(appRouter.vfxAppearanceReviews.save, input, {
					context: rereadContext,
				})
			).toEqual(saved);

			await expect(
				call(
					appRouter.vfxAppearanceReviews.list,
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
					appRouter.vfxAppearanceReviews.list,
					{ projectId, assetFamilyId: familyId },
					{ context: rereadContext }
				)
			).toEqual([]);
		} finally {
			await db
				.delete(vfxAppearanceReviews)
				.where(eq(vfxAppearanceReviews.projectId, projectId));
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
