import { isDeepStrictEqual } from "node:util";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import {
	marketingUsageReviewInputSchema,
	marketingUsageReviewListInputSchema,
	marketingUsageReviewRecordSchema,
} from "../marketing-usage-reviews";

function getStore(context: Context) {
	if (!context.marketingUsageReviewStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR");
	}
	return context.marketingUsageReviewStore;
}

export const marketingUsageReviewsRouter = {
	list: protectedProcedure
		.input(marketingUsageReviewListInputSchema)
		.output(z.array(marketingUsageReviewRecordSchema))
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
		.input(marketingUsageReviewInputSchema)
		.output(marketingUsageReviewRecordSchema)
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
			const existingReview = existingRecords.find(
				(storedRecord) => storedRecord.id === input.id
			);
			if (existingReview) {
				if (
					!isDeepStrictEqual(
						marketingUsageReviewInputSchema.strip().parse(existingReview),
						input
					)
				) {
					throw new ORPCError("CONFLICT", {
						message: "Review operation id was reused with different input.",
					});
				}
				return existingReview;
			}

			const activation =
				await context.specializedProfileContractStore?.getActive(
					userId,
					input.projectId,
					"portrait_logo_marketing"
				);
			if (!activation) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Activate the portrait and marketing Specialized Profile Contract first.",
				});
			}
			if (activation.contractRevisionId !== input.contractRevisionId) {
				throw new ORPCError("CONFLICT", {
					message:
						"Specialized Profile Contract changed. Reload before reviewing.",
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
			if (
				!family ||
				family.visualWorldId !== input.visualWorldId ||
				(catalog.canonicalDesigns
					.filter((design) => design.assetFamilyId === input.assetFamilyId)
					.at(-1)?.id ?? null) !== input.canonicalDesignId
			) {
				throw new ORPCError("CONFLICT", {
					message:
						"Visual World or Canonical Design changed. Reload before reviewing.",
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
				...new Set(input.items.map((item) => item.assetVersionId)),
			];
			const accessibleVersionIds =
				(await store.listAccessibleVersionIds(
					userId,
					input.projectId,
					input.assetFamilyId
				)) ?? new Set<string>();
			const versionPins = await Promise.all(
				versionIds.map(async (assetVersionId) => {
					const item = input.items.find(
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
							assetRecord.assetCategory === "portrait_logo_marketing" &&
							assetRecord.availability !== "erased" &&
							version &&
							version.assetRecordId === assetRecord.id &&
							version.assetFamilyId === input.assetFamilyId &&
							version.projectId === input.projectId &&
							version.integrityVerified &&
							version.contentDigest &&
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
								"Every compared item must reference an intact marketing Asset Version in this family.",
						});
					}
					const usages = input.items.filter(
						(candidate) => candidate.assetVersionId === assetVersionId
					);
					if (
						!version.sourceImageDimensions ||
						usages.some(
							(usage) =>
								usage.assetRecordId !== assetRecord.id ||
								usage.naturalSize.width !==
									version.sourceImageDimensions?.width ||
								usage.naturalSize.height !==
									version.sourceImageDimensions?.height
						)
					) {
						throw new ORPCError("BAD_REQUEST", {
							message: "Usage dimensions must match the verified source image.",
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
			const reviewRecord = marketingUsageReviewRecordSchema.parse({
				...input,
				contractSnapshot: activation.contract,
				canonicalAssetVersionId:
					catalog.canonicalDesigns
						.filter((design) => design.assetFamilyId === input.assetFamilyId)
						.at(-1)?.assetVersionId ?? null,
				createdAt: new Date().toISOString(),
				reviewedByUserId: userId,
				versionPins,
			});
			const saved = await store.append(userId, reviewRecord);
			if (!saved) {
				throw new ORPCError("CONFLICT", {
					message:
						"Review target changed or operation id was reused. Check current records.",
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
						"Marketing Usage Review could not be read back after saving.",
				});
			}
			return persisted;
		}),
};
