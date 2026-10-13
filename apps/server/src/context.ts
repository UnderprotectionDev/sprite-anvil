import type { Context as ApiContext } from "@sprite-anvil/api/context";
import type { Context as HonoContext } from "hono";
import { assetVersionObjectKeySchema } from "./cloudflare";
import { verifyAssetVersionStream } from "./features/asset-versions/server/asset-version-integrity";
import { readAnimationMetadataPackageTarget } from "./features/character-animation-profile/server/animation-metadata-package-target";
import { readGameplayMetadataPackageTarget } from "./features/gameplay-metadata/server/gameplay-metadata-package-target";
import { reviewGameplayMetadata } from "./features/gameplay-metadata/server/gameplay-metadata-review";
import { checkTextureEdges } from "./features/tileset-texture-profile/server/texture-image-reader";
import { decodeVfxFrame } from "./features/vfx-profile/server/vfx-frame-decoder";
import { readVfxImageDimensions } from "./features/vfx-profile/server/vfx-image-dimensions";
import {
	animationTimingReviewStore,
	assetFamilyComparisonStore,
	assetFamilyStore,
	assetRecordStore,
	assetRecordTrackingStore,
	assetVersionStore,
	auth,
	backgroundLayerLayoutStore,
	backgroundScrollingTestStore,
	collectionStore,
	createServerAssetVersionStorage,
	db,
	dependencyRevalidationStore,
	directionalReviewStore,
	familyReadinessStore,
	gameplayMetadataStore,
	generationPackageStore,
	iconFamilyReviewStore,
	marketingUsageReviewStore,
	projectAccess,
	projectContextScopeStore,
	projectContextStore,
	providerGenerationRecordStore,
	referenceProductionStore,
	rightsRecordStore,
	sceneQaStore,
	specializedProfileContractStore,
	textureRepetitionReviewStore,
	tilesetAdjacencyReviewStore,
	uiStateComparisonStore,
	vfxAppearanceReviewStore,
	vfxSynchronizationStore,
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
		sceneQaStore,
		vfxSynchronizationStore,
		readVfxImageDimensions,
		assetFamilyStore,
		assetFamilyComparisonStore,
		familyReadinessStore,
		dependencyRevalidationStore,
		assetRecordStore,
		assetRecordTrackingStore,
		assetVersionStore,
		animationTimingReviewStore,
		vfxAppearanceReviewStore,
		collectionStore,
		generationPackageStore,
		gameplayMetadataStore,
		backgroundScrollingTestStore,
		backgroundLayerLayoutStore,
		iconFamilyReviewStore,
		uiStateComparisonStore,
		marketingUsageReviewStore,
		textureRepetitionReviewStore,
		checkTextureEdges,
		tilesetAdjacencyReviewStore,
		directionalReviewStore,
		readAnimationMetadataPackageTarget,
		reviewGameplayMetadata,
		readGameplayMetadataPackageTarget,
		verifyVfxFrameContent: async (userId, projectId, frame) => {
			const file = await assetVersionStore.getFileRecord(
				userId,
				projectId,
				frame.assetVersionId
			);
			if (!(file?.integrityVerified && file.contentDigest)) {
				return false;
			}
			const object = await createServerAssetVersionStorage().get(
				assetVersionObjectKeySchema.parse(file.objectKey)
			);
			if (!object) {
				return false;
			}
			try {
				const bytes = await new Response(
					verifyAssetVersionStream(
						object.body,
						file.contentType,
						file.contentLength,
						file.contentDigest
					).body
				).arrayBuffer();
				await decodeVfxFrame(bytes, frame);
				return true;
			} catch {
				return false;
			}
		},
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
		providerGenerationRecordStore,
		referenceProductionStore,
		rightsRecordStore,
		specializedProfileContractStore,
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
