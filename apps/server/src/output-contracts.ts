import z from "zod";

/**
 * Allowlisted contracts for the server's current JSON outputs. Keep them strict
 * and construct values field by field; do not serialize database rows or errors.
 */
export const projectSummaryResponseSchema = z
	.object({
		id: z.string().uuid(),
		name: z.string(),
	})
	.strict();

export function serializeProjectSummaryResponse(project: {
	id: string;
	name: string;
}) {
	return projectSummaryResponseSchema.parse({
		id: project.id,
		name: project.name,
	});
}

export const assetAcceptedResponseSchema = z
	.object({ assetId: z.string().uuid() })
	.strict();

export function serializeAssetAcceptedResponse(assetId: string) {
	return assetAcceptedResponseSchema.parse({ assetId });
}

export const publicApiErrorSchema = z
	.object({
		error: z.enum([
			"Unauthorized",
			"Not found",
			"Unsupported asset type",
			"Missing asset content",
			"Invalid asset content length",
			"Asset upload failed",
			"Internal Server Error",
		]),
	})
	.strict();

export type PublicApiError = z.infer<typeof publicApiErrorSchema>["error"];

export function serializePublicApiError(error: PublicApiError) {
	return publicApiErrorSchema.parse({ error });
}

export const healthResponseSchema = z
	.object({ status: z.literal("ok") })
	.strict();

export function serializeHealthResponse() {
	return healthResponseSchema.parse({ status: "ok" });
}
