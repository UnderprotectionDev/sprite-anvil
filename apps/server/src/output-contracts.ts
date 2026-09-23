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

export const visualAssetAcceptedResponseSchema = z
	.object({ visualAssetId: z.string().uuid() })
	.strict();

export function serializeVisualAssetAcceptedResponse(visualAssetId: string) {
	return visualAssetAcceptedResponseSchema.parse({ visualAssetId });
}

export const publicApiErrorSchema = z
	.object({
		error: z.enum([
			"Unauthorized",
			"Not found",
			"Unsupported visual asset type",
			"Missing visual asset content",
			"Invalid visual asset content length",
			"Visual asset upload failed",
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
