import { z } from "zod";
import { assetRecordSchema } from "./asset-records";

export const assetVersionContentTypes = ["image/png", "image/webp"] as const;
export const assetVersionContentTypeSchema = z.enum(assetVersionContentTypes);

export const referenceRoles = [
	"identity",
	"pose",
	"style",
	"palette",
	"equipment",
	"composition",
	"theme",
	"custom",
] as const;
export const referenceRoleSchema = z.enum(referenceRoles);

export const referenceFeatures = [
	"identity",
	"pose",
	"style",
	"palette",
	"equipment",
	"composition",
	"theme",
] as const;
export const referenceFeatureSchema = z.enum(referenceFeatures);

export const dependencyFacets = [
	"identity",
	"silhouette",
	"equipment",
	"palette",
	"theme",
	"perspective",
	"timing",
	"other",
] as const;
export const dependencyFacetSchema = z.enum(dependencyFacets);

export const assetVersionReviewDispositions = [
	"candidate",
	"approved",
	"rejected",
] as const;
export const assetVersionReviewDispositionSchema = z.enum(
	assetVersionReviewDispositions
);

function isSafeAssetVersionFileName(fileName: string) {
	return (
		!(fileName.includes("/") || fileName.includes("\\")) &&
		Array.from(fileName).every((character) => {
			const codePoint = character.codePointAt(0);
			return (
				codePoint !== undefined &&
				codePoint >= 0x20 &&
				!(codePoint >= 0x7f && codePoint <= 0x9f)
			);
		})
	);
}

export const assetVersionSummarySchema = z
	.object({
		createdAt: z.iso.datetime(),
		fileName: z.string().min(1).max(255).nullable(),
		id: z.uuid(),
		reviewDisposition: assetVersionReviewDispositionSchema,
		sha256: z
			.string()
			.regex(/^[a-f0-9]{64}$/)
			.nullable(),
		sourceImageHeight: z
			.number()
			.int()
			.positive()
			.max(100_000)
			.nullable()
			.optional(),
		sourceImageWidth: z
			.number()
			.int()
			.positive()
			.max(100_000)
			.nullable()
			.optional(),
		versionNumber: z.number().int().positive(),
	})
	.strict();
export type AssetVersionSummary = z.infer<typeof assetVersionSummarySchema>;

export const assetVersionCreateInputSchema = z
	.object({
		assetRecordId: z.uuid(),
		contentBase64: z.string().min(4).max(7_000_000),
		contentType: assetVersionContentTypeSchema,
		fileName: z
			.string()
			.trim()
			.min(1)
			.max(255)
			.refine(isSafeAssetVersionFileName),
		id: z.uuid(),
		knownSource: z.string().trim().max(500).nullable(),
		projectId: z.uuid(),
		supportingEvidence: z.string().trim().max(1000).nullable(),
		userRelationship: z.enum([
			"created_by_user",
			"received_from_team",
			"licensed_third_party",
			"unknown",
		]),
		historyUnknown: z.literal(true),
	})
	.strict();
export type AssetVersionCreateInput = z.infer<
	typeof assetVersionCreateInputSchema
>;

export const reviewEventSummarySchema = z
	.object({
		createdAt: z.iso.datetime(),
		decision: assetVersionReviewDispositionSchema,
		id: z.uuid(),
		rationale: z.string().nullable(),
		versionId: z.uuid(),
	})
	.strict();
export type ReviewEventSummary = z.infer<typeof reviewEventSummarySchema>;

export const assetVersionReviewInputSchema = z
	.object({
		assetRecordId: z.uuid(),
		decision: assetVersionReviewDispositionSchema,
		id: z.uuid(),
		projectId: z.uuid(),
		rationale: z.string().trim().max(1000).nullable(),
		versionId: z.uuid(),
	})
	.strict();

export const assetFamilySummarySchema = z
	.object({
		canonicalVersionId: z.uuid().nullable(),
		id: z.uuid(),
		name: z.string().min(1).max(120),
		useContext: z.string().min(1).max(300),
		visualWorldId: z.uuid(),
		visualWorldName: z.string().min(1),
	})
	.strict();
