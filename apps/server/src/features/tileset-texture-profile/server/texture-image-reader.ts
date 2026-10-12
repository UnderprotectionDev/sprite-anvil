import type { Context } from "@sprite-anvil/api/context";
import { assetVersionObjectKeySchema } from "../../../cloudflare";
import {
	assetVersionStore,
	createServerAssetVersionStorage,
} from "../../../services";
import { verifyAssetVersionStream } from "../../asset-versions/server/asset-version-integrity";
import { checkTextureImageEdges } from "./texture-edge-check";

export const checkTextureEdges: NonNullable<
	Context["checkTextureEdges"]
> = async (userId, projectId, assetVersionId, region, axes) => {
	const file = await assetVersionStore.getFileRecord(
		userId,
		projectId,
		assetVersionId
	);
	if (!(file?.integrityVerified && file.contentDigest)) {
		return null;
	}
	const object = await createServerAssetVersionStorage().get(
		assetVersionObjectKeySchema.parse(file.objectKey)
	);
	if (
		!object ||
		object.contentType !== file.contentType ||
		(object.contentLength !== undefined &&
			object.contentLength !== file.contentLength)
	) {
		await object?.body.cancel();
		return null;
	}
	try {
		const stream = verifyAssetVersionStream(
			object.body,
			file.contentType,
			file.contentLength,
			file.contentDigest
		).body;
		const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
		return await checkTextureImageEdges(bytes, region, axes);
	} catch {
		return null;
	}
};
