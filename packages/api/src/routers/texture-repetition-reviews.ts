import { isDeepStrictEqual } from "node:util";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import {
	type TextureRepetitionTarget,
	textureEdgeCheckSchema,
	textureRepetitionListInputSchema,
	textureRepetitionReviewInputSchema,
	textureRepetitionReviewRecordSchema,
	textureRepetitionTargetSchema,
} from "../texture-repetition-reviews";

function getStore(context: Context) {
	if (!context.textureRepetitionReviewStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR");
	}
	return context.textureRepetitionReviewStore;
}
async function inspect(context: Context, input: TextureRepetitionTarget) {
	const userId = context.session?.user.id;
	if (!userId) {
		throw new ORPCError("UNAUTHORIZED");
	}
	if (
		!(await getStore(context).list(
			userId,
			input.projectId,
			input.assetFamilyId
		))
	) {
		throw new ORPCError("NOT_FOUND", { message: "Asset Family not found." });
	}
	const activation = await context.specializedProfileContractStore?.getActive(
		userId,
		input.projectId,
		"tileset_terrain_texture"
	);
	if (!activation) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				"Activate the tileset and texture Specialized Profile Contract first.",
		});
	}
	if (activation.contractRevisionId !== input.contractRevisionId) {
		throw new ORPCError("CONFLICT", {
			message: "Specialized Profile Contract changed. Reload before reviewing.",
		});
	}
	const [catalog, records] = await Promise.all([
		context.assetVersionStore.list(userId, input.projectId),
		context.assetRecordStore.list(userId, input.projectId),
	]);
	const unit = catalog?.unitVersions.find(
		(item) =>
			item.id === input.unitVersionId &&
			item.projectId === input.projectId &&
			item.unitType === "tile"
	);
	const version = catalog?.assetVersions.find(
		(item) =>
			item.id === unit?.assetVersionId &&
			item.assetRecordId === unit?.assetRecordId &&
			item.assetFamilyId === input.assetFamilyId &&
			item.projectId === input.projectId
	);
	const record = records?.find(
		(item) =>
			item.id === unit?.assetRecordId &&
			item.assetCategory === "tileset_terrain_texture" &&
			item.availability !== "erased"
	);
	if (
		!(unit && version?.integrityVerified && version.contentDigest && record)
	) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Choose an intact texture Unit Version in this family.",
		});
	}
	const dimensions = version.sourceImageDimensions;
	if (
		dimensions &&
		(input.atlasRegion.x + input.atlasRegion.width > dimensions.width ||
			input.atlasRegion.y + input.atlasRegion.height > dimensions.height)
	) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Atlas region must lie inside the exact source image.",
		});
	}
	const edgeCheck = await context.checkTextureEdges?.(
		userId,
		input.projectId,
		version.id,
		input.atlasRegion,
		input.repeatAxes
	);
	if (!edgeCheck) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				"Texture bytes could not be verified. Reload or reimport the source image.",
		});
	}
	return {
		unitSnapshot: unit,
		contentDigest: version.contentDigest,
		contractSnapshot: activation.contract,
		edgeCheck,
	};
}
export const textureRepetitionReviewsRouter = {
	list: protectedProcedure
		.input(textureRepetitionListInputSchema)
		.output(z.array(textureRepetitionReviewRecordSchema))
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
	inspect: protectedProcedure
		.input(textureRepetitionTargetSchema)
		.output(textureEdgeCheckSchema)
		.handler(
			async ({ context, input }) => (await inspect(context, input)).edgeCheck
		),
	save: protectedProcedure
		.input(textureRepetitionReviewInputSchema)
		.output(textureRepetitionReviewRecordSchema)
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
			const existing = records.find((item) => item.id === input.id);
			if (existing) {
				const savedInput = Object.fromEntries(
					Object.keys(input).map((key) => [
						key,
						existing[key as keyof typeof existing],
					])
				);
				if (!isDeepStrictEqual(savedInput, input)) {
					throw new ORPCError("CONFLICT", {
						message: "Review operation id was reused with different input.",
					});
				}
				return existing;
			}
			const result = await inspect(context, input);
			const record = textureRepetitionReviewRecordSchema.parse({
				...input,
				...result,
				createdAt: new Date().toISOString(),
				reviewedByUserId: userId,
			});
			const saved = await store.append(userId, record);
			if (!saved) {
				throw new ORPCError("CONFLICT", {
					message: "Texture or contract changed. Reload before reviewing.",
				});
			}
			const reread = (
				await store.list(userId, input.projectId, input.assetFamilyId)
			)?.find((item) => item.id === saved.id);
			if (!(reread && isDeepStrictEqual(saved, reread))) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Texture review could not be read back after saving.",
				});
			}
			return reread;
		}),
};
