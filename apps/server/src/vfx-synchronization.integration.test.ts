import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import type { VfxSynchronizationInput } from "@sprite-anvil/api/vfx-synchronization";
import type { Database } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersions,
	unitVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { project } from "@sprite-anvil/db/schema/project";
import { projectSpecializedProfileContracts } from "@sprite-anvil/db/schema/specialized-profile-contracts";
import { vfxSynchronizationReviews } from "@sprite-anvil/db/schema/vfx-synchronization";
import { SQL } from "bun";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createSpecializedProfileContractStore } from "./features/quality-evidence/server/specialized-profile-contract-store";
import { createVfxSynchronizationStore } from "./features/vfx-profile/server/vfx-synchronization-store";

const databaseUrl = process.env.VFX_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"persists variable frame timing across PostgreSQL connections and protects review targets",
	async () => {
		if (!databaseUrl) {
			throw new Error("Missing test database URL");
		}
		const target = new URL(databaseUrl);
		if (target.hostname !== "127.0.0.1" || target.pathname !== "/vfx_test") {
			throw new Error(
				"VFX synchronization integration requires a disposable loopback vfx_test database."
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
		const ownerRecordId = crypto.randomUUID();
		const ownerVersionId = crypto.randomUUID();
		const sceneRecordId = crypto.randomUUID();
		const sceneVersionId = crypto.randomUUID();
		const effectUnitId = crypto.randomUUID();
		const ownerUnitId = crypto.randomUUID();
		const effectSourceId = crypto.randomUUID();
		const ownerSourceId = crypto.randomUUID();
		const effectContract = specializedProfileContractCatalog.find(
			(c) => c.profileId === "visual_effect_projectile_shadow_mark"
		);
		if (!effectContract) {
			throw new Error("Effect contract missing");
		}
		const contractStore = createSpecializedProfileContractStore(db);
		const reviewStore = createVfxSynchronizationStore(db);
		const context = {
			session: { user: { id: userId } },
			vfxSynchronizationStore: reviewStore,
			assetVersionStore: createAssetVersionStore(db),
			specializedProfileContractStore: contractStore,
			verifyAssetVersionContent: async () => true,
			assetRecordStore: {
				get: async (_u: string, _p: string, id: string) => ({
					id,
					availability: "active",
					assetCategory: new Map<string, string>([
						[recordId, "visual_effect_projectile_shadow_mark"],
						[ownerRecordId, "character_creature_animation"],
						[sceneRecordId, "background_parallax"],
					]).get(id),
				}),
			},
			readVfxImageDimensions: async () => ({
				width: 16,
				height: 16,
				hasAlpha: true,
			}),
		} as unknown as Context;
		try {
			await db.insert(user).values({
				id: userId,
				name: "VFX synchronization test",
				email: `vfx-sync-${userId}@example.test`,
			});
			await db.insert(project).values({
				id: projectId,
				ownerUserId: userId,
				name: "VFX synchronization test",
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
				"visual_effect_projectile_shadow_mark",
				effectContract
			);
			const activation = await contractStore.getActive(
				userId,
				projectId,
				"visual_effect_projectile_shadow_mark"
			);
			if (!activation) {
				throw new Error("Profile activation failed");
			}

			await db.insert(assetRecords).values(
				[ownerRecordId, sceneRecordId].map((id) => ({
					id,
					projectId,
					assetFamilyId: familyId,
					name: id,
					supportLevel: "general" as const,
					availability: "active" as const,
					createdByUserId: userId,
				}))
			);
			await db.insert(assetVersions).values(
				[
					{ id: ownerVersionId, assetRecordId: ownerRecordId },
					{ id: sceneVersionId, assetRecordId: sceneRecordId },
				].map((v) => ({
					...v,
					projectId,
					assetFamilyId: familyId,
					versionNumber: 1,
					contentType: "image/png" as const,
					byteSize: 91,
					objectKey: `test/${v.id}`,
					contentDigest: "b".repeat(64),
					integrityVerified: true,
					createdByUserId: userId,
				}))
			);
			await db.insert(assetVersions).values(
				[
					{ id: effectSourceId, assetRecordId: recordId },
					{ id: ownerSourceId, assetRecordId: ownerRecordId },
				].map((v) => ({
					...v,
					projectId,
					assetFamilyId: familyId,
					versionNumber: 2,
					contentType: "image/png" as const,
					byteSize: 91,
					objectKey: `test/${v.id}`,
					contentDigest: "c".repeat(64),
					integrityVerified: true,
					createdByUserId: userId,
				}))
			);
			await db.insert(unitVersions).values(
				[
					{
						id: effectUnitId,
						assetVersionId: versionId,
						assetRecordId: recordId,
						unitKey: "spark",
					},
					{
						id: ownerUnitId,
						assetVersionId: ownerVersionId,
						assetRecordId: ownerRecordId,
						unitKey: "cast",
					},
				].map((u) => ({
					...u,
					projectId,
					sourceAssetVersionId:
						u.assetVersionId === versionId ? effectSourceId : ownerSourceId,
					unitType: "frame" as const,
					versionNumber: 1,
					createdByUserId: userId,
				}))
			);
			const makeFrame = (
				assetVersionId: string,
				unitVersionId: string,
				frameKey: string,
				durationMs: number
			) => ({
				assetVersionId,
				unitVersionId,
				frameKey,
				durationMs,
				region: { x: 0, y: 0, width: 16, height: 16 },
				origin: { x: 8, y: 12 },
			});
			const input: VfxSynchronizationInput = {
				id: crypto.randomUUID(),
				projectId,
				assetFamilyId: familyId,
				contractRevisionId: activation.contractRevisionId,
				name: "Spell release",
				sourceReviewId: null,
				effect: {
					looping: false,
					frames: [makeFrame(versionId, effectUnitId, "spark", 220)],
				},
				owner: {
					looping: false,
					frames: [makeFrame(ownerVersionId, ownerUnitId, "cast", 500)],
				},
				event: { id: "spell", timeMs: 150 },
				layer: 1,
				sceneAssetVersionId: sceneVersionId,
				overflowAllowed: true,
				waiverEvidenceIds: [],
				backgrounds: ["transparent", "light", "dark", "scene"].map(
					(background) => ({
						background: background as
							| "transparent"
							| "light"
							| "dark"
							| "scene",
						alone: "passed",
						synchronized: "passed",
						notes: "Checked origin and layer.",
					})
				),
				rationale: "Owner event reviewed.",
			};

			const saved = await call(appRouter.vfxSynchronization.save, input, {
				context,
			});
			const rereadContext = {
				...context,
				vfxSynchronizationStore: createVfxSynchronizationStore(rereadDb),
			};
			expect(
				await call(
					appRouter.vfxSynchronization.list,
					{ projectId, assetFamilyId: familyId },
					{ context: rereadContext }
				)
			).toEqual([saved]);
			expect(saved.event.timeMs).toBe(150);
			expect(saved.effect.frames[0]?.durationMs).toBe(220);
			expect(
				await call(appRouter.vfxSynchronization.save, input, {
					context: rereadContext,
				})
			).toEqual(saved);
			const exported = await call(
				appRouter.vfxSynchronization.exportEvidence,
				{ projectId, assetFamilyId: familyId, recordId: input.id },
				{ context: rereadContext }
			);
			expect(exported.record.event.timeMs).toBe(150);

			await expect(
				call(
					appRouter.vfxSynchronization.list,
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
					appRouter.vfxSynchronization.list,
					{ projectId, assetFamilyId: familyId },
					{ context: rereadContext }
				)
			).toEqual([]);
		} finally {
			await db
				.delete(vfxSynchronizationReviews)
				.where(eq(vfxSynchronizationReviews.projectId, projectId));
			await db
				.delete(unitVersions)
				.where(eq(unitVersions.projectId, projectId));
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
