import { isDeepStrictEqual } from "node:util";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import {
	assetFamilyComparisonInputSchema,
	assetFamilyComparisonListInputSchema,
	assetFamilyComparisonRecordSchema,
} from "../asset-family-comparisons";
import type { Context } from "../context";
import { protectedProcedure } from "../index";

const profileId = "object_weapon_equipment_states";

function getStore(context: Context) {
	if (!context.assetFamilyComparisonStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR");
	}
	return context.assetFamilyComparisonStore;
}

function sameIds(left: string[], right: string[]) {
	const sortedLeft = [...left].sort();
	const sortedRight = [...right].sort();
	return (
		sortedLeft.length === sortedRight.length &&
		sortedLeft.every((id, index) => id === sortedRight[index])
	);
}

export const assetFamilyComparisonsRouter = {
	list: protectedProcedure
		.input(assetFamilyComparisonListInputSchema)
		.output(z.array(assetFamilyComparisonRecordSchema))
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
		.input(assetFamilyComparisonInputSchema)
		.output(assetFamilyComparisonRecordSchema)
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
			const existing = records.find(
				(assetRecord) => assetRecord.id === input.id
			);
			if (existing) {
				if (
					!isDeepStrictEqual(
						assetFamilyComparisonInputSchema.strip().parse(existing),
						input
					)
				) {
					throw new ORPCError("CONFLICT", {
						message: "Comparison operation id was reused with different input.",
					});
				}
				return existing;
			}

			const [catalog, assetRecords, activation] = await Promise.all([
				context.assetVersionStore.list(userId, input.projectId),
				context.assetRecordStore.list(userId, input.projectId),
				context.specializedProfileContractStore?.getActive(
					userId,
					input.projectId,
					profileId
				),
			]);
			if (!(catalog && assetRecords)) {
				throw new ORPCError("NOT_FOUND", {
					message: "Project or Asset Family not found.",
				});
			}
			if (!activation) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Activate the object and equipment Specialized Profile Contract first.",
				});
			}
			if (activation.contractRevisionId !== input.contractRevisionId) {
				throw new ORPCError("CONFLICT", {
					message:
						"Specialized Profile Contract changed. Reload before comparing.",
				});
			}

			const recordById = new Map(
				assetRecords.map((assetRecord) => [assetRecord.id, assetRecord])
			);
			const latestVersionByRecord = new Map<
				string,
				(typeof catalog.assetVersions)[number]
			>();
			for (const version of catalog.assetVersions) {
				if (version.assetFamilyId !== input.assetFamilyId) {
					continue;
				}
				const latest = latestVersionByRecord.get(version.assetRecordId);
				if (!latest || version.versionNumber > latest.versionNumber) {
					latestVersionByRecord.set(version.assetRecordId, version);
				}
			}

			const versionPins = await Promise.all(
				input.assetVersions.map(async (selection) => {
					const record = recordById.get(selection.assetRecordId);
					const version = latestVersionByRecord.get(selection.assetRecordId);
					const selectedVersion = catalog.assetVersions.find(
						(candidate) => candidate.id === selection.assetVersionId
					);
					const actualUnitVersions = catalog.unitVersions.filter(
						(unitVersion) =>
							unitVersion.assetVersionId === selection.assetVersionId &&
							unitVersion.assetRecordId === selection.assetRecordId
					);
					if (
						!(
							record &&
							version &&
							selectedVersion?.id === version.id &&
							selectedVersion.assetFamilyId === input.assetFamilyId &&
							record.availability !== "erased" &&
							record.assetCategory === profileId &&
							version.integrityVerified &&
							version.contentDigest &&
							context.verifyAssetVersionContent &&
							(await context.verifyAssetVersionContent(
								userId,
								input.projectId,
								version.id
							))
						)
					) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"Choose the latest intact Asset Version from each Asset Record in this family.",
						});
					}
					if (
						!sameIds(
							selection.unitVersionIds,
							actualUnitVersions.map((unitVersion) => unitVersion.id)
						)
					) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"Include every Unit Version attached to each selected Asset Version.",
						});
					}
					return {
						assetRecordId: selection.assetRecordId,
						assetRecordName: record.name,
						assetVersionId: version.id,
						contentDigest: version.contentDigest,
						unitVersions: actualUnitVersions.map((unitVersion) => ({
							id: unitVersion.id,
							unitKey: unitVersion.unitKey,
							unitType: unitVersion.unitType,
							versionNumber: unitVersion.versionNumber,
						})),
						versionNumber: version.versionNumber,
					};
				})
			);

			const comparisonRecord = assetFamilyComparisonRecordSchema.parse({
				...input,
				createdAt: new Date().toISOString(),
				contractSnapshot: activation.contract,
				reviewedByUserId: userId,
				versionPins,
			});
			const saved = await store.append(userId, comparisonRecord);
			if (!saved) {
				throw new ORPCError("CONFLICT", {
					message:
						"An Asset Version or family changed while saving. Reload and compare again.",
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
				throw new ORPCError("INTERNAL_SERVER_ERROR");
			}
			return persisted;
		}),
};
