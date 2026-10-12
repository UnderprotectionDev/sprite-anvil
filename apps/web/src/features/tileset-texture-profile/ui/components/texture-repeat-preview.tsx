import type { TextureAtlasRegion } from "@sprite-anvil/api/texture-repetition-reviews";
import { useEffect, useState } from "react";
import { ENV } from "@/env";

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";
function cropTexture(image: HTMLImageElement, region: TextureAtlasRegion) {
	if (
		region.x < 0 ||
		region.y < 0 ||
		region.width < 1 ||
		region.height < 1 ||
		region.x + region.width > image.naturalWidth ||
		region.y + region.height > image.naturalHeight
	) {
		throw new Error("Atlas region is outside the source image.");
	}
	const tile = document.createElement("canvas");
	tile.width = region.width;
	tile.height = region.height;
	const context = tile.getContext("2d");
	if (!context) {
		throw new Error("Texture preview could not be drawn.");
	}
	context.drawImage(
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
	return tile.toDataURL();
}
export function TextureRepeatPreview({
	arrangement,
	previewUrl,
	region,
	axes,
	offset,
	zoom,
	onStatus,
	onDimensions,
	statusKey,
}: {
	arrangement: "2x2" | "3x3" | "shifted";
	previewUrl: string;
	region: TextureAtlasRegion;
	axes: ("x" | "y")[];
	offset: { x: number; y: number };
	zoom: number;
	onStatus: (key: string, ready: boolean) => void;
	onDimensions: (dimensions: { width: number; height: number }) => void;
	statusKey: string;
}) {
	const [imageUrl, setImageUrl] = useState("");
	const [error, setError] = useState("");
	const { x, y, width, height } = region;
	useEffect(() => {
		let active = true;
		const image = new Image();
		onStatus(statusKey, false);
		setImageUrl("");
		setError("");
		image.crossOrigin = "use-credentials";
		image.onload = () => {
			if (!active) {
				return;
			}
			try {
				onDimensions({
					width: image.naturalWidth,
					height: image.naturalHeight,
				});
				setImageUrl(cropTexture(image, { x, y, width, height }));
				onStatus(statusKey, true);
			} catch (cause) {
				setError(
					cause instanceof Error
						? cause.message
						: "Texture preview could not be drawn."
				);
			}
		};
		image.onerror = () => {
			if (active) {
				setError("Texture preview failed to load. Reload to retry.");
			}
		};
		image.src = `${serverUrl}${previewUrl}`;
		return () => {
			active = false;
			image.onload = null;
			image.onerror = null;
		};
	}, [previewUrl, x, y, width, height, statusKey, onStatus, onDimensions]);
	const count = arrangement === "2x2" ? 2 : 3;
	let repeat = "repeat";
	if (axes.length === 1) {
		repeat = axes[0] === "x" ? "repeat-x" : "repeat-y";
	}
	const shiftX = arrangement === "shifted" ? offset.x * zoom : 0;
	const shiftY = arrangement === "shifted" ? offset.y * zoom : 0;
	return (
		<div className="overflow-auto rounded border p-2">
			{error ? <p role="alert">{error}</p> : null}
			{imageUrl || error ? null : <p role="status">Loading texture preview…</p>}
			<div
				aria-label={`${arrangement} texture repetition preview`}
				role="img"
				style={{
					imageRendering: "pixelated",
					width: width * (axes.includes("x") ? count : 1) * zoom,
					height: height * (axes.includes("y") ? count : 1) * zoom,
					backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
					backgroundSize: `${width * zoom}px ${height * zoom}px`,
					backgroundRepeat: repeat,
					backgroundPosition: `${-shiftX}px ${-shiftY}px`,
				}}
			/>
		</div>
	);
}
