import { isDeepStrictEqual } from "node:util";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import {
	iconFamilyReviewInputSchema,
	iconFamilyReviewListInputSchema,
	iconFamilyReviewRecordSchema,
} from "../icon-family-reviews";
import { protectedProcedure } from "../index";

function getStore(context: Context) {
	if (!context.iconFamilyReviewStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR");
	}
	return context.iconFamilyReviewStore;
}

export const iconFamilyReviewsRouter = {
	list: protectedProcedure
		.input(iconFamilyReviewListInputSchema)
		.output(z.array(iconFamilyReviewRecordSchema))
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
		.input(iconFamilyReviewInputSchema)
		.output(iconFamilyReviewRecordSchema)
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
						iconFamilyReviewInputSchema.strip().parse(existingReview),
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
					"icon"
				);
			if (!activation) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Activate the icon Specialized Profile Contract first.",
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
						(family) => family.id === input.assetFamilyId
					) &&
					records &&
					catalog
				)
			) {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Family or its records were not found.",
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
							assetRecord.assetCategory === "icon" &&
							assetRecord.availability !== "erased" &&
							version &&
							version.assetRecordId === assetRecord.id &&
							version.assetFamilyId === input.assetFamilyId &&
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
								"Every compared item must reference an intact icon Asset Version in this family.",
						});
					}
					return {
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
			const reviewRecord = iconFamilyReviewRecordSchema.parse({
				...input,
				contractSnapshot: activation.contract,
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
					message: "Icon Family Review could not be read back after saving.",
				});
			}
			return persisted;
		}),
};
