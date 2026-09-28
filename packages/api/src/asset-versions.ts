import { z } from "zod";

const idSchema = z.string().trim().min(1).max(128);

export const unitVersionTypeSchema = z.enum([
	"frame",
	"direction",
	"tile",
	"state",
]);

export const unitVersionKeySchema = z.string().trim().min(1).max(120);

export const unitVersionCorrectionInputSchema = z
	.object({
		sourceAssetVersionId: z.string().uuid(),
		unitType: unitVersionTypeSchema,
		unitKey: unitVersionKeySchema,
	})
	.strict();

export const unitVersionSchema = z
	.object({
		id: idSchema,
		projectId: idSchema,
		assetRecordId: idSchema,
		assetVersionId: idSchema,
		sourceAssetVersionId: idSchema,
		unitType: unitVersionTypeSchema,
		unitKey: unitVersionKeySchema,
		versionNumber: z.number().int().positive(),
		createdAt: z.string().datetime(),
	})
	.strict();

export const assetVersionReviewEventTypeSchema = z.enum([
	"candidate",
	"approved",
	"rejected",
]);

export const assetVersionReviewDispositionSchema = z.enum([
	"candidate",
	"approved",
	"rejected",
]);

export const assetVersionSourceKinds = [
	"unknown",
	"legacy_asset",
	"manual_import",
	"derived",
] as const;
export const assetVersionSourceKindSchema = z.enum(assetVersionSourceKinds);
export type AssetVersionSourceKind = z.infer<
	typeof assetVersionSourceKindSchema
>;

export const assetVersionReviewEventSchema = z
	.object({
		id: idSchema,
		assetVersionId: idSchema,
		type: assetVersionReviewEventTypeSchema,
		rationale: z.string().nullable(),
		createdAt: z.string().datetime(),
	})
	.strict();

export const compositeVersionReviewEventSchema = z
	.object({
		id: idSchema,
		compositeVersionId: idSchema,
		type: assetVersionReviewEventTypeSchema,
		rationale: z.string().nullable(),
		createdAt: z.string().datetime(),
	})
	.strict();

export const assetVersionSchema = z
	.object({
		id: idSchema,
		projectId: idSchema,
		assetFamilyId: idSchema,
		assetRecordId: idSchema,
		versionNumber: z.number().int().positive(),
		contentType: z.enum(["image/png", "image/webp"]),
		contentLength: z.number().int().positive(),
		contentDigest: z
			.string()
			.regex(/^[0-9a-f]{64}$/)
			.nullable(),
		integrityVerified: z.boolean(),
		sourceKind: assetVersionSourceKindSchema.optional(),
		previewUrl: z.string().min(1),
		reviewDisposition: assetVersionReviewDispositionSchema,
		reviewEvents: z.array(assetVersionReviewEventSchema),
		createdAt: z.string().datetime(),
	})
	.strict();

export const assetFamilyCanonicalDesignSchema = z
	.object({
		id: idSchema,
		projectId: idSchema,
		assetFamilyId: idSchema,
		assetRecordId: idSchema,
		assetVersionId: idSchema,
		createdAt: z.string().datetime(),
	})
	.strict();

export const compositionMembershipSchema = z
	.object({
		id: idSchema,
		projectId: idSchema,
		assetRecordId: idSchema,
		compositeVersionId: idSchema,
		unitVersionId: idSchema,
		unitType: unitVersionTypeSchema,
		unitKey: unitVersionKeySchema,
		createdAt: z.string().datetime(),
	})
	.strict();

export const compositeVersionSchema = z
	.object({
		id: idSchema,
		projectId: idSchema,
		assetRecordId: idSchema,
		versionNumber: z.number().int().positive(),
		reviewDisposition: assetVersionReviewDispositionSchema,
		reviewEvents: z.array(compositeVersionReviewEventSchema),
		compositionMemberships: z.array(compositionMembershipSchema),
		createdAt: z.string().datetime(),
	})
	.strict();

export const assetVersionCatalogSchema = z
	.object({
		assetVersions: z.array(assetVersionSchema),
		canonicalDesigns: z.array(assetFamilyCanonicalDesignSchema),
		unitVersions: z.array(unitVersionSchema),
		compositeVersions: z.array(compositeVersionSchema),
	})
	.strict();

export const unitVersionCorrectionUploadResponseSchema = z
	.object({
		assetVersion: assetVersionSchema,
		unitVersion: unitVersionSchema,
	})
	.strict();

export const assetVersionListInputSchema = z
	.object({ projectId: idSchema })
	.strict();

