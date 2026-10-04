import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type { DirectionalReviewFrame } from "@sprite-anvil/api/directional-reviews";
import { useEffect, useRef, useState } from "react";

import { ENV } from "@/env";

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";

export function DirectionalClipPreview({
	label,
	frames,
	versions,
	elapsedMs,
	zoom,
	statusKey,
	onStatus,
}: {
	label: string;
	frames: DirectionalReviewFrame[];
	versions: AssetVersion[];
	elapsedMs: number;
	zoom: number;
	statusKey: string;
	onStatus: (key: string, ready: boolean) => void;
}) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const [images, setImages] = useState<HTMLImageElement[]>([]);
	const [error, setError] = useState("");
	const [size, setSize] = useState({ width: 1, height: 1 });
	useEffect(() => {
		let active = true;
		setImages([]);
		setError("");
		onStatus(statusKey, false);
		const pendingImages: HTMLImageElement[] = [];
		Promise.all(
			frames.map(
				(frame) =>
					new Promise<HTMLImageElement>((resolve, reject) => {
						const version = versions.find(
							(candidate) => candidate.id === frame.assetVersionId
						);
						if (!version) {
							reject(new Error("Önce bir sürüm seçin."));
							return;
						}
						const image = new Image();
						pendingImages.push(image);
						image.crossOrigin = "use-credentials";
						image.onload = () => {
							const { region } = frame;
							if (
								region &&
								(region.x + region.width > image.naturalWidth ||
									region.y + region.height > image.naturalHeight)
							) {
								reject(new Error("Kare alanı görsel sınırlarının dışında."));
								return;
							}
							resolve(image);
						};
						image.onerror = () =>
							reject(
								new Error(
									"Önizleme yüklenemedi. Sürüm ve bağlantıyı kontrol edin."
								)
							);
						image.src = `${serverUrl}${version.previewUrl}`;
					})
			)
		).then(
			(loaded) => {
				if (!active) {
					return;
				}
				setImages(loaded);
				onStatus(statusKey, true);
			},
			(failure) => {
				if (active) {
					setError(
						failure instanceof Error ? failure.message : "Önizleme yüklenemedi."
					);
				}
			}
		);
		return () => {
			active = false;
			for (const image of pendingImages) {
				image.onload = null;
				image.onerror = null;
			}
		};
	}, [frames, versions, statusKey, onStatus]);
	const totalMs = frames.reduce((total, frame) => total + frame.durationMs, 0);
	let remaining = totalMs > 0 ? elapsedMs % totalMs : 0;
	let frameIndex = 0;
	for (let index = 0; index < frames.length; index += 1) {
		if (remaining < frames[index].durationMs) {
			frameIndex = index;
			break;
		}
		remaining -= frames[index].durationMs;
	}
	useEffect(() => {
		const image = images[frameIndex];
		const frame = frames[frameIndex];
		if (!(image && frame && canvas.current)) {
			return;
		}
		const region = frame.region ?? {
			x: 0,
			y: 0,
			width: image.naturalWidth,
			height: image.naturalHeight,
		};
		// A stable native-pixel viewport preserves size differences across frames.
		const width = Math.max(
			...images.map(
				(item, index) => frames[index].region?.width ?? item.naturalWidth
			)
		);
		const height = Math.max(
			...images.map(
				(item, index) => frames[index].region?.height ?? item.naturalHeight
			)
		);
		canvas.current.width = width;
		canvas.current.height = height;
		setSize({ width, height });
		const drawing = canvas.current.getContext("2d");
		if (!drawing) {
			onStatus(statusKey, false);
			setError("Piksel önizlemesi bu ortamda kullanılamıyor.");
			return;
		}
		drawing.imageSmoothingEnabled = false;
		drawing.clearRect(0, 0, width, height);
		drawing.drawImage(
			image,
			region.x,
			region.y,
			region.width,
			region.height,
			0,
			0,
			region.width,
			region.height
		);
	}, [images, frameIndex, frames, onStatus, statusKey]);
	return (
		<figure className="min-w-0 space-y-2">
			<figcaption>
				{label} · Kare {frameIndex + 1}
			</figcaption>
			<div
				className="overflow-auto border bg-muted p-2"
				style={{ maxHeight: 420 }}
			>
				<canvas
					aria-label={`${label} piksel önizlemesi`}
					ref={canvas}
					role="img"
					style={{
						width: size.width * zoom,
						height: size.height * zoom,
						imageRendering: "pixelated",
					}}
				/>
			</div>
			{error ? <p role="alert">{error}</p> : null}
		</figure>
	);
}
