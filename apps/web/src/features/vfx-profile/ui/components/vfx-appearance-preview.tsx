import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import { useEffect, useRef, useState } from "react";
import { ENV } from "@/env";
import {
	createVfxPlaybackRenderer,
	type VfxPlayback,
} from "./vfx-playback-renderer";

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";
export function VfxAppearancePreview({
	input,
	versions,
	elapsedMs,
	onReady,
}: {
	input: VfxPlayback;
	versions: AssetVersion[];
	elapsedMs: number;
	onReady: (ready: boolean) => void;
}) {
	const host = useRef<HTMLDivElement>(null);
	const renderer = useRef<Awaited<
		ReturnType<typeof createVfxPlaybackRenderer>
	> | null>(null);
	const [error, setError] = useState("");
	useEffect(() => {
		let disposed = false;
		const images: HTMLImageElement[] = [];
		const element = host.current;
		onReady(false);
		setError("");
		const loadImage = async (id: string) => {
			const version = versions.find((candidate) => candidate.id === id);
			if (!version) {
				throw new Error("Exact version is unavailable.");
			}
			const image = new Image();
			images.push(image);
			image.crossOrigin = "use-credentials";
			image.src = `${serverUrl}${version.previewUrl}`;
			await image.decode();
			return image;
		};
		const initialize = async () => {
			try {
				const [frameImages, scene] = await Promise.all([
					Promise.all(
						input.frames.map((frame) => loadImage(frame.assetVersionId))
					),
					loadImage(input.sceneAssetVersionId),
				]);
				if (disposed || !element) {
					return;
				}
				const result = await createVfxPlaybackRenderer(
					input,
					frameImages,
					scene,
					element,
					() => disposed
				);
				if (disposed) {
					result.dispose();
					return;
				}
				renderer.current = result;
				onReady(true);
			} catch {
				if (!disposed) {
					setError(
						"Effect or scene image could not be decoded. Saving is blocked."
					);
					onReady(false);
				}
			}
		};
		void initialize();
		return () => {
			disposed = true;
			for (const image of images) {
				image.src = "";
			}
			renderer.current?.dispose();
			renderer.current = null;
		};
	}, [input, versions, onReady]);
	useEffect(() => {
		renderer.current?.render(elapsedMs);
	}, [elapsedMs]);
	return (
		<div>
			{error ? <p role="alert">{error}</p> : null}
			<div className="grid gap-4 md:grid-cols-2" ref={host} />
		</div>
	);
}