export const assetVersionReviewInputSchema = z
	.object({
		projectId: idSchema,
		assetVersionId: idSchema,
		decision: assetVersionReviewDispositionSchema,
		rationale: z.string().trim().min(1).max(2000),
	})
	.strict();

export const compositeVersionCreateInputSchema = z
	.object({
		projectId: idSchema,
		assetRecordId: idSchema,
		unitVersionIds: z
			.array(idSchema)
			.min(1)
			.refine(
				(ids) => new Set(ids).size === ids.length,
				"A Unit Version can appear only once in a Composite Version"
			),
		idempotencyKey: z.string().trim().min(1).max(128),
	})
	.strict();

export const compositeVersionReviewInputSchema = z
	.object({
		projectId: idSchema,
		compositeVersionId: idSchema,
		decision: assetVersionReviewDispositionSchema,
		rationale: z.string().trim().min(1).max(2000),
	})
	.strict();

export const assetFamilyCanonicalDesignInputSchema = z
	.object({
		projectId: idSchema,
		assetFamilyId: idSchema,
		assetVersionId: idSchema,
	})
	.strict();

export type AssetVersionReviewEvent = z.infer<
	typeof assetVersionReviewEventSchema
>;
export type CompositeVersionReviewEvent = z.infer<
	typeof compositeVersionReviewEventSchema
>;
export type AssetVersion = z.infer<typeof assetVersionSchema>;
export type UnitVersionType = z.infer<typeof unitVersionTypeSchema>;
export type UnitVersionCorrectionInput = z.infer<
	typeof unitVersionCorrectionInputSchema
>;
export type UnitVersion = z.infer<typeof unitVersionSchema>;
export type CompositionMembership = z.infer<typeof compositionMembershipSchema>;
export type CompositeVersion = z.infer<typeof compositeVersionSchema>;
export type AssetFamilyCanonicalDesign = z.infer<
	typeof assetFamilyCanonicalDesignSchema
>;
export type AssetVersionCatalog = z.infer<typeof assetVersionCatalogSchema>;
export type AssetVersionReviewInput = z.infer<
	typeof assetVersionReviewInputSchema
>;
export type CompositeVersionCreateInput = z.infer<
	typeof compositeVersionCreateInputSchema
>;
export type CompositeVersionReviewInput = z.infer<
	typeof compositeVersionReviewInputSchema
>;
export type AssetFamilyCanonicalDesignInput = z.infer<
	typeof assetFamilyCanonicalDesignInputSchema
>;

export interface AssetVersionFileRecord {
	assetFamilyId: string;
	assetRecordId: string;
	contentDigest: string | null;
	contentLength: number;
	contentType: "image/png" | "image/webp";
	fileName: string | null;
	id: string;
	idempotencyKey: string;
	integrityVerified: boolean;
	objectKey: string;
	projectId: string;
	unitCorrection?: UnitVersionCorrectionInput;
}

export type CreateCandidateVersionResult =
	| {
			kind: "created" | "existing";
			version: AssetVersion;
			unitVersion?: UnitVersion;
	  }
	| { kind: "idempotency-conflict" }
	| { kind: "invalid-unit-source" };

export type CreateCompositeVersionResult =
	| { kind: "created" | "existing"; compositeVersion: CompositeVersion }
	| { kind: "idempotency-conflict" }
	| { kind: "invalid-unit-versions" };

export interface AssetVersionStore {
	createCandidateVersion: (
		userId: string,
		input: AssetVersionFileRecord
	) => Promise<CreateCandidateVersionResult | null>;
	createCompositeVersion: (
		userId: string,
		input: CompositeVersionCreateInput
	) => Promise<CreateCompositeVersionResult | null>;
	getAssetRecordForUpload: (
		userId: string,
		projectId: string,
		assetRecordId: string
	) => Promise<Pick<
		AssetVersionFileRecord,
		"assetFamilyId" | "assetRecordId" | "projectId"
	> | null>;
	getFileRecord: (
		userId: string,
		projectId: string,
		assetVersionId: string
	) => Promise<AssetVersionFileRecord | null>;
	list: (
		userId: string,
		projectId: string
	) => Promise<AssetVersionCatalog | null>;
	recordCompositeVersionReviewEvent: (
		userId: string,
		input: CompositeVersionReviewInput
	) => Promise<CompositeVersionReviewEvent | null>;
	recordReviewEvent: (
		userId: string,
		input: AssetVersionReviewInput
	) => Promise<AssetVersionReviewEvent | null>;
	selectCanonicalDesign: (
		userId: string,
		input: AssetFamilyCanonicalDesignInput
	) => Promise<AssetFamilyCanonicalDesign | null>;
}
