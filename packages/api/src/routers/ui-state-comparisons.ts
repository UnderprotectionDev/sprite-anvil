import { isDeepStrictEqual } from "node:util";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import {
	uiStateComparisonInputSchema,
	uiStateComparisonListInputSchema,
	uiStateComparisonRecordSchema,
} from "../ui-state-comparisons";

function getStore(context: Context) {
	if (!context.uiStateComparisonStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR");
	}
	return context.uiStateComparisonStore;
}
export const uiStateComparisonsRouter = {
	list: protectedProcedure
		.input(uiStateComparisonListInputSchema)
		.output(z.array(uiStateComparisonRecordSchema))
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
		.input(uiStateComparisonInputSchema)
		.output(uiStateComparisonRecordSchema)
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
			const existing = existingRecords.find((record) => record.id === input.id);
			if (existing) {
				if (
					!isDeepStrictEqual(
						uiStateComparisonInputSchema.strip().parse(existing),
						input
					)
				) {
					throw new ORPCError("CONFLICT", {
						message: "Comparison operation id was reused with different input.",
					});
				}
				return existing;
			}
			const activation =
				await context.specializedProfileContractStore?.getActive(
					userId,
					input.projectId,
					"ui"
				);
			if (!activation) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Activate the UI Specialized Profile Contract first.",
				});
			}
			if (activation.contractRevisionId !== input.contractRevisionId) {
				throw new ORPCError("CONFLICT", {
					message:
						"Specialized Profile Contract changed. Reload before comparing.",
				});
			}
			const [catalog, records, accessible] = await Promise.all([
				context.assetVersionStore.list(userId, input.projectId),
				context.assetRecordStore.list(userId, input.projectId),
				store.listAccessibleVersionIds(
					userId,
					input.projectId,
					input.assetFamilyId
				),
			]);
			const versionIds = [
				...new Set([
					input.screenAssetVersionId,
					...input.items.map((item) => item.assetVersionId),
				]),
			];
			const versionPins = await Promise.all(
				versionIds.map(async (assetVersionId) => {
					const version = catalog?.assetVersions.find(
						(candidate) => candidate.id === assetVersionId
					);
					const assetRecord = records?.find(
						(candidate) => candidate.id === version?.assetRecordId
					);
					if (
						!(
							version &&
							assetRecord &&
							version.assetFamilyId === input.assetFamilyId &&
							assetRecord.assetCategory === "ui" &&
							assetRecord.availability !== "erased" &&
							version.sourceImageDimensions &&
							version.integrityVerified &&
							version.contentDigest &&
							accessible?.has(assetVersionId) &&
							(await context.verifyAssetVersionContent?.(
								userId,
								input.projectId,
								assetVersionId
							))
						)
					) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"Screen and component versions must be intact UI images in this Asset Family.",
						});
					}
					return {
						assetVersionId,
						assetRecordId: assetRecord.id,
						assetRecordName: assetRecord.name,
						contentDigest: version.contentDigest,
						contentLength: version.contentLength,
						contentType: version.contentType,
						versionNumber: version.versionNumber,
						sourceImageDimensions: version.sourceImageDimensions,
					};
				})
			);
			const unitPins = input.items.flatMap((item) => {
				if (!item.unitVersionId) {
					return [];
				}
				const unit = catalog?.unitVersions.find(
					(candidate) =>
						candidate.id === item.unitVersionId &&
						candidate.assetVersionId === item.assetVersionId &&
						candidate.unitType === "state" &&
						candidate.projectId === input.projectId
				);
				if (!unit) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"Choose an exact state Unit Version belonging to the selected image.",
					});
				}
				return [unit];
			});
			const parsed = uiStateComparisonRecordSchema.safeParse({
				...input,
				versionPins,
				unitPins,
				contractSnapshot: activation.contract,
				reviewedByUserId: userId,
				createdAt: new Date().toISOString(),
			});
			if (!parsed.success) {
				throw new ORPCError("BAD_REQUEST", {
					message: parsed.error.issues[0]?.message,
				});
			}
			const saved = await store.append(userId, parsed.data);
			if (!saved) {
				throw new ORPCError("CONFLICT", {
					message: "Comparison target changed. Check current records.",
				});
			}
			const readback = await store.list(
				userId,
				input.projectId,
				input.assetFamilyId
			);
			const persisted = readback?.find((record) => record.id === saved.id);
			if (!(persisted && isDeepStrictEqual(persisted, saved))) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "UI State Comparison could not be read back after saving.",
				});
			}
			return persisted;
		}),
};
