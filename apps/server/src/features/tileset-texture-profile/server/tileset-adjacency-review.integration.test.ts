import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import { tilesetMapScenarios } from "@sprite-anvil/api/tileset-adjacency-reviews";
import type { Database } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersions,
	compositeVersions,
	compositionMemberships,
	unitVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { project } from "@sprite-anvil/db/schema/project";
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { createAssetRecordStore } from "../../asset-records/server/asset-record-store";
import { createAssetVersionStore } from "../../asset-versions/server/asset-version-store";
import { createSpecializedProfileContractStore } from "../../quality-evidence/server/specialized-profile-contract-store";
import { createTilesetAdjacencyReviewStore } from "./tileset-adjacency-review-store";

const databaseUrl = process.env.TILESET_ADJACENCY_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"persists atlas regions, terrain links and issue targets through the API and rereads on a second PostgreSQL connection",
	async () => {
		if (
			!databaseUrl ||
			new URL(databaseUrl).hostname !== "127.0.0.1" ||
			new URL(databaseUrl).pathname !== "/tileset_adjacency_test"
		) {
			throw new Error(
				"Use only a disposable loopback tileset_adjacency_test database."
			);
		}
		const connection = new SQL(databaseUrl);
		const second = new SQL(databaseUrl);
		const db = drizzle({ client: connection }) as unknown as Database;
		const rereadDb = drizzle({ client: second }) as unknown as Database;
		const owner = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const worldId = crypto.randomUUID();
		const familyId = crypto.randomUUID();
		const recordId = crypto.randomUUID();
		const versionIds = [
			crypto.randomUUID(),
			crypto.randomUUID(),
			crypto.randomUUID(),
		] as const;
		const compositeId = crypto.randomUUID();
		const sourceVersionId = crypto.randomUUID();
		const unitIds = [
			crypto.randomUUID(),
			crypto.randomUUID(),
			crypto.randomUUID(),
		] as const;
		try {
			await db.insert(user).values({
				id: owner,
				name: "Tileset review owner",
				email: `${owner}@example.test`,
			});
			await db
				.insert(project)
				.values({ id: projectId, ownerUserId: owner, name: "Forest terrain" });
			await db.insert(visualWorlds).values({
				id: worldId,
				projectId,
				name: "Forest",
				createdByUserId: owner,
			});
			await db.insert(assetFamilies).values({
				id: familyId,
				projectId,
				visualWorldId: worldId,
				name: "Forest tiles",
				useContext: "Terrain",
				createdByUserId: owner,
			});
			await db.insert(assetRecords).values({
				id: recordId,
				projectId,
				assetFamilyId: familyId,
				assetCategory: "tileset_terrain_texture",
				name: "Forest atlas",
				supportLevel: "general",
				availability: "active",
				createdByUserId: owner,
			});
			await db.insert(assetVersions).values(
				[sourceVersionId, ...versionIds].map((id, index) => ({
					id,
					projectId,
					assetFamilyId: familyId,
					assetRecordId: recordId,
					versionNumber: index + 1,
					contentType: "image/png",
					byteSize: 100,
					objectKey: `test/${id}`,
					contentDigest: "a".repeat(64),
					integrityVerified: true,
					sourceImageWidth: 48,
					sourceImageHeight: 16,
					createdByUserId: owner,
				}))
			);
			await db.insert(unitVersions).values(
				unitIds.map((id, index) => ({
					id,
					projectId,
					assetRecordId: recordId,
					assetVersionId: versionIds[index] ?? "",
					sourceAssetVersionId: sourceVersionId,
					unitType: "tile" as const,
					unitKey: `terrain-${index}`,
					versionNumber: 1,
					createdByUserId: owner,
				}))
			);
			await db.insert(compositeVersions).values({
				id: compositeId,
				projectId,
				assetRecordId: recordId,
				versionNumber: 1,
				idempotencyKey: crypto.randomUUID(),
				createdByUserId: owner,
			});
			await db.insert(compositionMemberships).values(
				unitIds.map((id, index) => ({
					id: crypto.randomUUID(),
					projectId,
					assetRecordId: recordId,
					compositeVersionId: compositeId,
					unitVersionId: id,
					unitType: "tile" as const,
					unitKey: `terrain-${index}`,
				}))
			);
			const contractStore = createSpecializedProfileContractStore(db);
			const contract = specializedProfileContractCatalog.find(
				(item) => item.profileId === "tileset_terrain_texture"
			);
			if (!contract) {
				throw new Error("Missing tileset contract.");
			}
			expect(
				await contractStore.activate(
					owner,
					projectId,
					contract.profileId,
					contract
				)
			).toBe(true);
			const activation = await contractStore.getActive(
				owner,
				projectId,
				contract.profileId
			);
			if (!activation) {
				throw new Error("Missing activation.");
			}
			const context = {
				session: { user: { id: owner } },
				assetRecordStore: createAssetRecordStore(db),
				assetVersionStore: createAssetVersionStore(db),
				specializedProfileContractStore: contractStore,
				tilesetAdjacencyReviewStore: createTilesetAdjacencyReviewStore(db),
				verifyAssetVersionContent: async () => true,
			} as unknown as Context;
			const input = {
				id: crypto.randomUUID(),
				projectId,
				assetFamilyId: familyId,
				compositeVersionId: compositeId,
				contractRevisionId: activation.contractRevisionId,
				tiles: unitIds.map((id, index) => ({
					unitVersionId: id,
					terrainId: "grass",
					region: { x: index * 16, y: 0, width: 16, height: 16 },
					edges: {
						north: "grass",
						east: "grass",
						south: "grass",
						west: index === 1 ? "water" : "grass",
					},
				})),
				maps: tilesetMapScenarios.map((scenario) => ({
					scenario,
					width: 2,
					height: 2,
					cells: [unitIds[0], unitIds[1], unitIds[2], unitIds[0]],
					outcome: "failed" as const,
					notes: "West connector mismatch",
					issues: [
						{ cellIndex: 0, neighborIndex: 1, notes: "Grass meets water" },
					],
				})),
			};
			const saved = await call(appRouter.tilesetAdjacencyReviews.save, input, {
				context,
			});
			expect(saved.tiles).toEqual(input.tiles);
			expect(saved.versionPins.map((pin) => pin.tileId)).toEqual([
				"terrain-0",
				"terrain-1",
				"terrain-2",
			]);
			expect(saved.adjacencyIssues).toContainEqual({
				scenario: "inner_corner",
				cellIndex: 0,
				neighborIndex: 1,
				unitVersionId: unitIds[0],
				neighborUnitVersionId: unitIds[1],
				edge: "east",
				result: "mismatch",
			});
			const rereadContext = {
				...context,
				tilesetAdjacencyReviewStore:
					createTilesetAdjacencyReviewStore(rereadDb),
			};
			expect(
				await call(
					appRouter.tilesetAdjacencyReviews.list,
					{ projectId, assetFamilyId: familyId },
					{ context: rereadContext }
				)
			).toEqual([saved]);
			expect(
				await call(appRouter.tilesetAdjacencyReviews.save, input, {
					context: rereadContext,
				})
			).toEqual(saved);
			await expect(
				call(
					appRouter.tilesetAdjacencyReviews.list,
					{ projectId, assetFamilyId: familyId },
					{
						context: {
							...context,
							session: { user: { id: "outsider" } },
						} as unknown as Context,
					}
				)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		} finally {
			await connection.close();
			await second.close();
		}
	}
);