export type AssetFamilySummary = z.infer<typeof assetFamilySummarySchema>;

export const assetFamilyCreateInputSchema = z
	.object({
		assetRecordId: z.uuid(),
		canonicalVersionId: z.uuid(),
		id: z.uuid(),
		name: z.string().trim().min(1).max(120),
		projectId: z.uuid(),
		useContext: z.string().trim().min(1).max(300),
		visualWorldId: z.uuid(),
	})
	.strict();

export const derivativeSummarySchema = z
	.object({
		assetRecordId: z.uuid(),
		assetRecordName: z.string().min(1).max(120),
		canonicalVersionId: z.uuid(),
		dependencyFacets: z.array(dependencyFacetSchema),
		familyStatus: z.enum(["matched", "unassigned"]),
		id: z.uuid(),
	})
	.strict();
export type DerivativeSummary = z.infer<typeof derivativeSummarySchema>;

export const assetDerivativeCreateInputSchema = z
	.object({
		canonicalVersionId: z.uuid(),
		dependencyFacets: z.array(dependencyFacetSchema).min(1).max(8),
		derivedAssetRecordId: z.uuid(),
		id: z.uuid(),
		projectId: z.uuid(),
		sourceAssetRecordId: z.uuid(),
	})
	.strict()
	.superRefine((input, context) => {
		if (
			new Set(input.dependencyFacets).size !== input.dependencyFacets.length
		) {
			context.addIssue({
				code: "custom",
				path: ["dependencyFacets"],
				message: "A dependency facet may only be recorded once.",
			});
		}
	});

export const referenceSummarySchema = z
	.object({
		assetRecordName: z.string().min(1).max(120),
		conflictFeatures: z.array(referenceFeatureSchema),
		forbiddenFeatures: z.array(referenceFeatureSchema),
		id: z.uuid(),
		notes: z.string().nullable(),
		role: referenceRoleSchema,
		transferredFeatures: z.array(referenceFeatureSchema),
		versionId: z.uuid(),
		versionNumber: z.number().int().positive(),
	})
	.strict();
export type ReferenceSummary = z.infer<typeof referenceSummarySchema>;

export const assetReferenceCreateInputSchema = z
	.object({
		assetRecordId: z.uuid(),
		forbiddenFeatures: z.array(referenceFeatureSchema).max(7),
		id: z.uuid(),
		notes: z.string().trim().max(1000).nullable(),
		projectId: z.uuid(),
		role: referenceRoleSchema,
		targetVersionId: z.uuid(),
		transferredFeatures: z.array(referenceFeatureSchema).max(7),
	})
	.strict()
	.superRefine((input, context) => {
		if (
			new Set(input.transferredFeatures).size !==
			input.transferredFeatures.length
		) {
			context.addIssue({
				code: "custom",
				path: ["transferredFeatures"],
				message: "A transferred feature may only be recorded once.",
			});
		}
		if (
			new Set(input.forbiddenFeatures).size !== input.forbiddenFeatures.length
		) {
			context.addIssue({
				code: "custom",
				path: ["forbiddenFeatures"],
				message: "A forbidden feature may only be recorded once.",
			});
		}
		const forbidden = new Set(input.forbiddenFeatures);
		if (input.transferredFeatures.some((feature) => forbidden.has(feature))) {
			context.addIssue({
				code: "custom",
				path: ["forbiddenFeatures"],
				message: "A reference cannot allow and forbid the same feature.",
			});
		}
		if (
			input.transferredFeatures.length === 0 &&
			input.forbiddenFeatures.length === 0
		) {
			context.addIssue({
				code: "custom",
				path: ["transferredFeatures"],
				message: "Record at least one allowed or forbidden feature.",
			});
		}
	});

export const qualitySummarySchema = z
	.object({
		integrityStatus: z.enum(["unavailable", "format_signature_matched"]),
		profileStatus: z.literal("general_support"),
		verifiedVersionCount: z.number().int().nonnegative(),
	})
	.strict();
