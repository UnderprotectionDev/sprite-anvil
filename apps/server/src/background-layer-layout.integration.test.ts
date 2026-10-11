import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { BackgroundLayerLayoutInput } from "@sprite-anvil/api/background-layer-layouts";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import type { Database } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
	subjectIdentities,
} from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { backgroundLayerLayouts } from "@sprite-anvil/db/schema/background-layer-layouts";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { project } from "@sprite-anvil/db/schema/project";
import { SQL } from "bun";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetRecordStore } from "./features/asset-records/server/asset-record-store";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createBackgroundLayerLayoutStore } from "./features/background-parallax-profile/server/background-layer-layout-store";
import { createSpecializedProfileContractStore } from "./features/quality-evidence/server/specialized-profile-contract-store";

const databaseUrl = process.env.BACKGROUND_LAYER_LAYOUT_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"persists and rereads a background layer layout with exact versions and safe areas",
	async () => {
		if (!databaseUrl) {
			throw new Error("Missing background layer layout test database URL");
		}
		const target = new URL(databaseUrl);
		if (
			target.hostname !== "127.0.0.1" ||
			target.pathname !== "/background_layer_layout_test"
		) {
			throw new Error(
				"Background layer layout integration requires a disposable loopback background_layer_layout_test database."
			);
		}
		const connection = new SQL(databaseUrl);
		const second = new SQL(databaseUrl);
		const db = drizzle({ client: connection }) as unknown as Database;
		const rereadDb = drizzle({ client: second }) as unknown as Database;
		const userId = crypto.randomUUID();
		const outsiderUserId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const worldId = crypto.randomUUID();
		const subjectIdentityId = crypto.randomUUID();
		const familyId = crypto.randomUUID();
		const fixtures = [
			{
				digest: "a".repeat(64),
				recordId: crypto.randomUUID(),
				recordName: "Sky",
				versionId: crypto.randomUUID(),
			},
			{
				digest: "b".repeat(64),
				recordId: crypto.randomUUID(),
				recordName: "Trees",
				versionId: crypto.randomUUID(),
			},
		] as const;
		const records = [fixtures[0].recordId, fixtures[1].recordId] as const;
		const versions = [fixtures[0].versionId, fixtures[1].versionId] as const;
		const digests = [fixtures[0].digest, fixtures[1].digest] as const;
		const foreignFamilyId = crypto.randomUUID();
		const foreignRecordId = crypto.randomUUID();
		const foreignVersionId = crypto.randomUUID();
		const contractStore = createSpecializedProfileContractStore(db);
		const layoutStore = createBackgroundLayerLayoutStore(db);
		const context = {
			session: { user: { id: userId } },
			assetFamilyStore: createAssetFamilyStore(db),
			assetRecordStore: createAssetRecordStore(db),
			assetVersionStore: createAssetVersionStore(db),
			backgroundLayerLayoutStore: layoutStore,
			specializedProfileContractStore: contractStore,
			verifyAssetVersionContent: async () => true,
		} as unknown as Context;
		const backgroundContract = specializedProfileContractCatalog.find(
			(definition) => definition.profileId === "background_parallax"
		);
		if (!backgroundContract) {
			throw new Error(
				"The background Specialized Profile Contract is required."
			);
		}
		try {
			await db.insert(user).values({
				id: userId,
				name: "Background layer layout test",
				email: `background-layer-layout-${userId}@example.test`,
			});
			await db.insert(user).values({
				id: outsiderUserId,
				name: "Background layer layout outsider",
				email: `background-layer-layout-outsider-${outsiderUserId}@example.test`,
			});
			await db.insert(project).values({
				id: projectId,
				ownerUserId: userId,
				name: "Background layer layout test",
			});
			await db.insert(visualWorlds).values({
				id: worldId,
				projectId,
				name: "Forest",
				createdByUserId: userId,
			});
			await db.insert(subjectIdentities).values({
				id: subjectIdentityId,
				projectId,
				name: "Potion identity",
				createdByUserId: userId,
			});
			await db.insert(assetFamilies).values({
				id: familyId,
				projectId,
				subjectIdentityId,
				visualWorldId: worldId,
				name: "Forest background",
				useContext: "Inventory",
				createdByUserId: userId,
			});
			await db.insert(assetRecords).values(
				fixtures.map(({ recordId, recordName }) => ({
					id: recordId,
					projectId,
					assetFamilyId: familyId,
					name: recordName,
					assetCategory: "background_parallax" as const,
					supportLevel: "general" as const,
					availability: "active" as const,
					createdByUserId: userId,
				}))
			);
			await db.insert(assetVersions).values(
				fixtures.map(({ recordId, versionId, digest }) => ({
					id: versionId,
					projectId,
					assetFamilyId: familyId,
					assetRecordId: recordId,
					versionNumber: 1,
					contentType: "image/png",
					byteSize: 91,
					objectKey: `test/${versionId}`,
					contentDigest: digest,
					integrityVerified: true,
					sourceImageWidth: 320,
					sourceImageHeight: 180,
					createdByUserId: userId,
				}))
			);
			await db.insert(assetFamilies).values({
				id: foreignFamilyId,
				projectId,
				visualWorldId: worldId,
				name: "Unrelated background family",
				useContext: "Reward UI",
				createdByUserId: userId,
			});
			await db.insert(assetRecords).values({
				id: foreignRecordId,
				projectId,
				assetFamilyId: foreignFamilyId,
				name: "Reward emblem",
				assetCategory: "background_parallax",
				supportLevel: "general",
				availability: "active",
				createdByUserId: userId,
			});
			await db.insert(assetVersions).values({
				id: foreignVersionId,
				projectId,
				assetFamilyId: foreignFamilyId,
				assetRecordId: foreignRecordId,
				versionNumber: 1,
				contentType: "image/png",
				byteSize: 91,
				objectKey: `test/${foreignVersionId}`,
				contentDigest: "c".repeat(64),
				integrityVerified: true,
				sourceImageWidth: 320,
				sourceImageHeight: 180,
				createdByUserId: userId,
			});
			await contractStore.activate(
				userId,
				projectId,
				"background_parallax",
				backgroundContract
			);
			const activation = await contractStore.getActive(
				userId,
				projectId,
				"background_parallax"
			);
			if (!activation) {
				throw new Error("Background profile activation failed");
			}
			const input: BackgroundLayerLayoutInput = {
				id: crypto.randomUUID(),
				projectId,
				assetFamilyId: familyId,
				contractRevisionId: activation.contractRevisionId,
				visualWorldId: worldId,
				layers: [
					{
						id: "sky",
						assetRecordId: records[0],
						assetVersionId: versions[0],
						order: 0,
						naturalSize: { width: 320, height: 180 },
						targetAspectRatio: { width: 16, height: 9 },
						crop: { x: 0, y: 0, width: 320, height: 180 },
						safeArea: { x: 80, y: 30, width: 160, height: 120 },
					},
					{
						id: "trees",
						assetRecordId: records[1],
						assetVersionId: versions[1],
						order: 1,
						naturalSize: { width: 320, height: 180 },
						targetAspectRatio: { width: 16, height: 9 },
						crop: { x: 0, y: 0, width: 320, height: 180 },
						safeArea: { x: 80, y: 30, width: 160, height: 120 },
					},
				],
			};
			const saved = await call(appRouter.backgroundLayerLayouts.save, input, {
				context,
			});
			const rereadContext = {
				...context,
				backgroundLayerLayoutStore: createBackgroundLayerLayoutStore(rereadDb),
			};
			expect(
				await call(
					appRouter.backgroundLayerLayouts.list,
					{ projectId, assetFamilyId: familyId },
					{ context: rereadContext }
				)
			).toEqual([saved]);
			expect(saved).toMatchObject({
				...input,
				createdByUserId: userId,
				versionPins: [
					{ assetVersionId: versions[0], contentDigest: digests[0] },
					{ assetVersionId: versions[1], contentDigest: digests[1] },
				],
				contractSnapshot: backgroundContract,
			});
			expect(
				await call(appRouter.backgroundLayerLayouts.save, input, { context })
			).toEqual(saved);
			const outsideFamilyInput: BackgroundLayerLayoutInput = {
				...input,
				id: crypto.randomUUID(),
				layers: input.layers.map((item, index) =>
					index === 0 ? { ...item, assetVersionId: foreignVersionId } : item
				),
			};
			await expect(
				call(appRouter.backgroundLayerLayouts.save, outsideFamilyInput, {
					context,
				})
			).rejects.toMatchObject({ code: "BAD_REQUEST" });

			const invalidInputs: BackgroundLayerLayoutInput[] = [
				{ ...input, id: crypto.randomUUID(), visualWorldId: "different-world" },
				{
					...input,
					id: crypto.randomUUID(),
					layers: input.layers.map((layer, index) =>
						index === 0
							? { ...layer, naturalSize: { width: 640, height: 360 } }
							: layer
					),
				},
				{
					...input,
					id: crypto.randomUUID(),
					layers: input.layers.map((layer, index) =>
						index === 0
							? {
									...layer,
									safeArea: { x: 300, y: 0, width: 100, height: 100 },
								}
							: layer
					),
				},
				{
					...input,
					id: crypto.randomUUID(),
					layers: input.layers.map((layer) => ({ ...layer, order: 0 })),
				},
				{
					...input,
					id: crypto.randomUUID(),
					layers: input.layers.map((layer) => ({ ...layer, id: "duplicate" })),
				},
				{
					...input,
					id: crypto.randomUUID(),
					layers: input.layers.map((layer, index) =>
						index === 0
							? { ...layer, crop: { x: 0, y: 0, width: 320, height: 200 } }
							: layer
					),
				},
				{
					...input,
					id: crypto.randomUUID(),
					layers: input.layers.map((layer, index) =>
						index === 0
							? { ...layer, targetAspectRatio: { width: 4, height: 3 } }
							: layer
					),
				},
				{
					...input,
					id: crypto.randomUUID(),
					layers: input.layers.map((layer, index) =>
						index === 1 ? { ...layer, assetVersionId: versions[0] } : layer
					),
				},
			];
			await Promise.all(
				invalidInputs.map((invalidInput) =>
					expect(
						call(appRouter.backgroundLayerLayouts.save, invalidInput, {
							context,
						})
					).rejects.toMatchObject({ code: "BAD_REQUEST" })
				)
			);
			await expect(
				call(
					appRouter.backgroundLayerLayouts.save,
					{ ...input, layers: [...input.layers].reverse() },
					{ context }
				)
			).rejects.toMatchObject({ code: "CONFLICT" });
			await expect(
				call(
					appRouter.backgroundLayerLayouts.save,
					{
						...input,
						id: crypto.randomUUID(),
						contractRevisionId: "old-revision",
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "CONFLICT" });
			await expect(
				call(
					appRouter.backgroundLayerLayouts.save,
					{ ...input, id: crypto.randomUUID() },
					{
						context: {
							...context,
							verifyAssetVersionContent: async () => false,
						},
					}
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				call(
					appRouter.backgroundLayerLayouts.save,
					{ ...input, id: crypto.randomUUID() },
					{ context: { ...context, session: null } }
				)
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
			await expect(
				call(
					appRouter.backgroundLayerLayouts.list,
					{ projectId, assetFamilyId: familyId },
					{ context: { ...context, session: null } }
				)
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
			await db
				.update(assetVersions)
				.set({ sourceImageWidth: null, sourceImageHeight: null })
				.where(eq(assetVersions.id, versions[0]));
			await expect(
				call(
					appRouter.backgroundLayerLayouts.save,
					{ ...input, id: crypto.randomUUID() },
					{ context }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await db
				.update(assetVersions)
				.set({ sourceImageWidth: 320, sourceImageHeight: 180 })
				.where(eq(assetVersions.id, versions[0]));

			const outsiderContext: Context = {
				...context,
				session: { user: { id: outsiderUserId } } as Context["session"],
			};
			await expect(
				call(
					appRouter.backgroundLayerLayouts.list,
					{ projectId, assetFamilyId: familyId },
					{ context: outsiderContext }
				)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			await expect(
				call(
					appRouter.backgroundLayerLayouts.save,
					{ ...input, id: crypto.randomUUID() },
					{ context: outsiderContext }
				)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			expect(
				await call(
					appRouter.backgroundLayerLayouts.list,
					{ projectId, assetFamilyId: familyId },
					{ context }
				)
			).toEqual([saved]);
			await db
				.update(assetRecords)
				.set({ availability: "erased" })
				.where(eq(assetRecords.id, records[0]));
			expect(
				await call(
					appRouter.backgroundLayerLayouts.list,
					{ projectId, assetFamilyId: familyId },
					{ context }
				)
			).toEqual([]);
			await expect(
				call(
					appRouter.backgroundLayerLayouts.save,
					{ ...input, id: crypto.randomUUID() },
					{ context }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await db
				.update(assetRecords)
				.set({ availability: "active" })
				.where(eq(assetRecords.id, records[0]));
		} finally {
			await db
				.delete(backgroundLayerLayouts)
				.where(eq(backgroundLayerLayouts.projectId, projectId));
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
				.delete(subjectIdentities)
				.where(eq(subjectIdentities.projectId, projectId));
			await db
				.delete(visualWorlds)
				.where(eq(visualWorlds.projectId, projectId));
			await db.delete(project).where(eq(project.id, projectId));
			await db.delete(user).where(eq(user.id, userId));
			await db.delete(user).where(eq(user.id, outsiderUserId));
			await connection.close();
			await second.close();
		}
	},
	30_000
);
