import { z } from "zod";
import {
	type SpecializedProfileContract,
	specializedProfileIdSchema,
} from "./specialized-profile-contracts";

const identifier = z.string().trim().min(1).max(128);
export const gameplayMetadataFieldIds = [
	"pivot",
	"ground_point",
	"mount_points",
	"collision_areas",
	"event_links",
	"ground_and_sort_points",
	"origin",
	"layer",
	"event_id",
] as const;
export function getGameplayMetadataFields(
	contract: SpecializedProfileContract
) {
	return contract.metadataFields.filter((field) =>
		gameplayMetadataFieldIds.some((fieldId) => fieldId === field.id)
	);
}
const fieldIdSchema = z.enum(gameplayMetadataFieldIds);
const metadataValueSchema = z
	.json()
	.refine(
		(value) => JSON.stringify(value).length <= 16_384,
		"Gameplay Metadata values must not exceed 16 KiB."
	);
const sourceReferenceSchema = z
	.object({
		kind: z.literal("finalized_source"),
		proposalId: z.uuid(),
		sourceEntryId: z.uuid(),
		sourcePath: z.string().min(1).max(2048),
	})
	.strict();
export const gameplayMetadataListInputSchema = z
	.object({
		projectId: identifier,
		assetRecordId: identifier,
	})
	.strict();
export const gameplayMetadataWriteInputSchema = gameplayMetadataListInputSchema
	.extend({
		id: z.uuid(),
		assetVersionId: identifier,
		frameKey: z.string().min(1).max(512),
		profileId: specializedProfileIdSchema,
		contractRevisionId: identifier,
		useContext: z.string().trim().min(1).max(512),
		fields: z
			.array(
				z
					.object({
						fieldId: fieldIdSchema,
						source: z
							.discriminatedUnion("kind", [
								z
									.object({
										kind: z.literal("authored"),
										value: metadataValueSchema,
									})
									.strict(),
								sourceReferenceSchema,
							])
							.nullable(),
					})
					.strict()
			)
			.max(gameplayMetadataFieldIds.length),
	})
	.strict();
export const gameplayMetadataRecordSchema = gameplayMetadataWriteInputSchema
	.omit({ fields: true })
	.extend({
		contractRevisionId: identifier,
		createdAt: z.iso.datetime(),
		fields: z
			.array(
				z
					.object({
						fieldId: fieldIdSchema,
						value: metadataValueSchema,
						unit: z.string().nullable(),
						coordinateSystem: z.string().nullable(),
						source: z.union([
							z.object({ kind: z.literal("authored") }).strict(),
							z.object({ kind: z.literal("unknown") }).strict(),
							sourceReferenceSchema,
						]),
					})
					.strict()
			)
			.max(gameplayMetadataFieldIds.length),
	})
	.strict();
export const gameplayMetadataFrameSchema = z
	.object({
		assetVersionId: identifier,
		frameKey: z.string().min(1).max(512),
		sourcePivots: z.array(
			sourceReferenceSchema.extend({ value: metadataValueSchema })
		),
	})
	.strict();
export const gameplayMetadataCatalogSchema = z
	.object({
		frames: z.array(gameplayMetadataFrameSchema),
		records: z.array(gameplayMetadataRecordSchema),
	})
	.strict();
export type GameplayMetadataWriteInput = z.infer<
	typeof gameplayMetadataWriteInputSchema
>;
export type GameplayMetadataRecord = z.infer<
	typeof gameplayMetadataRecordSchema
>;
export type GameplayMetadataFrame = z.infer<typeof gameplayMetadataFrameSchema>;
export interface GameplayMetadataStore {
	append: (
		userId: string,
		record: GameplayMetadataRecord
	) => Promise<GameplayMetadataRecord | null>;
	list: (
		userId: string,
		projectId: string,
		assetRecordId: string
	) => Promise<z.infer<typeof gameplayMetadataCatalogSchema> | null>;
}
