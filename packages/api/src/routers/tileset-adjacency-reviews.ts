import { isDeepStrictEqual } from "node:util";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import {
	inspectTilesetAdjacency,
	tilesetAdjacencyReviewInputSchema,
	tilesetAdjacencyReviewListInputSchema,
	tilesetAdjacencyReviewRecordSchema,
} from "../tileset-adjacency-reviews";

function getStore(context: Context) {
	if (!context.tilesetAdjacencyReviewStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR");
	}
	return context.tilesetAdjacencyReviewStore;
}
export const tilesetAdjacencyReviewsRouter = {
	list: protectedProcedure
		.input(tilesetAdjacencyReviewListInputSchema)
		.output(z.array(tilesetAdjacencyReviewRecordSchema))
		.handler(async ({ context, input }) => {
			const records = await getStore(context).list(
				context.session.user.id,
				input.projectId,
				input.assetFamilyId
			);
			if (!records) {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Family not found.",
				});
			}
			return records;
		}),
	save: protectedProcedure
		.input(tilesetAdjacencyReviewInputSchema)
		.output(tilesetAdjacencyReviewRecordSchema)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const store = getStore(context);
			const records = await store.list(
				userId,
				input.projectId,
				input.assetFamilyId
			);
			if (!records) {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Family not found.",
				});
			}
			const existing = records.find((candidate) => candidate.id === input.id);
			if (existing) {
				const original = Object.fromEntries(
					Object.keys(input).map((key) => [
						key,
						existing[key as keyof typeof existing],
					])
				);
				if (!isDeepStrictEqual(original, input)) {
					throw new ORPCError("CONFLICT", {
						message: "Review operation id was reused with different input.",
					});
				}
				return existing;
			}
			const activation =
				await context.specializedProfileContractStore?.getActive(
					userId,
					input.projectId,
					"tileset_terrain_texture"
				);
			if (!activation) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Activate the tileset Specialized Profile Contract first.",
				});
			}
			if (activation.contractRevisionId !== input.contractRevisionId) {
				throw new ORPCError("CONFLICT", {
					message:
						"Specialized Profile Contract changed. Reload before reviewing.",
				});
			}
			const [catalog, assetRecords, accessible] = await Promise.all([
				context.assetVersionStore.list(userId, input.projectId),
				context.assetRecordStore.list(userId, input.projectId),
				store.listAccessibleVersionIds(
					userId,
					input.projectId,
					input.assetFamilyId
				),
			]);
			const composite = catalog?.compositeVersions.find(
				(item) => item.id === input.compositeVersionId
			);
			const assetRecord = assetRecords?.find(
				(item) => item.id === composite?.assetRecordId
			);
			if (
				!(
					composite &&
					assetRecord?.assetCategory === "tileset_terrain_texture" &&
					assetRecord.availability !== "erased"
				)
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Choose a tileset Composite Version in this family.",
				});
			}
			const memberships = composite.compositionMemberships;
			if (
				memberships.length !== input.tiles.length ||
				memberships.some(
					(member) =>
						member.unitType !== "tile" ||
						!input.tiles.some(
							(tile) => tile.unitVersionId === member.unitVersionId
						)
				)
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Include every tile of the exact Composite Version.",
				});
			}
			const versionPins = await Promise.all(
				input.tiles.map(async (tile) => {
					const unit = catalog?.unitVersions.find(
						(item) =>
							item.id === tile.unitVersionId &&
							item.unitType === "tile" &&
							item.assetRecordId === composite.assetRecordId
					);
					const version = catalog?.assetVersions.find(
						(item) =>
							item.id === unit?.assetVersionId &&
							item.assetFamilyId === input.assetFamilyId &&
							item.assetRecordId === composite.assetRecordId
					);
					const dimensions = version?.sourceImageDimensions;
					if (
						!(
							unit &&
							version?.integrityVerified &&
							version.contentDigest &&
							accessible?.has(version.id) &&
							dimensions &&
							tile.region.x + tile.region.width <= dimensions.width &&
							tile.region.y + tile.region.height <= dimensions.height &&
							(await context.verifyAssetVersionContent?.(
								userId,
								input.projectId,
								version.id
							))
						)
					) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"Every tile must reference intact content and an atlas region inside its image.",
						});
					}
					return {
						unitVersionId: unit.id,
						tileId: unit.unitKey,
						assetVersionId: version.id,
						contentDigest: version.contentDigest,
						sourceImageDimensions: dimensions,
					};
				})
			);
			if (
				new Set(versionPins.map((pin) => pin.tileId)).size !==
				versionPins.length
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Tile identities must be unique.",
				});
			}
			const adjacencyIssues = inspectTilesetAdjacency(input);
			if (
				input.maps.some(
					(map) =>
						map.outcome === "passed" &&
						adjacencyIssues.some((issue) => issue.scenario === map.scenario)
				)
			) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Resolve mismatched or unknown connectors before marking a map passed.",
				});
			}
			const record = tilesetAdjacencyReviewRecordSchema.parse({
				contractVersion: "tileset-adjacency-review/1.0.0",
				...input,
				versionPins,
				adjacencyIssues,
				contractSnapshot: activation.contract,
				reviewedByUserId: userId,
				createdAt: new Date().toISOString(),
			});
			const saved = await store.append(userId, record);
			if (!saved) {
				throw new ORPCError("CONFLICT", {
					message: "Review target changed. Reload before saving.",
				});
			}
			const persisted = (
				await store.list(userId, input.projectId, input.assetFamilyId)
			)?.find((item) => item.id === saved.id);
			if (!(persisted && isDeepStrictEqual(persisted, saved))) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message:
						"Tileset adjacency review could not be read back after saving.",
				});
			}
			return persisted;
		}),
};
