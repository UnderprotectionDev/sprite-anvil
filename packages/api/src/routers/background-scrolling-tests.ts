import { isDeepStrictEqual } from "node:util";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { backgroundLayerLayoutListInputSchema } from "../background-layer-layouts";
import {
	backgroundScrollingTestInputSchema,
	backgroundScrollingTestRecordSchema,
	getBackgroundScrollingOutcome,
} from "../background-scrolling-tests";
import type { Context } from "../context";
import { protectedProcedure } from "../index";

function getStore(context: Context) {
	if (!context.backgroundScrollingTestStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR");
	}
	return context.backgroundScrollingTestStore;
}
export const backgroundScrollingTestsRouter = {
	list: protectedProcedure
		.input(backgroundLayerLayoutListInputSchema)
		.output(z.array(backgroundScrollingTestRecordSchema))
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
		.input(backgroundScrollingTestInputSchema)
		.output(backgroundScrollingTestRecordSchema)
		.handler(async ({ context, input }) => {
			const store = getStore(context);
			const userId = context.session.user.id;
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
			const existing = records.find((record) => record.id === input.id);
			if (existing) {
				if (
					!isDeepStrictEqual(
						backgroundScrollingTestInputSchema.strip().parse(existing),
						input
					)
				) {
					throw new ORPCError("CONFLICT", {
						message: "Scrolling operation id was reused with different input.",
					});
				}
				return existing;
			}
			const layouts = await context.backgroundLayerLayoutStore?.list(
				userId,
				input.projectId,
				input.assetFamilyId
			);
			const layout = layouts?.find(
				(record) => record.id === input.setup.layoutId
			);
			if (!layout) {
				throw new ORPCError("NOT_FOUND", {
					message: "Exact layer layout is unavailable.",
				});
			}
			const activation =
				await context.specializedProfileContractStore?.getActive(
					userId,
					input.projectId,
					"background_parallax"
				);
			if (activation?.contractRevisionId !== layout.contractRevisionId) {
				throw new ORPCError("CONFLICT", {
					message:
						"Specialized Profile Contract changed. Save a current layer layout first.",
				});
			}
			const [catalog, assets] = await Promise.all([
				context.assetVersionStore.list(userId, input.projectId),
				context.assetRecordStore.list(userId, input.projectId),
			]);
			const player = catalog?.assetVersions.find(
				(version) => version.id === input.setup.player.assetVersionId
			);
			const asset = assets?.find(
				(record) => record.id === player?.assetRecordId
			);
			if (
				!(
					player?.integrityVerified &&
					player.contentDigest &&
					player.sourceImageDimensions &&
					asset &&
					asset.availability !== "erased" &&
					asset.assetCategory === "character_creature_animation"
				)
			) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Select an intact character Asset Version from this project for the player silhouette.",
				});
			}
			const contentIds = [
				...new Set([
					...layout.versionPins.map((pin) => pin.assetVersionId),
					player.id,
				]),
			];
			const readable = await Promise.all(
				contentIds.map((versionId) =>
					context.verifyAssetVersionContent?.(
						userId,
						input.projectId,
						versionId
					)
				)
			);
			if (readable.some((value) => value !== true)) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Exact background and player content must remain readable.",
				});
			}
			const parsed = backgroundScrollingTestRecordSchema.safeParse({
				...input,
				layoutSnapshot: layout,
				playerPin: {
					assetVersionId: player.id,
					assetRecordId: asset.id,
					assetRecordName: asset.name,
					versionNumber: player.versionNumber,
					contentDigest: player.contentDigest,
					...player.sourceImageDimensions,
				},
				outcome: getBackgroundScrollingOutcome(input.observations),
				createdByUserId: userId,
				createdAt: new Date().toISOString(),
			});
			if (!parsed.success) {
				throw new ORPCError("BAD_REQUEST", {
					message: parsed.error.issues.map((issue) => issue.message).join(" "),
				});
			}
			const saved = await store.append(userId, parsed.data);
			if (!saved) {
				throw new ORPCError("CONFLICT", {
					message:
						"Scrolling target changed or operation id was reused. Check current tests.",
				});
			}
			const readback = await store.list(
				userId,
				input.projectId,
				input.assetFamilyId
			);
			const persisted = readback?.find((record) => record.id === saved.id);
			if (!(persisted && isDeepStrictEqual(saved, persisted))) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Scrolling test could not be read back after saving.",
				});
			}
			return persisted;
		}),
};
