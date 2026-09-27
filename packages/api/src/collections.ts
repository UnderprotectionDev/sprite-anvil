import { z } from "zod";

const idSchema = z.string().trim().min(1).max(128);
const nameSchema = z.string().trim().min(1).max(120);

export const collectionRecordSchema = z
	.object({
		id: idSchema,
		projectId: idSchema,
		name: nameSchema,
		createdAt: z.string().datetime(),
	})
	.strict();

export const collectionMembershipSchema = z
	.object({
		projectId: idSchema,
		collectionId: idSchema,
		assetRecordId: idSchema,
		createdAt: z.string().datetime(),
	})
	.strict();

export const collectionAssetRecordSchema = z
	.object({
		id: idSchema,
		name: z.string().nullable(),
		assetFamilyId: idSchema.nullable(),
		assetFamilyName: z.string().nullable(),
		availability: z.enum(["active", "archived", "erased"]),
	})
	.strict();

export const collectionCatalogSchema = z
	.object({
		collections: z.array(collectionRecordSchema),
		memberships: z.array(collectionMembershipSchema),
		assetRecords: z.array(collectionAssetRecordSchema),
	})
	.strict();

export const collectionListInputSchema = z
	.object({ projectId: idSchema })
	.strict();

export const collectionCreateInputSchema = z
	.object({ projectId: idSchema, name: nameSchema })
	.strict();

export const collectionMembershipInputSchema = z
	.object({
		projectId: idSchema,
		collectionId: idSchema,
		assetRecordId: idSchema,
	})
	.strict();

export type CollectionRecord = z.infer<typeof collectionRecordSchema>;
export type CollectionMembership = z.infer<typeof collectionMembershipSchema>;
export type CollectionAssetRecord = z.infer<typeof collectionAssetRecordSchema>;
export type CollectionCatalog = z.infer<typeof collectionCatalogSchema>;
export type CollectionCreateInput = z.infer<typeof collectionCreateInputSchema>;
export type CollectionMembershipInput = z.infer<
	typeof collectionMembershipInputSchema
>;

export interface CollectionStore {
	addAssetRecord: (
		userId: string,
		input: CollectionMembershipInput
	) => Promise<CollectionMembership | null>;
	create: (
		userId: string,
		input: CollectionCreateInput
	) => Promise<CollectionRecord | null>;
	list: (
		userId: string,
		projectId: string
	) => Promise<CollectionCatalog | null>;
	removeAssetRecord: (
		userId: string,
		input: CollectionMembershipInput
	) => Promise<CollectionMembership | null>;
}
