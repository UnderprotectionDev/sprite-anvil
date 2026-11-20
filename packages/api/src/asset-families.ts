import { z } from "zod";
import { assetRecordIdentityCriteriaSchema } from "./asset-records";
import { pageSizeSchema } from "./pagination";

const idSchema = z.string().trim().min(1).max(128);
const nameSchema = z.string().trim().min(1).max(120);
const useContextSchema = z.string().trim().min(1).max(120);

export const assetFamilyRelationshipTypeSchema = z.enum([
	"direction",
	"animation",
	"state",
	"derivative",
]);

export const subjectIdentityRecordSchema = z
	.object({
		id: idSchema,
		projectId: idSchema,
		name: nameSchema,
		createdAt: z.iso.datetime(),
	})
	.strict();

export const assetFamilyRecordSchema = z
	.object({
		id: idSchema,
		projectId: idSchema,
		subjectIdentityId: idSchema,
		name: nameSchema,
		visualWorldId: idSchema,
		useContext: useContextSchema,
		createdAt: z.iso.datetime(),
	})
	.strict();

export const assetRecordSchema = z
	.object({
		id: idSchema,
		projectId: idSchema,
		assetFamilyId: idSchema,
		name: nameSchema,
		createdAt: z.iso.datetime(),
	})
	.strict();

export const assetFamilyRelationshipSchema = z
	.object({
		id: idSchema,
		projectId: idSchema,
		assetFamilyId: idSchema,
		sourceAssetRecordId: idSchema,
		sourceAssetVersionId: idSchema.nullable(),
		targetAssetRecordId: idSchema,
		type: assetFamilyRelationshipTypeSchema,
		createdAt: z.iso.datetime(),
	})
	.strict();

export const assetFamilyCatalogSchema = z
	.object({
		subjectIdentities: z.array(subjectIdentityRecordSchema),
		assetFamilies: z.array(assetFamilyRecordSchema),
		assetRecords: z.array(assetRecordSchema),
		relationships: z.array(assetFamilyRelationshipSchema),
	})
	.strict();

export const assetFamilyCatalogScopeSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("family"), familyId: idSchema }).strict(),
	z
		.object({
			kind: z.literal("identity-page"),
			after: z.object({ id: idSchema, name: nameSchema }).strict().optional(),
			limit: pageSizeSchema,
		})
		.strict(),
]);

export type AssetFamilyCatalogScope = z.infer<
	typeof assetFamilyCatalogScopeSchema
>;

export const assetFamilyListInputSchema = z
	.object({
		projectId: idSchema,
		scope: assetFamilyCatalogScopeSchema.optional(),
	})
	.strict();

export const subjectIdentityCreateInputSchema = z
	.object({ projectId: idSchema, name: nameSchema })
	.strict();

export const assetFamilyCreateInputSchema = z
	.object({
		projectId: idSchema,
		subjectIdentityId: idSchema,
		name: nameSchema,
		visualWorldId: idSchema,
		useContext: useContextSchema,
	})
	.strict();

export const assetRecordCreateInputSchema = z
	.object({
		projectId: idSchema,
		assetFamilyId: idSchema,
		name: nameSchema,
		identityCriteria: assetRecordIdentityCriteriaSchema.array().min(1).max(3),
	})
	.strict();

export const assetFamilyRelationshipCreateInputSchema = z
	.object({
		projectId: idSchema,
		assetFamilyId: idSchema,
		sourceAssetRecordId: idSchema,
		sourceAssetVersionId: idSchema.optional(),
		targetAssetRecordId: idSchema,
		type: assetFamilyRelationshipTypeSchema,
	})
	.strict()
	.superRefine((input, context) => {
		if (input.type === "derivative" && !input.sourceAssetVersionId) {
			context.addIssue({
				code: "custom",
				message: "A Source Asset Version must be selected for a Derived Asset.",
				path: ["sourceAssetVersionId"],
			});
		}
		if (input.type !== "derivative" && input.sourceAssetVersionId) {
			context.addIssue({
				code: "custom",
				message:
					"A Source Asset Version can only be selected for a Derived Asset.",
				path: ["sourceAssetVersionId"],
			});
		}
	});

export type AssetFamilyRelationshipType = z.infer<
	typeof assetFamilyRelationshipTypeSchema
>;
export type SubjectIdentityRecord = z.infer<typeof subjectIdentityRecordSchema>;
export type AssetFamilyRecord = z.infer<typeof assetFamilyRecordSchema>;
export type AssetRecord = z.infer<typeof assetRecordSchema>;
export type AssetFamilyRelationship = z.infer<
	typeof assetFamilyRelationshipSchema
>;
export type AssetFamilyCatalog = z.infer<typeof assetFamilyCatalogSchema>;
export type SubjectIdentityCreateInput = z.infer<
	typeof subjectIdentityCreateInputSchema
>;
export type AssetFamilyCreateInput = z.infer<
	typeof assetFamilyCreateInputSchema
>;
export type AssetRecordCreateInput = z.infer<
	typeof assetRecordCreateInputSchema
>;
export type AssetFamilyRelationshipCreateInput = z.infer<
	typeof assetFamilyRelationshipCreateInputSchema
>;

export interface AssetFamilyStore {
	createAssetFamily: (
		userId: string,
		input: AssetFamilyCreateInput
	) => Promise<AssetFamilyRecord | null>;
	createAssetRecord: (
		userId: string,
		input: AssetRecordCreateInput
	) => Promise<AssetRecord | null>;
	createRelationship: (
		userId: string,
		input: AssetFamilyRelationshipCreateInput
	) => Promise<AssetFamilyRelationship | null>;
	createSubjectIdentity: (
		userId: string,
		input: SubjectIdentityCreateInput
	) => Promise<SubjectIdentityRecord | null>;
	list: (
		userId: string,
		projectId: string,
		scope?: AssetFamilyCatalogScope
	) => Promise<AssetFamilyCatalog | null>;
}
