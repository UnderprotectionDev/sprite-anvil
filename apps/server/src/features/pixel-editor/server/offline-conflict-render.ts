import type { AssetVersionFileRecord } from "@sprite-anvil/api/asset-versions";
import type { PixelOperation } from "@sprite-anvil/api/pixel-editor";
import {
	failure,
	type Outcome,
	readSourceRaster,
	type Scope,
	success,
} from "./pixel-editor-context";
import {
	PixelOperationError,
	type Raster,
	replayOperations,
} from "./pixel-operations";
import { encodeRasterPng } from "./pixel-raster-codec";

/** Replays operations over a source Asset Version; never writes. */
export async function replayOverSource(
	scope: Scope,
	sourceAssetVersionId: string,
	operations: PixelOperation[]
): Promise<Outcome<{ raster: Raster; sourceFile: AssetVersionFileRecord }>> {
	const { access, dependencies } = scope;
	const sourceFile = await dependencies.assetVersionStore.getFileRecord(
		access.userId,
		access.projectId,
		sourceAssetVersionId
	);
	const source: Raster | null = sourceFile
		? await readSourceRaster(dependencies, sourceFile)
		: null;
	if (!(sourceFile && source)) {
		return failure("Source Asset Version image unavailable", 502);
	}
	try {
		const { raster } = replayOperations(source, operations);
		return success({ raster, sourceFile });
	} catch (error) {
		if (error instanceof PixelOperationError) {
			return failure("Invalid pixel operation", 422, error.message);
		}
		throw error;
	}
}

export async function renderVersion(
	scope: Scope,
	sourceAssetVersionId: string,
	operations: PixelOperation[]
): Promise<
	Outcome<{ png: Uint8Array<ArrayBuffer>; sourceFile: AssetVersionFileRecord }>
> {
	const replayed = await replayOverSource(
		scope,
		sourceAssetVersionId,
		operations
	);
	if (!replayed.ok) {
		return replayed;
	}
	return success({
		png: await encodeRasterPng(replayed.value.raster),
		sourceFile: replayed.value.sourceFile,
	});
}
