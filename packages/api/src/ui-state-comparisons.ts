import { z } from "zod";
import { unitVersionSchema } from "./asset-versions";
import { specializedProfileContractSchema } from "./specialized-profile-contracts";

const id = z.string().trim().min(1).max(200);
export const uiComponentStates = [
	"normal",
	"hover",
	"pressed",
	"disabled",
	"selected",
	"open",
	"closed",
] as const;
export const uiComponentKinds = [
	"panel",
	"button",
	"item_slot",
	"tooltip",
	"indicator",
	"tab",
	"checkbox",
] as const;
export const uiStateComparisonItemSchema = z
	.object({
		componentId: z.string().trim().min(1).max(120),
		componentKind: z.enum(uiComponentKinds),
		state: z.enum(uiComponentStates),
		assetVersionId: id,
		unitVersionId: id.nullable(),
		region: z
			.object({
				x: z.number().int().nonnegative(),
				y: z.number().int().nonnegative(),
				width: z.number().int().min(1).max(4096),
				height: z.number().int().min(1).max(4096),
			})
			.strict(),
	})
	.strict();
export const uiStateComparisonListInputSchema = z
	.object({ projectId: id, assetFamilyId: id })
	.strict();
export const uiStateComparisonInputSchema = uiStateComparisonListInputSchema
	.extend({
		id: z.uuid(),
		contractRevisionId: id,
		screenAssetVersionId: id,
		name: z.string().trim().min(1).max(120),
		items: z
			.array(uiStateComparisonItemSchema)
			.min(2)
			.max(49)
			.superRefine((items, ctx) => {
				const mappings = new Set<string>();
				const kinds = new Map<string, string>();
				const units = new Set<string>();
				for (const item of items) {
					const key = JSON.stringify([item.componentId, item.state]);
					if (mappings.has(key)) {
						ctx.addIssue({
							code: "custom",
							message:
								"Each component state must have one unambiguous mapping.",
						});
					}
					if (
						kinds.has(item.componentId) &&
						kinds.get(item.componentId) !== item.componentKind
					) {
						ctx.addIssue({
							code: "custom",
							message: "A component identity must keep the same kind.",
						});
					}
					if (item.unitVersionId && units.has(item.unitVersionId)) {
						ctx.addIssue({
							code: "custom",
							message:
								"A state Unit Version cannot represent two comparison entries.",
						});
					}
					mappings.add(key);
					kinds.set(item.componentId, item.componentKind);
					if (item.unitVersionId) {
						units.add(item.unitVersionId);
					}
				}
			}),
		outcome: z.enum(["consistent", "needs_follow_up", "inconclusive"]),
		familyStyleNotes: z.string().trim().min(1).max(2000),
		stateDistinctionNotes: z.string().trim().min(1).max(2000),
	})
	.strict();
export const uiStateComparisonVersionPinSchema = z
	.object({
		assetVersionId: id,
		assetRecordId: id,
		assetRecordName: z.string().min(1).max(120),
		contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
		contentLength: z.number().int().positive(),
		contentType: z.enum(["image/png", "image/webp"]),
		versionNumber: z.number().int().positive(),
		sourceImageDimensions: z
			.object({
				width: z.number().int().positive(),
				height: z.number().int().positive(),
			})
			.strict(),
	})
	.strict();
export const uiStateComparisonRecordSchema = uiStateComparisonInputSchema
	.extend({
		createdAt: z.string().datetime(),
		reviewedByUserId: id,
		contractSnapshot: specializedProfileContractSchema,
		versionPins: z.array(uiStateComparisonVersionPinSchema).min(1),
		unitPins: z.array(unitVersionSchema),
	})
	.strict()
	.superRefine((record, ctx) => {
		if (record.contractSnapshot.profileId !== "ui") {
			ctx.addIssue({
				code: "custom",
				message:
					"A UI comparison requires the UI Specialized Profile Contract.",
			});
		}
		const versionIds = new Set([
			record.screenAssetVersionId,
			...record.items.map((item) => item.assetVersionId),
		]);
		if (
			new Set(record.versionPins.map((pin) => pin.assetVersionId)).size !==
				record.versionPins.length ||
			record.versionPins.length !== versionIds.size ||
			[...versionIds].some(
				(versionId) =>
					!record.versionPins.some((pin) => pin.assetVersionId === versionId)
			)
		) {
			ctx.addIssue({
				code: "custom",
				message: "Pin every exact screen and component Asset Version once.",
			});
		}
		const unitIds = new Set(
			record.items.flatMap((item) =>
				item.unitVersionId ? [item.unitVersionId] : []
			)
		);
		if (
			new Set(record.unitPins.map((unit) => unit.id)).size !==
				record.unitPins.length ||
			unitIds.size !== record.unitPins.length
		) {
			ctx.addIssue({
				code: "custom",
				message: "Pin each selected state Unit Version once.",
			});
		}
		for (const item of record.items) {
			const pin = record.versionPins.find(
				(version) => version.assetVersionId === item.assetVersionId
			);
			if (
				!pin ||
				item.region.x + item.region.width > pin.sourceImageDimensions.width ||
				item.region.y + item.region.height > pin.sourceImageDimensions.height
			) {
				ctx.addIssue({
					code: "custom",
					message: "Component regions must fit the verified source image.",
				});
			}
			if (
				item.unitVersionId &&
				!record.unitPins.some(
					(unit) =>
						unit.id === item.unitVersionId &&
						unit.assetVersionId === item.assetVersionId &&
						unit.projectId === record.projectId &&
						unit.unitType === "state"
				)
			) {
				ctx.addIssue({
					code: "custom",
					message: "A state must reference its exact state Unit Version.",
				});
			}
		}
	});
export type UiStateComparisonInput = z.infer<
	typeof uiStateComparisonInputSchema
>;
export type UiStateComparisonRecord = z.infer<
	typeof uiStateComparisonRecordSchema
>;
export interface UiStateComparisonStore {
	append: (
		userId: string,
		record: UiStateComparisonRecord
	) => Promise<UiStateComparisonRecord | null>;
	list: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<UiStateComparisonRecord[] | null>;
	listAccessibleVersionIds: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<Set<string> | null>;
}
// A comparison archive preserves state mappings and exact references; it is not an Export Bundle.
export const uiStateComparisonArchiveSchema = z
	.object({
		archiveType: z.literal("sprite-anvil.ui-state-comparison"),
		schemaVersion: z.literal(1),
		record: uiStateComparisonRecordSchema,
	})
	.strict();
export function createUiStateComparisonArchive(
	record: UiStateComparisonRecord
) {
	return uiStateComparisonArchiveSchema.parse({
		archiveType: "sprite-anvil.ui-state-comparison",
		schemaVersion: 1,
		record,
	});
}
