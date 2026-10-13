import { isDeepStrictEqual } from "node:util";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import {
	getPortraitReviewOutcome,
	portraitIdentityReviewInputSchema,
	portraitIdentityReviewListInputSchema,
	portraitIdentityReviewRecordSchema,
} from "../portrait-identity-reviews";

function getStore(context: Context) {
	if (!context.portraitIdentityReviewStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR");
	}
	return context.portraitIdentityReviewStore;
}

export const portraitIdentityReviewsRouter = {
	list: protectedProcedure
		.input(portraitIdentityReviewListInputSchema)
		.output(z.array(portraitIdentityReviewRecordSchema))
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
		.input(portraitIdentityReviewInputSchema)
		.output(portraitIdentityReviewRecordSchema)
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
						portraitIdentityReviewInputSchema.strip().parse(existingReview),
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
					message: "Activate the portrait Specialized Profile Contract first.",
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
			const canonical = catalog.canonicalDesigns
				.filter((design) => design.assetFamilyId === input.assetFamilyId)
				.at(-1);
			if (
				!family ||
				family.visualWorldId !== input.visualWorldId ||
				family.subjectIdentityId !== input.subjectIdentityId ||
				!canonical ||
				canonical.id !== input.canonicalDesignId
			) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Use the portrait family's Subject Identity, Visual World and current Canonical Design.",
				});
			}
			const canonicalVersion = catalog.assetVersions.find(
				(version) => version.id === canonical.assetVersionId
			);
			if (canonicalVersion?.reviewDisposition !== "approved") {
				throw new ORPCError("BAD_REQUEST", {
					message: "The portrait Canonical Design must be approved.",
				});
			}
			for (const item of input.items) {
				if (
					item.assetVersionId !== canonical.assetVersionId &&
					!familyCatalog.relationships.some(
						(link) =>
							link.type === "derivative" &&
							link.assetFamilyId === family.id &&
							link.sourceAssetRecordId === canonical.assetRecordId &&
							link.sourceAssetVersionId === canonical.assetVersionId &&
							link.targetAssetRecordId === item.assetRecordId
					)
				) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"Every expression must retain the exact portrait Canonical Design lineage.",
					});
				}
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
				...new Set([
					canonical.assetVersionId,
					...input.items.map((item) => item.assetVersionId),
				]),
			];
			const accessibleVersionIds =
				(await store.listAccessibleVersionIds(
					userId,
					input.projectId,
					input.assetFamilyId
				)) ?? new Set<string>();
			const versionPins = await Promise.all(
				versionIds.map(async (assetVersionId) => {
					const item =
						assetVersionId === canonical.assetVersionId
							? { assetRecordId: canonical.assetRecordId }
							: input.items.find(
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
							version.integrityVerified &&
							version.contentDigest &&
							version.sourceImageDimensions &&
							input.items
								.filter((entry) => entry.assetVersionId === assetVersionId)
								.every(
									(entry) =>
										entry.assetRecordId === version.assetRecordId &&
										entry.naturalSize.width ===
											version.sourceImageDimensions?.width &&
										entry.naturalSize.height ===
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
								"Every compared item must reference an intact portrait Asset Version in this family.",
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
			const reviewRecord = portraitIdentityReviewRecordSchema.parse({
				...input,
				contractSnapshot: activation.contract,
				canonicalAssetVersionId: canonical.assetVersionId,
				familyName: family.name,
				useContext: family.useContext,
				outcome: getPortraitReviewOutcome(input.observations),
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
						"Portrait Identity Review could not be read back after saving.",
				});
			}
			return persisted;
		}),
};
