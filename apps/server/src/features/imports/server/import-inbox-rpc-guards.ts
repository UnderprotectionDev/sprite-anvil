import { ORPCError } from "@orpc/server";
import { sourceMetadataMappingSidecarLimits } from "@sprite-anvil/api/source-metadata-mapping";
import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

const finalizationRequestBytes = 1024 * 1024;

function payloadTooLarge(c: Context, message: string) {
	return c.json(
		{ json: new ORPCError("PAYLOAD_TOO_LARGE", { message }).toJSON() },
		413
	);
}

/**
 * Request guards for the Import Inbox oRPC procedures: every response is
 * private and uncached, and the two JSON writes keep their request byte caps
 * before the body is parsed.
 */
export function mountImportInboxRpcGuards(app: Hono) {
	app.use("/rpc/imports/*", async (c, next) => {
		c.header("Cache-Control", "private, no-store");
		await next();
	});
	app.use(
		"/rpc/imports/createSourceMetadataMappingProposal",
		bodyLimit({
			maxSize: sourceMetadataMappingSidecarLimits.requestBytes,
			onError: (c) =>
				payloadTooLarge(
					c,
					"Source metadata proposal request exceeds the maximum size"
				),
		})
	);
	app.use(
		"/rpc/imports/finalizeSourceMetadataMapping",
		bodyLimit({
			maxSize: finalizationRequestBytes,
			onError: (c) =>
				payloadTooLarge(
					c,
					"Source metadata finalization request exceeds the maximum size"
				),
		})
	);
}
