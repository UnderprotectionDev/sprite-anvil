import { isDeepStrictEqual } from "node:util";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import {
	makeUiProfileManifest,
	uiProfileManifestSchema,
} from "../ui-profile-export";
import {
	evaluateUiStretchTest,
	uiStretchTestInputSchema,
	uiStretchTestListInputSchema,
	uiStretchTestRecordSchema,
} from "../ui-stretch-tests";

function getStore(context: Context) {
	if (!context.uiStretchTestStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR");
	}
	return context.uiStretchTestStore;
}

export const uiStretchTestsRouter = {
	export: protectedProcedure
		.input(uiStretchTestListInputSchema.extend({ id: z.uuid() }).strict())
		.output(uiProfileManifestSchema)
		.handler(async ({ context, input }) => {
			const records = await getStore(context).list(
				context.session.user.id,
				input.projectId,
				input.assetFamilyId
			);
			const record = records?.find((r) => r.id === input.id);
			if (!record) {
				throw new ORPCError("NOT_FOUND", {
					message: "UI Stretch Test not found.",
				});
			}
			return makeUiProfileManifest(record);
		}),
	list: protectedProcedure
		.input(uiStretchTestListInputSchema)
		.output(z.array(uiStretchTestRecordSchema))
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
		.input(uiStretchTestInputSchema)
		.output(uiStretchTestRecordSchema)
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
			const existingTest = existingRecords.find(
				(storedRecord) => storedRecord.id === input.id
			);
			if (existingTest) {
				if (
					!isDeepStrictEqual(
						uiStretchTestInputSchema.strip().parse(existingTest),
						input
					)
				) {
					throw new ORPCError("CONFLICT", {
						message:
							"Stretch test operation id was reused with different input.",
					});
				}
				return existingTest;
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
					message: "The stretch test must use its Asset Family's Visual World.",
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
			const sources = [
				...input.states,
				...(input.screen ? [input.screen] : []),
			];
			const versionIds = [
				...new Set(sources.map((item) => item.assetVersionId)),
			];
			const accessibleVersionIds =
				(await store.listAccessibleVersionIds(
					userId,
					input.projectId,
					input.assetFamilyId
				)) ?? new Set<string>();
			const versionPins = await Promise.all(
				versionIds.map(async (assetVersionId) => {
					const item = sources.find(
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
							assetRecord.assetCategory === "ui" &&
							assetRecord.availability !== "erased" &&
							version &&
							version.assetRecordId === assetRecord.id &&
							version.assetFamilyId === input.assetFamilyId &&
							version.integrityVerified &&
							version.contentDigest &&
							version.sourceImageDimensions &&
							input.states
								.filter((state) => state.assetVersionId === version.id)
								.every(
									(state) =>
										state.assetRecordId === version.assetRecordId &&
										state.naturalSize.width ===
											version.sourceImageDimensions?.width &&
										state.naturalSize.height ===
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
								"Every state and screen must reference an intact UI Asset Version in this family.",
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
			const testRecord = uiStretchTestRecordSchema.parse({
				...input,
				contractVersion: "ui-stretch-test/1.0.0",
				contractSnapshot: activation.contract,
				evaluations: evaluateUiStretchTest(input),
				createdAt: new Date().toISOString(),
				createdByUserId: userId,
				versionPins,
			});
			const saved = await store.append(userId, testRecord);
			if (!saved) {
				throw new ORPCError("CONFLICT", {
					message:
						"Stretch test target changed or operation id was reused. Check current records.",
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
					message: "UI Stretch Test could not be read back after saving.",
				});
			}
			return persisted;
		}),
};
