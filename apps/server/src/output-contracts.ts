import { ORPCError } from "@orpc/server";
import {
	assetVersionSchema,
	unitVersionCorrectionUploadResponseSchema,
} from "@sprite-anvil/api/asset-versions";
import { supportReferenceSchema } from "@sprite-anvil/api/error-contract";
import z from "zod";

/**
 * Allowlisted contracts for the server's current JSON outputs. Keep them strict
 * and construct values field by field; do not serialize database rows or errors.
 */
export const projectSummaryResponseSchema = z
	.object({
		id: z.string().min(1),
		name: z.string(),
		previewUrl: z
			.string()
			.regex(/^\/api\/projects\/[^/?#]+\/preview$/)
			.nullable(),
	})
	.strict();

export function serializeProjectSummaryResponse(project: {
	id: string;
	name: string;
	previewUrl: string | null;
}) {
	return projectSummaryResponseSchema.parse({
		id: project.id,
		name: project.name,
		previewUrl: project.previewUrl,
	});
}

export const twoDVisualAssetAcceptedResponseSchema = z
	.object({ twoDVisualAssetId: z.string().uuid() })
	.strict();

export function serializeTwoDVisualAssetAcceptedResponse(
	twoDVisualAssetId: string
) {
	return twoDVisualAssetAcceptedResponseSchema.parse({ twoDVisualAssetId });
}

export const assetVersionUploadResponseSchema = assetVersionSchema;

export function serializeAssetVersionUploadResponse(assetVersion: unknown) {
	return assetVersionUploadResponseSchema.parse(assetVersion);
}

export function serializeUnitVersionCorrectionUploadResponse(
	assetVersion: unknown,
	unitVersion: unknown
) {
	return unitVersionCorrectionUploadResponseSchema.parse({
		assetVersion,
		unitVersion,
	});
}

export const publicApiErrorSchema = z
	.object({
		error: z.enum([
			"Unauthorized",
			"Not found",
			"Unsupported 2D Visual Asset type",
			"Missing 2D Visual Asset content",
			"Invalid 2D Visual Asset content length",
			"2D Visual Asset upload failed",
			"Unsupported Asset Version type",
			"Invalid Asset Version source kind",
			"Invalid Asset Version file name",
			"Missing Asset Version content",
			"Invalid Asset Version content length",
			"Missing Asset Version idempotency key",
			"Invalid Asset Version image content",
			"Asset Version idempotency conflict",
			"Asset Version integrity check failed",
			"Asset Version upload failed",
			"Invalid Managed Snapshot content length",
			"Managed Snapshot exceeds the 100 MB limit",
			"Invalid Managed Snapshot file name",
			"Missing Managed Snapshot idempotency key",
			"Missing Managed Snapshot content",
			"Managed Snapshot idempotency conflict",
			"Managed Snapshot digest could not be verified",
			"Managed Snapshot upload failed",
			"Managed Snapshot integrity check failed",
			"Manual Import Evidence is required for Asset Version uploads",
			"Unsupported Reference image type",
			"Invalid Reference image file name",
			"Missing Reference upload idempotency key",
			"Invalid Reference image content length",
			"Invalid Reference purpose or transfer rules",
			"Missing Reference image content",
			"Reference idempotency conflict",
			"A Context Override rationale is required",
			"Invalid Reference image content",
			"Reference image upload failed",
			"Reference image unavailable",
			"Invalid Unit Version correction",
			"Unit Version source does not match",
			"Unsupported Import Inbox upload content type",
			"Invalid Import Inbox file content length",
			"Invalid Import Inbox file name",
			"Invalid Import Inbox source content type",
			"Missing Import Inbox idempotency key",
			"Missing Import Inbox file content",
			"Invalid Import Inbox file content",
			"Import Inbox idempotency conflict",
			"Import Inbox file upload failed",
			"Import Inbox file unavailable",
			"Invalid source metadata proposal",
			"Invalid source metadata JSON",
			"Unsupported source metadata format",
			"Source metadata sidecars exceed the maximum size",
			"Source metadata proposal request exceeds the maximum size",
			"Internal Server Error",
		]),
		supportReference: supportReferenceSchema.optional(),
	})
	.strict();

export type PublicApiError = z.infer<typeof publicApiErrorSchema>["error"];

export function serializePublicApiError(
	error: PublicApiError,
	supportReference?: string
) {
	return publicApiErrorSchema.parse({
		error,
		...(supportReference ? { supportReference } : {}),
	});
}

export function serializeRpcInternalServerError(supportReference: string) {
	return {
		json: new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Internal server error",
			data: {
				supportReference: supportReferenceSchema.parse(supportReference),
			},
		}).toJSON(),
	};
}

export const healthResponseSchema = z
	.object({ status: z.literal("ok") })
	.strict();

export function serializeHealthResponse() {
	return healthResponseSchema.parse({ status: "ok" });
}
