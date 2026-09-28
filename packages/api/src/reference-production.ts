import { z } from "zod";
import {
	assetVersionContentTypeSchema,
	assetVersionFileNameSchema,
	type ReferenceFeature,
	referenceFeatureSchema,
	referenceFeatures,
	referenceRoleSchema,
	referenceSummarySchema,
	refineReferenceRoleRules,
} from "./asset-record-tracking";

const idSchema = z.uuid();

const referenceRoleFields = {
	contextOverrideRationale: z.string().trim().max(1000).nullable(),
	customPurpose: z.string().trim().max(240).nullable(),
	forbiddenFeatures: z.array(referenceFeatureSchema).max(7),
	notes: z.string().trim().max(1000).nullable(),
	role: referenceRoleSchema,
	transferredFeatures: z.array(referenceFeatureSchema).max(7),
};

export const referenceBoardMetadataSchema = z
	.object({
		...referenceRoleFields,
	})
	.strict()
	.superRefine(refineReferenceRoleRules);

export const referenceBoardHistoryEntrySchema = z
	.object({
		...referenceRoleFields,
		recordedAt: z.iso.datetime(),
		revision: z.number().int().positive(),
	})
	.strict();

export const referenceBoardImageSchema = z
	.object({
		...referenceRoleFields,
		assetRecordId: idSchema,
		contentLength: z
			.number()
			.int()
			.positive()
			.max(5 * 1024 * 1024),
		contentType: assetVersionContentTypeSchema,
		conflictFeatures: z.array(referenceFeatureSchema),
		createdAt: z.iso.datetime(),
		fileName: assetVersionFileNameSchema,
		history: z.array(referenceBoardHistoryEntrySchema),
		id: idSchema,
		revision: z.number().int().positive(),
		sha256: z.string().regex(/^[a-f0-9]{64}$/),
		sortOrder: z.number().int().nonnegative(),
		updatedAt: z.iso.datetime(),
	})
	.strict();
export type ReferenceBoardImage = z.infer<typeof referenceBoardImageSchema>;

export const referenceBoardConflictSchema = z
	.object({
		allowingReferenceIds: z.array(idSchema),
		feature: referenceFeatureSchema,
		forbiddingReferenceIds: z.array(idSchema),
	})
	.strict();

export const referenceBoardSchema = z
	.object({
		assetVersionReferences: z.array(referenceSummarySchema),
		conflicts: z.array(referenceBoardConflictSchema),
		effectiveForbiddenFeatures: z.array(referenceFeatureSchema),
		effectiveTransferredFeatures: z.array(referenceFeatureSchema),
		imageReferences: z.array(referenceBoardImageSchema),
	})
	.strict();
export type ReferenceBoard = z.infer<typeof referenceBoardSchema>;

export const referenceBoardListInputSchema = z
	.object({ assetRecordId: idSchema, projectId: idSchema })
	.strict();

export const referenceBoardUploadInputSchema = z
	.object({
		assetRecordId: idSchema,
		contentLength: z
			.number()
			.int()
			.positive()
			.max(5 * 1024 * 1024),
		contentType: assetVersionContentTypeSchema,
		contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
		fileName: assetVersionFileNameSchema,
		id: idSchema,
		objectKey: z.string().min(1).max(500),
		projectId: idSchema,
		...referenceRoleFields,
	})
	.strict()
	.superRefine(refineReferenceRoleRules);
export type ReferenceBoardUploadInput = z.infer<
	typeof referenceBoardUploadInputSchema
>;

export const referenceBoardUpdateInputSchema = z
	.object({
		assetRecordId: idSchema,
		expectedRevision: z.number().int().positive(),
		id: idSchema,
		projectId: idSchema,
		...referenceRoleFields,
	})
	.strict()
	.superRefine(refineReferenceRoleRules);
export type ReferenceBoardUpdateInput = z.infer<
	typeof referenceBoardUpdateInputSchema
>;

export interface ReferenceBoardHistoryRecord {
	contextOverrideRationale: string | null;
	customPurpose: string | null;
	forbiddenFeatures: ReferenceFeature[];
	notes: string | null;
	recordedAt: Date | string;
	revision: number;
	role: z.infer<typeof referenceRoleSchema>;
	transferredFeatures: ReferenceFeature[];
}

export interface ReferenceBoardFileRecord {
	contentLength: number;
	contentType: z.infer<typeof assetVersionContentTypeSchema>;
	fileName: string;
	objectKey: string;
}

export type ReferenceBoardWriteResult =
	| { ok: true; value: ReferenceBoardImage }
	| {
			ok: false;
			reason: "conflict" | "not_found" | "context_override_required";
	  };

export type ReferenceBoardCreateResult =
	| { kind: "created" | "existing"; ok: true; value: ReferenceBoardImage }
	| {
			ok: false;
			reason: "conflict" | "not_found" | "context_override_required";
	  };

export interface ReferenceProductionStore {
	createImage: (
		userId: string,
		input: ReferenceBoardUploadInput
	) => Promise<ReferenceBoardCreateResult>;
	getImageFile: (
		userId: string,
		projectId: string,
		assetRecordId: string,
		referenceId: string
	) => Promise<ReferenceBoardFileRecord | null>;
	listImages: (
		userId: string,
		projectId: string,
		assetRecordId: string
	) => Promise<ReferenceBoardImage[] | null>;
	updateImage: (
		userId: string,
		input: ReferenceBoardUpdateInput
	) => Promise<ReferenceBoardWriteResult>;
}

export interface ReferenceTransferConstraintSet {
	forbiddenFeatures: readonly ReferenceFeature[];
	id: string;
	transferredFeatures: readonly ReferenceFeature[];
}

export interface ReferenceTransferConflict {
	allowingReferenceIds: string[];
	feature: ReferenceFeature;
	forbiddingReferenceIds: string[];
}

export function indexReferenceConflictFeaturesById(
	conflicts: readonly ReferenceTransferConflict[]
): Map<string, Set<ReferenceFeature>> {
	const featuresByReferenceId = new Map<string, Set<ReferenceFeature>>();
	for (const conflict of conflicts) {
		for (const referenceId of [
			...conflict.allowingReferenceIds,
			...conflict.forbiddingReferenceIds,
		]) {
			const features =
				featuresByReferenceId.get(referenceId) ?? new Set<ReferenceFeature>();
			features.add(conflict.feature);
			featuresByReferenceId.set(referenceId, features);
		}
	}
	return featuresByReferenceId;
}

export interface ReferenceTransferAnalysis {
	conflicts: ReferenceTransferConflict[];
	effectiveForbiddenFeatures: ReferenceFeature[];
	effectiveTransferredFeatures: ReferenceFeature[];
}

export function analyzeReferenceTransferConstraints(
	references: readonly ReferenceTransferConstraintSet[]
): ReferenceTransferAnalysis {
	const effectiveForbiddenFeatures: ReferenceFeature[] = [];
	const effectiveTransferredFeatures: ReferenceFeature[] = [];

	for (const feature of referenceFeatures) {
		// A prohibition on one role overrides allowances from every other role.
		const isForbidden = references.some((reference) =>
			reference.forbiddenFeatures.includes(feature)
		);
		if (isForbidden) {
			effectiveForbiddenFeatures.push(feature);
			continue;
		}

		const isTransferred = references.some((reference) =>
			reference.transferredFeatures.includes(feature)
		);
		if (isTransferred) {
			effectiveTransferredFeatures.push(feature);
		}
	}

	return {
		conflicts: [],
		effectiveForbiddenFeatures,
		effectiveTransferredFeatures,
	};
}
