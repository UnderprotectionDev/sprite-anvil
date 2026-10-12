import { isDeepStrictEqual } from "node:util";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import {
	backgroundLayerLayoutInputSchema,
	backgroundLayerLayoutListInputSchema,
	backgroundLayerLayoutRecordSchema,
} from "../background-layer-layouts";
import type { Context } from "../context";
import { protectedProcedure } from "../index";

function getStore(context: Context) {
	if (!context.backgroundLayerLayoutStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR");
	}
	return context.backgroundLayerLayoutStore;
}

export const backgroundLayerLayoutsRouter = {
	list: protectedProcedure
		.input(backgroundLayerLayoutListInputSchema)
		.output(z.array(backgroundLayerLayoutRecordSchema))
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
		.input(backgroundLayerLayoutInputSchema)
		.output(backgroundLayerLayoutRecordSchema)
		.handler(async ({ context, input }) => {
			const store = getStore(context);
			const userId = context.session.user.id;
			const existingRecords = await store.list(
				userId,
				input.projectId,
				input.assetFamilyId
			);
			if (!existingRecords) {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Family not found.",
				});
			}
			const existingLayout = existingRecords.find(
				(storedRecord) => storedRecord.id === input.id
			);
			if (existingLayout) {
				if (
					!isDeepStrictEqual(
						backgroundLayerLayoutInputSchema.strip().parse(existingLayout),
						input
					)
				) {
					throw new ORPCError("CONFLICT", {
						message: "Layout operation id was reused with different input.",
					});
				}
				return existingLayout;
			}

			const activation =
				await context.specializedProfileContractStore?.getActive(
					userId,
					input.projectId,
					"background_parallax"
				);
			if (!activation) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Activate the background Specialized Profile Contract first.",
				});
			}
			if (activation.contractRevisionId !== input.contractRevisionId) {
				throw new ORPCError("CONFLICT", {
					message:
						"Specialized Profile Contract changed. Reload before saving.",
				});
			}

			const [familyCatalog, records, catalog] = await Promise.all([
				context.assetFamilyStore.list(userId, input.projectId),
				context.assetRecordStore.list(userId, input.projectId),
				context.assetVersionStore.list(userId, input.projectId),
			]);
			if (
				!(
					familyCatalog?.assetFamilies.some(
						(candidateFamily) => candidateFamily.id === input.assetFamilyId
					) &&
					records &&
					catalog
				)
			) {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Family or its records were not found.",
				});
			}

			const family = familyCatalog.assetFamilies.find(
				(candidate) => candidate.id === input.assetFamilyId
			);
			if (family?.visualWorldId !== input.visualWorldId) {
				throw new ORPCError("BAD_REQUEST", {
					message: "The layout must use its Asset Family's Visual World.",
				});
			}
			const familyRecordIds = new Set(
				familyCatalog.assetRecords
					.filter(
						(familyAssetRecord) =>
							familyAssetRecord.assetFamilyId === input.assetFamilyId
					)
					.map((familyAssetRecord) => familyAssetRecord.id)
			);
			const recordsById = new Map(
				records.map((assetRecord) => [assetRecord.id, assetRecord])
			);
			const versionIds = [
				...new Set(input.layers.map((item) => item.assetVersionId)),
			];
			const accessibleVersionIds =
				(await store.listAccessibleVersionIds(
					userId,
					input.projectId,
					input.assetFamilyId
				)) ?? new Set<string>();
			const versionPins = await Promise.all(
				versionIds.map(async (assetVersionId) => {
					const item = input.layers.find(
						(candidate) => candidate.assetVersionId === assetVersionId
					);
					const assetRecord = item
						? recordsById.get(item.assetRecordId)
						: undefined;
					const version = catalog.assetVersions.find(
						(candidate) => candidate.id === assetVersionId
					);
					if (
						!(
							item &&
							assetRecord &&
							familyRecordIds.has(assetRecord.id) &&
							assetRecord.assetCategory === "background_parallax" &&
							assetRecord.availability !== "erased" &&
							version &&
							version.assetRecordId === assetRecord.id &&
							version.assetFamilyId === input.assetFamilyId &&
							version.integrityVerified &&
							version.contentDigest &&
							version.sourceImageDimensions &&
							input.layers
								.filter((layer) => layer.assetVersionId === version.id)
								.every(
									(layer) =>
										layer.assetRecordId === version.assetRecordId &&
										layer.naturalSize.width ===
											version.sourceImageDimensions?.width &&
										layer.naturalSize.height ===
											version.sourceImageDimensions?.height
								) &&
							accessibleVersionIds.has(version.id) &&
							(await context.verifyAssetVersionContent?.(
								userId,
								input.projectId,
								version.id
							))
						)
					) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"Every layer must reference an intact background Asset Version in this family.",
						});
					}
					return {
						naturalSize: version.sourceImageDimensions,
						assetRecordId: assetRecord.id,
						assetRecordName: assetRecord.name,
						assetVersionId: version.id,
						contentDigest: version.contentDigest,
						contentLength: version.contentLength,
						contentType: version.contentType,
						versionNumber: version.versionNumber,
					};
				})
			);
			const layoutRecord = backgroundLayerLayoutRecordSchema.parse({
				...input,
				contractSnapshot: activation.contract,
				createdAt: new Date().toISOString(),
				createdByUserId: userId,
				versionPins,
			});
			const saved = await store.append(userId, layoutRecord);
			if (!saved) {
				throw new ORPCError("CONFLICT", {
					message:
						"Layout target changed or operation id was reused. Check current records.",
				});
			}
			const readback = await store.list(
				userId,
				input.projectId,
				input.assetFamilyId
			);
			const persisted = readback?.find(
				(candidate) => candidate.id === saved.id
			);
			if (!(persisted && isDeepStrictEqual(persisted, saved))) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message:
						"Background Layer Layout could not be read back after saving.",
				});
			}
			return persisted;
		}),
};
