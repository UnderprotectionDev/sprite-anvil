import { z } from "zod";
import { assetRecordIdentityCriteriaSchema } from "./asset-records";

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
		createdAt: z.string().datetime(),
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
		createdAt: z.string().datetime(),
	})
	.strict();

export const assetRecordSchema = z
	.object({
		id: idSchema,
		projectId: idSchema,
		assetFamilyId: idSchema,
		name: nameSchema,
		createdAt: z.string().datetime(),
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
		createdAt: z.string().datetime(),
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

export const assetFamilyListInputSchema = z
	.object({ projectId: idSchema })
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
				message: "Türetilmiş Varlık için Kaynak Varlık Sürümü seçilmelidir.",
				path: ["sourceAssetVersionId"],
			});
		}
		if (input.type !== "derivative" && input.sourceAssetVersionId) {
			context.addIssue({
				code: "custom",
				message:
					"Kaynak Varlık Sürümü yalnız Türetilmiş Varlık için seçilebilir.",
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
		projectId: string
	) => Promise<AssetFamilyCatalog | null>;
}
