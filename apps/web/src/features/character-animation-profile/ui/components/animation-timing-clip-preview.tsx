import type { AnimationTimingReviewFrame } from "@sprite-anvil/api/animation-timing-reviews";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import { useEffect, useRef, useState } from "react";

import { ENV } from "@/env";

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";

function getRegion(image: HTMLImageElement, frame: AnimationTimingReviewFrame) {
	return (
		frame.region ?? {
			x: 0,
			y: 0,
			width: image.naturalWidth,
			height: image.naturalHeight,
		}
	);
}

function drawFrame(
	drawing: CanvasRenderingContext2D,
	image: HTMLImageElement,
	frame: AnimationTimingReviewFrame,
	canvasWidth: number,
	canvasHeight: number,
	alpha: number
) {
	const region = getRegion(image, frame);
	drawing.globalAlpha = alpha;
	drawing.drawImage(
		image,
		region.x,
		region.y,
		region.width,
		region.height,
		Math.floor((canvasWidth - region.width) / 2),
		Math.floor((canvasHeight - region.height) / 2),
		region.width,
		region.height
	);
	drawing.globalAlpha = 1;
}

function getAdjacentFrameIndexes(
	frameIndex: number,
	frameCount: number,
	looping: boolean
) {
	let previousIndex = frameIndex > 0 ? frameIndex - 1 : null;
	if (previousIndex === null && looping && frameCount > 1) {
		previousIndex = frameCount - 1;
	}

	let nextIndex = frameIndex < frameCount - 1 ? frameIndex + 1 : null;
	if (nextIndex === null && looping && frameCount > 1) {
		nextIndex = 0;
	}

	return { nextIndex, previousIndex };
}

function drawAdjacentFrames(
	drawing: CanvasRenderingContext2D,
	images: HTMLImageElement[],
	frames: AnimationTimingReviewFrame[],
	frameIndex: number,
	looping: boolean,
	canvasWidth: number,
	canvasHeight: number
) {
	const { nextIndex, previousIndex } = getAdjacentFrameIndexes(
		frameIndex,
		frames.length,
		looping
	);
	for (const index of new Set([previousIndex, nextIndex])) {
		if (index === null || index === frameIndex) {
			continue;
		}
		const image = images[index];
		const frame = frames[index];
		if (image && frame) {
			drawFrame(drawing, image, frame, canvasWidth, canvasHeight, 0.2);
		}
	}
}

export function AnimationTimingClipPreview({
	elapsedMs,
	frames,
	label,
	looping,
	onStatus,
	statusKey,
	versions,
	zoom,
}: {
	elapsedMs: number;
	frames: AnimationTimingReviewFrame[];
	label: string;
	looping: boolean;
	onStatus: (key: string, ready: boolean) => void;
	statusKey: string;
	versions: AssetVersion[];
	zoom: number;
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
				(item) =>
					new Promise<HTMLImageElement>((resolve, reject) => {
						const version = versions.find(
							(candidate) => candidate.id === item.assetVersionId
						);
						if (!version) {
							reject(new Error("Önce bir Varlık Sürümü seçin."));
							return;
						}
						const image = new Image();
						pendingImages.push(image);
						image.crossOrigin = "use-credentials";
						image.onload = () => {
							const { region } = item;
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

	const totalMs = frames.reduce((total, item) => total + item.durationMs, 0);
	let boundedTime = Math.max(0, elapsedMs);
	if (looping) {
		boundedTime = totalMs > 0 ? boundedTime % totalMs : 0;
	} else {
		boundedTime = Math.min(boundedTime, Math.max(0, totalMs - 0.001));
	}
	let remaining = boundedTime;
	let frameIndex = 0;
	for (let index = 0; index < frames.length; index += 1) {
		const item = frames[index];
		if (!item || remaining < item.durationMs) {
			frameIndex = index;
			break;
		}
		remaining -= item.durationMs;
		frameIndex = index;
	}
	useEffect(() => {
		const currentImage = images[frameIndex];
		const currentFrame = frames[frameIndex];
		const canvasElement = canvas.current;
		if (!(currentImage && currentFrame && canvasElement)) {
			return;
		}
		const width = Math.max(
			...images.map((item, index) => getRegion(item, frames[index]).width)
		);
		const height = Math.max(
			...images.map((item, index) => getRegion(item, frames[index]).height)
		);
		canvasElement.width = width;
		canvasElement.height = height;
		setSize({ width, height });
		const drawing = canvasElement.getContext("2d");
		if (!drawing) {
			onStatus(statusKey, false);
			setError("Piksel önizlemesi bu ortamda kullanılamıyor.");
			return;
		}
		drawing.imageSmoothingEnabled = false;
		drawing.clearRect(0, 0, width, height);
		drawAdjacentFrames(
			drawing,
			images,
			frames,
			frameIndex,
			looping,
			width,
			height
		);
		drawFrame(drawing, currentImage, currentFrame, width, height, 1);
	}, [images, frameIndex, frames, looping, onStatus, statusKey]);

	const currentFrame = frames[frameIndex];
	const atLoopBoundary =
		looping &&
		frames.length > 1 &&
		(frameIndex === 0 || frameIndex === frames.length - 1);
	return (
		<figure className="min-w-0 space-y-2">
			<figcaption>
				{label} · Kare {frameIndex + 1}
				{currentFrame
					? ` · ${currentFrame.frameKey || "Kare kimliği yok"}`
					: ""}
				{currentFrame ? ` · ${currentFrame.durationMs} ms` : ""}
				{currentFrame?.motionPhase ? ` · ${currentFrame.motionPhase}` : ""}
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
			{atLoopBoundary ? <p>Döngü sınırı · son kare → ilk kare</p> : null}
			{error ? <p role="alert">{error}</p> : null}
		</figure>
	);
}
