import { z } from "zod";
import { specializedProfileContractSchema } from "./specialized-profile-contracts";

const id = z.string().trim().min(1).max(200);

export const assetFamilyComparisonUnitVersionSchema = z
	.object({
		id,
		unitKey: z.string().trim().min(1).max(120),
		unitType: z.enum(["frame", "direction", "tile", "state"]),
		versionNumber: z.number().int().positive(),
	})
	.strict();

export const assetFamilyComparisonAssetVersionSchema = z
	.object({
		assetRecordId: id,
		assetVersionId: id,
		unitVersionIds: z.array(id).max(128).default([]),
	})
	.strict();

export const assetFamilyComparisonListInputSchema = z
	.object({ projectId: id, assetFamilyId: id })
	.strict();

export const assetFamilyComparisonInputSchema =
	assetFamilyComparisonListInputSchema
		.extend({
			assetVersions: z
				.array(assetFamilyComparisonAssetVersionSchema)
				.min(
					2,
					"Choose current Asset Versions from at least two Asset Records."
				)
				.max(100)
				.superRefine((assetVersions, context) => {
					for (const [field, values] of [
						[
							"assetRecordId",
							assetVersions.map((assetVersion) => assetVersion.assetRecordId),
						],
						[
							"assetVersionId",
							assetVersions.map((assetVersion) => assetVersion.assetVersionId),
						],
					] as const) {
						if (new Set(values).size !== values.length) {
							context.addIssue({
								code: "custom",
								message: `Each compared Asset Version must come from a different Asset Record; duplicate ${field} values are not allowed.`,
								path: [field],
							});
						}
					}

					const unitVersionIds = assetVersions.flatMap(
						(assetVersion) => assetVersion.unitVersionIds
					);
					if (new Set(unitVersionIds).size !== unitVersionIds.length) {
						context.addIssue({
							code: "custom",
							message: "A Unit Version can appear only once in a comparison.",
							path: ["unitVersionIds"],
						});
					}
				})
				.describe(
					"Exact current Asset Versions, one from each of at least two Asset Records."
				),
			contractRevisionId: id,
			id: z.uuid(),
			observations: z
				.object({
					materialLanguage: z.string().trim().min(1).max(1000),
					perspective: z.string().trim().min(1).max(1000),
					scale: z.string().trim().min(1).max(1000),
					stateDirectionDistinction: z.string().trim().min(1).max(1000),
				})
				.strict(),
		})
		.strict();

export const assetFamilyComparisonVersionPinSchema = z
	.object({
		assetRecordId: id,
		assetRecordName: z.string().trim().min(1).max(120),
		assetVersionId: id,
		contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
		unitVersions: z.array(assetFamilyComparisonUnitVersionSchema).max(128),
		versionNumber: z.number().int().positive(),
	})
	.strict();

export const assetFamilyComparisonRecordSchema =
	assetFamilyComparisonInputSchema
		.extend({
			createdAt: z.string().datetime(),
			contractSnapshot: specializedProfileContractSchema,
			reviewedByUserId: id,
			versionPins: z
				.array(assetFamilyComparisonVersionPinSchema)
				.min(2)
				.max(100),
		})
		.strict()
		.superRefine((record, context) => {
			const pinsByVersionId = new Map(
				record.versionPins.map((pin) => [pin.assetVersionId, pin])
			);
			if (pinsByVersionId.size !== record.versionPins.length) {
				context.addIssue({
					code: "custom",
					message: "Each current Asset Version must be pinned only once.",
					path: ["versionPins"],
				});
			}
			if (record.assetVersions.length !== record.versionPins.length) {
				context.addIssue({
					code: "custom",
					message:
						"Every compared Asset Version must have one immutable version pin.",
					path: ["versionPins"],
				});
				return;
			}

			for (const assetVersion of record.assetVersions) {
				const pin = pinsByVersionId.get(assetVersion.assetVersionId);
				if (
					!pin ||
					pin.assetRecordId !== assetVersion.assetRecordId ||
					pin.unitVersions.length !== assetVersion.unitVersionIds.length ||
					pin.unitVersions.some(
						(unitVersion) =>
							!assetVersion.unitVersionIds.includes(unitVersion.id)
					)
				) {
					context.addIssue({
						code: "custom",
						message:
							"Version pins must exactly match the selected Asset Records, Asset Versions, and Unit Versions.",
						path: ["versionPins"],
					});
				}
			}
		});

export type AssetFamilyComparisonInput = z.infer<
	typeof assetFamilyComparisonInputSchema
>;
export type AssetFamilyComparisonRecord = z.infer<
	typeof assetFamilyComparisonRecordSchema
>;
export type AssetFamilyComparisonAssetVersion = z.infer<
	typeof assetFamilyComparisonAssetVersionSchema
>;

export interface AssetFamilyComparisonStore {
	append: (
		userId: string,
		record: AssetFamilyComparisonRecord
	) => Promise<AssetFamilyComparisonRecord | null>;
	list: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<AssetFamilyComparisonRecord[] | null>;
}
