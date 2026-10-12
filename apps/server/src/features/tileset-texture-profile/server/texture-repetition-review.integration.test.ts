import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import {
	createTextureRepetitionPackage,
	textureRepetitionPackageSchema,
} from "@sprite-anvil/api/texture-repetition-reviews";
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
import { CryptoHasher, SQL } from "bun";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import sharp from "sharp";
import { withDisposablePostgres } from "../../../../../../packages/db/scripts/disposable-postgres";
import { createAssetRecordStore } from "../../asset-records/server/asset-record-store";
import { createAssetVersionStore } from "../../asset-versions/server/asset-version-store";
import { createSpecializedProfileContractStore } from "../../quality-evidence/server/specialized-profile-contract-store";
import { checkTextureImageEdges } from "./texture-edge-check";
import { createTextureRepetitionReviewStore } from "./texture-repetition-review-store";

test.skipIf(process.env.DB_TEST_POSTGRES !== "true")(
	"saves and rereads exact texture evidence through independent PostgreSQL connections",
	async () => {
		await withDisposablePostgres(async ({ url }) => {
			const connection = new SQL(url);
			const second = new SQL(url);
			const db = drizzle({ client: connection });
			const rereadDb = drizzle({ client: second });
			await migrate(db, {
				migrationsFolder: fileURLToPath(
					new URL(
						"../../../../../../packages/db/src/migrations",
						import.meta.url
					)
				),
			});
			const userId = crypto.randomUUID();
			const projectId = crypto.randomUUID();
			const familyId = crypto.randomUUID();
			const worldId = crypto.randomUUID();
			const recordId = crypto.randomUUID();
			const sourceId = crypto.randomUUID();
			const versionId = crypto.randomUUID();
			const unitId = crypto.randomUUID();

			const bytes = await sharp({
				create: { width: 3, height: 2, channels: 4, background: "#117744" },
			})
				.png()
				.toBuffer();
			const contentDigest = new CryptoHasher("sha256")
				.update(bytes)
				.digest("hex");
			try {
				await db.insert(user).values({
					id: userId,
					name: "Texture reviewer",
					email: `${userId}@example.test`,
				});
				await db.insert(project).values({
					id: projectId,
					name: "Texture repeat evidence",
					ownerUserId: userId,
				});
				await db.insert(visualWorlds).values({
					id: worldId,
					projectId,
					name: "Terrain",
					createdByUserId: userId,
				});
				await db.insert(assetFamilies).values({
					id: familyId,
					projectId,
					visualWorldId: worldId,
					name: "Grass",
					useContext: "Terrain",
					createdByUserId: userId,
				});
				await db.insert(assetRecords).values({
					id: recordId,
					projectId,
					assetFamilyId: familyId,
					name: "Grass texture",
					supportLevel: "general",
					availability: "active",
					assetCategory: "tileset_terrain_texture",
					createdByUserId: userId,
				});
				await db.insert(assetVersions).values(
					[sourceId, versionId].map((id, index) => ({
						id,
						projectId,
						assetRecordId: recordId,
						assetFamilyId: familyId,
						versionNumber: index + 1,
						contentType: "image/png",
						byteSize: bytes.length,
						contentDigest,
						sourceImageWidth: 3,
						sourceImageHeight: 2,
						integrityVerified: true,
						objectKey: `test/${id}`,
						createdByUserId: userId,
					}))
				);
				await db.insert(unitVersions).values({
					id: unitId,
					projectId,
					assetRecordId: recordId,
					assetVersionId: versionId,
					sourceAssetVersionId: sourceId,
					unitType: "tile",
					unitKey: "grass",
					versionNumber: 1,
					createdByUserId: userId,
				});
				const contract = specializedProfileContractCatalog.find(
					(item) => item.profileId === "tileset_terrain_texture"
				);
				if (!contract) {
					throw new Error("Missing texture contract");
				}
				const contracts = createSpecializedProfileContractStore(
					db as unknown as Database
				);
				await contracts.activate(
					userId,
					projectId,
					"tileset_terrain_texture",
					contract
				);
				const activation = await contracts.getActive(
					userId,
					projectId,
					"tileset_terrain_texture"
				);
				if (!activation) {
					throw new Error("Missing texture activation");
				}
				const context = {
					session: { user: { id: userId } },
					textureRepetitionReviewStore: createTextureRepetitionReviewStore(
						db as unknown as Database
					),
					assetVersionStore: createAssetVersionStore(db as unknown as Database),
					assetRecordStore: createAssetRecordStore(db as unknown as Database),
					specializedProfileContractStore: contracts,
					checkTextureEdges: (
						_user: string,
						_project: string,
						_version: string,
						region: Parameters<typeof checkTextureImageEdges>[1],
						axes: Parameters<typeof checkTextureImageEdges>[2]
					) => checkTextureImageEdges(bytes, region, axes),
				} as unknown as Context;
				const input = {
					id: crypto.randomUUID(),
					projectId,
					assetFamilyId: familyId,
					contractRevisionId: activation.contractRevisionId,
					unitVersionId: unitId,
					atlasRegion: { x: 0, y: 0, width: 3, height: 2 },
					terrainId: "grass",
					repeatAxes: ["x", "y"] as ("x" | "y")[],
					shiftedOffset: { x: 1, y: 1 },
					observations: (["2x2", "3x3", "shifted"] as const).map(
						(arrangement) => ({
							arrangement,
							outcome: "needs_follow_up" as const,
							notes: "Visible repetition needs a more varied motif.",
						})
					),
				};
				const saved = await call(
					appRouter.textureRepetitionReviews.save,
					input,
					{ context }
				);
				const reread = await call(
					appRouter.textureRepetitionReviews.list,
					{ projectId, assetFamilyId: familyId },
					{
						context: {
							...context,
							textureRepetitionReviewStore: createTextureRepetitionReviewStore(
								rereadDb as unknown as Database
							),
						},
					}
				);
				expect(reread).toEqual([saved]);
				expect(saved.edgeCheck).toEqual({
					x: { mismatchCount: 0, firstMismatch: null },
					y: { mismatchCount: 0, firstMismatch: null },
				});
				expect(
					await call(appRouter.textureRepetitionReviews.save, input, {
						context,
					})
				).toEqual(saved);
				const packaged = textureRepetitionPackageSchema.parse(
					JSON.parse(JSON.stringify(createTextureRepetitionPackage(saved)))
				);
				expect(packaged.record).toEqual(saved);
				await expect(
					call(
						appRouter.textureRepetitionReviews.save,
						{
							...input,
							id: crypto.randomUUID(),
							unitVersionId: "foreign-unit",
						},
						{ context }
					)
				).rejects.toMatchObject({ code: "BAD_REQUEST" });
				await expect(
					call(
						appRouter.textureRepetitionReviews.list,
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
						appRouter.textureRepetitionReviews.list,
						{ projectId, assetFamilyId: familyId },
						{ context }
					)
				).toEqual([]);
			} finally {
				await connection.close();
				await second.close();
			}
		});
	},
	120_000
);
