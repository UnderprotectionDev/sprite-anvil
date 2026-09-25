import { z } from "zod";

export const assetRecordIdentityCriteria = [
	"independent_product_meaning",
	"independent_lifecycle",
	"delivery_identity",
] as const;

export const assetRecordIdentityCriteriaSchema = z.enum(
	assetRecordIdentityCriteria
);

export const assetRecordSupportLevels = ["general"] as const;

export const assetRecordAvailabilityValues = [
	"active",
	"archived",
	"erased",
] as const;

const projectIdSchema = z.uuid();

export const assetRecordSchema = z
	.object({
		availability: z.enum(assetRecordAvailabilityValues),
		createdAt: z.iso.datetime(),
		id: z.uuid(),
		identityCriteria: z
			.array(assetRecordIdentityCriteriaSchema)
			.max(assetRecordIdentityCriteria.length)
			.refine((criteria) => new Set(criteria).size === criteria.length),
		name: z.string().trim().min(1).max(120),
		projectId: projectIdSchema,
		supportLevel: z.enum(assetRecordSupportLevels),
	})
	.strict();

export const assetRecordCreateInputSchema = z
	.object({
		id: z.uuid(),
		identityCriteria: z
			.array(assetRecordIdentityCriteriaSchema)
			.min(1)
			.max(assetRecordIdentityCriteria.length)
			.refine((criteria) => new Set(criteria).size === criteria.length),
		name: z.string().trim().min(1).max(120),
		projectId: projectIdSchema,
	})
	.strict();

export const assetRecordListInputSchema = z
	.object({ projectId: projectIdSchema })
	.strict();

export const assetRecordGetInputSchema = z
	.object({
		assetRecordId: z.uuid(),
		projectId: projectIdSchema,
	})
	.strict();

export type AssetRecord = z.infer<typeof assetRecordSchema>;
export type MutableAssetRecordAvailability = Extract<
	AssetRecord["availability"],
	"active" | "archived"
>;
export type AssetRecordCreateInput = z.infer<
	typeof assetRecordCreateInputSchema
>;

export interface AssetRecordStore {
	create: (
		userId: string,
		input: AssetRecordCreateInput
	) => Promise<AssetRecord | null>;
	get: (
		userId: string,
		projectId: string,
		assetRecordId: string
	) => Promise<AssetRecord | null>;
	list: (userId: string, projectId: string) => Promise<AssetRecord[] | null>;
	setAvailability: (
		userId: string,
		projectId: string,
		assetRecordId: string,
		availability: MutableAssetRecordAvailability
	) => Promise<AssetRecord | null>;
}
