import type { Context as ApiContext } from "@sprite-anvil/api/context";
import type { Context as HonoContext } from "hono";
import { assetVersionObjectKeySchema } from "./cloudflare";
import { verifyAssetVersionStream } from "./features/asset-versions/server/asset-version-integrity";
import {
	assetFamilyStore,
	assetRecordStore,
	assetRecordTrackingStore,
	assetVersionStore,
	auth,
	createServerAssetVersionStorage,
	db,
	projectAccess,
	projectContextScopeStore,
	projectContextStore,
} from "./services";

export interface CreateContextOptions {
	context: HonoContext;
}

export async function createContext({
	context,
}: CreateContextOptions): Promise<ApiContext> {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});
	return {
		assetFamilyStore,
		assetRecordStore,
		assetRecordTrackingStore,
		assetVersionStore,
		verifyAssetVersionContent: async (userId, projectId, assetVersionId) => {
			const fileRecord = await assetVersionStore.getFileRecord(
				userId,
				projectId,
				assetVersionId
			);
			if (!(fileRecord?.integrityVerified && fileRecord.contentDigest)) {
				return false;
			}
			const objectKey = assetVersionObjectKeySchema.parse(fileRecord.objectKey);
			const object = await createServerAssetVersionStorage().get(objectKey);
			if (
				!object ||
				object.contentType !== fileRecord.contentType ||
				(object.contentLength !== undefined &&
					object.contentLength !== fileRecord.contentLength)
			) {
				await object?.body.cancel();
				return false;
			}
			const reader = verifyAssetVersionStream(
				object.body,
				fileRecord.contentType,
				fileRecord.contentLength,
				fileRecord.contentDigest
			).body.getReader();
			try {
				let result = await reader.read();
				while (!result.done) {
					// biome-ignore lint/performance/noAwaitInLoops: A stream reader must consume chunks sequentially.
					result = await reader.read();
				}
				return true;
			} catch {
				return false;
			} finally {
				reader.releaseLock();
			}
		},
		projectAccess,
		projectContextScopeStore,
		db,
		projectContextStore,
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
