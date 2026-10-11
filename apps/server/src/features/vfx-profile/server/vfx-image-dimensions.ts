import { CryptoHasher } from "bun";
import { assetVersionObjectKeySchema } from "../../../cloudflare";
import {
	assetVersionStore,
	createServerAssetVersionStorage,
} from "../../../services";
import { decodeVfxImage } from "./vfx-image-decode";

/** Decode the verified bytes, including the alpha plane, before accepting frame bounds. */
export async function readVfxImageDimensions(
	userId: string,
	projectId: string,
	assetVersionId: string
) {
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
	if (!object) {
		return null;
	}
	try {
		const bytes = Buffer.from(await new Response(object.body).arrayBuffer());
		if (bytes.length !== file.contentLength) {
			return null;
		}
		const hash = new CryptoHasher("sha256").update(bytes).digest("hex");
		if (hash !== file.contentDigest) {
			return null;
		}
		return await decodeVfxImage(bytes);
	} catch {
		return null;
	}
}
