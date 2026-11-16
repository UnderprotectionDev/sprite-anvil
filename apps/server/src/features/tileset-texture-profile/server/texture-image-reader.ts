import type { VerifyAssetVersionStream } from "@sprite-anvil/api/asset-version-integrity";
import type { Context } from "@sprite-anvil/api/context";
import { assetVersionObjectKeySchema } from "../../../cloudflare";
import {
	assetVersionStore,
	createServerAssetVersionStorage,
} from "../../../services";
import { checkTextureImageEdges } from "./texture-edge-check";
import { checkTilesetImageSeam } from "./tileset-seam-check";

async function readVerifiedImage(
	verifyAssetVersionStream: VerifyAssetVersionStream,
	userId: string,
	projectId: string,
	assetVersionId: string
): Promise<Uint8Array | null> {
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
		return new Uint8Array(await new Response(stream).arrayBuffer());
	} catch {
		return null;
	}
}

export const createTextureEdgeChecker =
	(
		verifyAssetVersionStream: VerifyAssetVersionStream
	): NonNullable<Context["checkTextureEdges"]> =>
	async (userId, projectId, assetVersionId, region, axes) => {
		const bytes = await readVerifiedImage(
			verifyAssetVersionStream,
			userId,
			projectId,
			assetVersionId
		);
		if (!bytes) {
			return null;
		}
		try {
			return await checkTextureImageEdges(bytes, region, axes);
		} catch {
			return null;
		}
	};

export const createTilesetSeamChecker =
	(
		verifyAssetVersionStream: VerifyAssetVersionStream
	): NonNullable<Context["checkTilesetSeam"]> =>
	async (userId, projectId, first, second, direction) => {
		const [a, b] = await Promise.all([
			readVerifiedImage(
				verifyAssetVersionStream,
				userId,
				projectId,
				first.versionId
			),
			readVerifiedImage(
				verifyAssetVersionStream,
				userId,
				projectId,
				second.versionId
			),
		]);
		if (!(a && b)) {
			return null;
		}
		try {
			return await checkTilesetImageSeam(
				a,
				first.region,
				b,
				second.region,
				direction
			);
		} catch {
			return null;
		}
	};
