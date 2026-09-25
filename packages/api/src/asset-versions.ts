import { z } from "zod";

const idSchema = z.string().trim().min(1).max(128);

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

export const assetVersionReviewEventSchema = z
	.object({
		id: idSchema,
		assetVersionId: idSchema,
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

export const assetVersionCatalogSchema = z
	.object({
		assetVersions: z.array(assetVersionSchema),
		canonicalDesigns: z.array(assetFamilyCanonicalDesignSchema),
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
export type AssetVersion = z.infer<typeof assetVersionSchema>;
export type AssetFamilyCanonicalDesign = z.infer<
	typeof assetFamilyCanonicalDesignSchema
>;
export type AssetVersionCatalog = z.infer<typeof assetVersionCatalogSchema>;
export type AssetVersionReviewInput = z.infer<
	typeof assetVersionReviewInputSchema
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
}

export type CreateCandidateVersionResult =
	| { kind: "created" | "existing"; version: AssetVersion }
	| { kind: "idempotency-conflict" };

export interface AssetVersionStore {
	createCandidateVersion: (
		userId: string,
		input: AssetVersionFileRecord
	) => Promise<CreateCandidateVersionResult | null>;
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
	recordReviewEvent: (
		userId: string,
		input: AssetVersionReviewInput
	) => Promise<AssetVersionReviewEvent | null>;
	selectCanonicalDesign: (
		userId: string,
		input: AssetFamilyCanonicalDesignInput
	) => Promise<AssetFamilyCanonicalDesign | null>;
}
