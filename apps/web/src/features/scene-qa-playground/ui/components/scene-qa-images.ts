import type { SceneQaSetup } from "@sprite-anvil/api/scene-qa";
import { ENV } from "@/env";

const trailingSlash = /\/$/;
export async function loadSceneQaImages(
	setup: SceneQaSetup,
	versions: { id: string; previewUrl: string }[]
) {
	return new Map(
		await Promise.all(
			[...new Set(setup.placements.map((p) => p.assetVersionId))].map(
				async (id) => {
					const version = versions.find((v) => v.id === id);
					if (!version) {
						throw new Error("Exact scene version is unavailable.");
					}
					const image = new Image();
					image.crossOrigin = "use-credentials";
					image.src = version.previewUrl.startsWith("/")
						? `${ENV.VITE_SERVER_URL.replace(trailingSlash, "")}${version.previewUrl}`
						: version.previewUrl;
					await image.decode();
					return [id, image] as const;
				}
			)
		)
	);
}
