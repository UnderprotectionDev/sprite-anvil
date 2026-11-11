import {
	buildGodotOutputZip,
	type GodotOutput,
} from "@sprite-anvil/api/godot-output";
import { honoGetBytes, projectApiUrl } from "@/utils/hono-api";

/**
 * Packs a Godot output into one zip. The output references each texture by
 * Asset Version, so the bytes are read from the project's verified Asset
 * Version storage, the same files the bundle pins by SHA-256.
 */
export async function packGodotOutput(
	projectId: string,
	output: GodotOutput
): Promise<Uint8Array> {
	const versionIds = [
		...new Set(
			output.files.flatMap((file) =>
				file.assetVersionId ? [file.assetVersionId] : []
			)
		),
	];
	const textures = new Map(
		await Promise.all(
			versionIds.map(
				async (assetVersionId) =>
					[
						assetVersionId,
						await honoGetBytes(
							`${projectApiUrl(projectId)}/asset-versions/${encodeURIComponent(assetVersionId)}/preview`,
							"The texture could not be read"
						),
					] as const
			)
		)
	);
	return buildGodotOutputZip(output, textures);
}

/** Hands the zip to the browser as a file download. */
export function downloadZip(bytes: Uint8Array, fileName: string) {
	const url = URL.createObjectURL(
		new Blob([bytes as BlobPart], { type: "application/zip" })
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	link.click();
	URL.revokeObjectURL(url);
}