export type QualitySummary = z.infer<typeof qualitySummarySchema>;

export const legacyAssetAttestationSummarySchema = z
	.object({
		createdAt: z.iso.datetime(),
		historyUnknown: z.literal(true),
		id: z.uuid(),
		kind: z.literal("legacy_asset_attestation"),
		knownSource: z.string().nullable(),
		supportingEvidence: z.string().nullable(),
		userRelationship: z.enum([
			"created_by_user",
			"received_from_team",
			"licensed_third_party",
			"unknown",
		]),
		versionNumber: z.number().int().positive(),
	})
	.strict();
export type LegacyAssetAttestationSummary = z.infer<
	typeof legacyAssetAttestationSummarySchema
>;

export const trackingRecordOptionSchema = z
	.object({
		assetFamilyId: z.uuid().nullable(),
		id: z.uuid(),
		name: z.string().min(1).max(120),
	})
	.strict();

export const trackingVersionOptionSchema = z
	.object({
		assetRecordId: z.uuid(),
		assetRecordName: z.string().min(1).max(120),
		fileName: z.string().min(1).max(255).nullable(),
		id: z.uuid(),
		reviewDisposition: assetVersionReviewDispositionSchema,
		versionNumber: z.number().int().positive(),
	})
	.strict();

export const trackingVisualWorldOptionSchema = z
	.object({ id: z.uuid(), name: z.string().min(1).max(120) })
	.strict();

export const assetRecordTrackingSchema = z
	.object({
		alternatives: assetVersionSummarySchema.array(),
		approvedVersion: assetVersionSummarySchema.nullable(),
		derivatives: derivativeSummarySchema.array(),
		family: assetFamilySummarySchema.nullable(),
		availableRecords: trackingRecordOptionSchema.array(),
		availableVersions: trackingVersionOptionSchema.array(),
		visualWorlds: trackingVisualWorldOptionSchema.array(),
		productionHistory: legacyAssetAttestationSummarySchema.array(),
		quality: qualitySummarySchema,
		references: referenceSummarySchema.array(),
		reviewEvents: reviewEventSummarySchema.array(),
	})
	.strict();
export type AssetRecordTracking = z.infer<typeof assetRecordTrackingSchema>;

export const assetRecordTrackingDetailSchema = z
	.object({
		record: assetRecordSchema,
		tracking: assetRecordTrackingSchema,
	})
	.strict();
export type AssetRecordTrackingDetail = z.infer<
	typeof assetRecordTrackingDetailSchema
>;

export const assetRecordTrackingInputSchema = z
	.object({
		assetRecordId: z.uuid(),
		projectId: z.uuid(),
	})
	.strict();

export type AssetRecordTrackingStoreResult<T> =
	| { ok: true; value: T }
	| {
			ok: false;
			reason:
				| "conflict"
				| "not_found"
				| "review_blocked"
				| "storage_unavailable";
	  };

export interface AssetRecordTrackingStore {
	createDerivative: (
		userId: string,
		input: z.infer<typeof assetDerivativeCreateInputSchema>
	) => Promise<AssetRecordTrackingStoreResult<DerivativeSummary>>;
	createFamily: (
		userId: string,
		input: z.infer<typeof assetFamilyCreateInputSchema>
	) => Promise<AssetRecordTrackingStoreResult<AssetFamilySummary>>;
	createReference: (
		userId: string,
		input: z.infer<typeof assetReferenceCreateInputSchema>
	) => Promise<AssetRecordTrackingStoreResult<ReferenceSummary>>;
	createVersion: (
		userId: string,
		input: AssetVersionCreateInput
	) => Promise<AssetRecordTrackingStoreResult<AssetVersionSummary>>;
	getTracking: (
		userId: string,
		projectId: string,
		assetRecordId: string
	) => Promise<AssetRecordTrackingDetail | null>;
	recordReview: (
		userId: string,
		input: z.infer<typeof assetVersionReviewInputSchema>
	) => Promise<AssetRecordTrackingStoreResult<ReviewEventSummary>>;
}
