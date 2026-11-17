import type { AnimationTimingReviewFrame } from "@sprite-anvil/api/animation-timing-reviews";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type { GameplayMetadataRecord } from "@sprite-anvil/api/gameplay-metadata";
import { type RefObject, useEffect, useRef, useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { ENV } from "@/env";
import { displayedPoint } from "../../lib/spatial-frame-geometry";
import type { AnimationTimingMetadataStatus } from "./animation-timing-event-timeline";

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

interface Point {
	key: string;
	x: number;
	y: number;
}
function points(value: unknown, key = "root"): Point[] {
	if (!value || typeof value !== "object") {
		return [];
	}
	if (
		"x" in value &&
		"y" in value &&
		typeof value.x === "number" &&
		typeof value.y === "number" &&
		Number.isFinite(value.x) &&
		Number.isFinite(value.y)
	) {
		return [{ key, x: value.x, y: value.y }];
	}
	return Object.entries(value).flatMap(([name, child]) =>
		points(child, `${key}.${name}`)
	);
}

function spatialField(record: GameplayMetadataRecord | undefined, id: string) {
	return record?.fields.find(
		(field) =>
			field.fieldId === id &&
			field.unit === "px" &&
			field.coordinateSystem === "source_image_top_left"
	);
}

function FrameMetadata({
	label,
	metadata,
	status,
}: {
	label: string;
	metadata: GameplayMetadataRecord | undefined;
	status: AnimationTimingMetadataStatus;
}) {
	if (status === "loading") {
		return <p>Metadata loading…</p>;
	}
	if (status === "error") {
		return <p>Metadata could not be loaded.</p>;
	}
	if (!metadata) {
		return <p>No metadata for this frame and version.</p>;
	}
	const fields = [
		"pivot",
		"ground_point",
		"mount_points",
		"collision_areas",
	] as const;
	return (
		<section aria-label={`${label} frame metadata`}>
			<h4>Frame metadata</h4>
			<ul>
				{fields.map((id) => {
					const field = metadata.fields.find((item) => item.fieldId === id);
					return (
						<li key={id}>
							{id} ·{" "}
							{field && field.value !== null
								? JSON.stringify(field.value)
								: "Not specified"}
							{field?.unit ? ` · ${field.unit}` : ""}
							{field?.coordinateSystem ? ` · ${field.coordinateSystem}` : ""}
						</li>
					);
				})}
			</ul>
		</section>
	);
}

function useLoopDifference(
	frames: AnimationTimingReviewFrame[],
	images: HTMLImageElement[],
	looping: boolean,
	size: { width: number; height: number },
	setLoopDifference: (value: number | null) => void
) {
	useEffect(() => {
		setLoopDifference(null);
		const [first] = images;
		const last = images.at(-1);
		const [firstFrame] = frames;
		const lastFrame = frames.at(-1);
		if (
			!(
				looping &&
				images.length > 1 &&
				first &&
				last &&
				firstFrame &&
				lastFrame
			)
		) {
			return;
		}
		const firstRegion = getRegion(first, firstFrame);
		const lastRegion = getRegion(last, lastFrame);
		if (
			firstRegion.width !== lastRegion.width ||
			firstRegion.height !== lastRegion.height
		) {
			return;
		}
		try {
			const surface = document.createElement("canvas");
			surface.width = size.width;
			surface.height = size.height;
			const context = surface.getContext("2d", { willReadFrequently: true });
			if (!context) {
				return;
			}
			drawFrame(context, first, firstFrame, size.width, size.height, 1);
			const a = context.getImageData(0, 0, size.width, size.height).data;
			context.clearRect(0, 0, size.width, size.height);
			drawFrame(context, last, lastFrame, size.width, size.height, 1);
			const b = context.getImageData(0, 0, size.width, size.height).data;
			let changed = 0;
			for (let i = 0; i < a.length; i += 4) {
				if (
					a[i] !== b[i] ||
					a[i + 1] !== b[i + 1] ||
					a[i + 2] !== b[i + 2] ||
					a[i + 3] !== b[i + 3]
				) {
					changed += 1;
				}
			}
			setLoopDifference(changed);
		} catch {
			setLoopDifference(null);
		}
	}, [frames, images, looping, size.width, size.height, setLoopDifference]);
}

function usePreviewImages(
	frames: AnimationTimingReviewFrame[],
	versions: AssetVersion[],
	onStatus: (key: string, ready: boolean) => void,
	statusKey: string,
	setImages: (images: HTMLImageElement[]) => void,
	setError: (error: string) => void
) {
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
							reject(new Error("Select an Asset Version first."));
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
								reject(
									new Error("The frame region is outside the image bounds.")
								);
								return;
							}
							resolve(image);
						};
						image.onerror = () =>
							reject(
								new Error(
									"Could not load preview. Check the version and connection."
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
						failure instanceof Error
							? failure.message
							: "Could not load preview."
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
	}, [frames, versions, statusKey, onStatus, setImages, setError]);
}

function getFrameIndex(
	frames: AnimationTimingReviewFrame[],
	elapsedMs: number,
	looping: boolean
) {
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
	return frameIndex;
}

function useDrawPreview(
	canvas: RefObject<HTMLCanvasElement | null>,
	images: HTMLImageElement[],
	frames: AnimationTimingReviewFrame[],
	frameIndex: number,
	looping: boolean,
	onStatus: (key: string, ready: boolean) => void,
	statusKey: string,
	setSize: (size: { width: number; height: number }) => void,
	setError: (error: string) => void
) {
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
			setError("Pixel preview is unavailable in this environment.");
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
	}, [
		canvas,
		images,
		frameIndex,
		frames,
		looping,
		onStatus,
		statusKey,
		setSize,
		setError,
	]);
}

function findMetadata(
	records: GameplayMetadataRecord[],
	projectId: string,
	contractRevisionId: string,
	frame: AnimationTimingReviewFrame | undefined
) {
	return records
		.filter(
			(record) =>
				record.projectId === projectId &&
				record.profileId === "character_creature_animation" &&
				record.contractRevisionId === contractRevisionId &&
				record.assetVersionId === frame?.assetVersionId &&
				record.frameKey === frame?.frameKey
		)
		.sort(
			(a, b) =>
				b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)
		)
		.at(0);
}

function getGroundDelta(
	frames: AnimationTimingReviewFrame[],
	images: HTMLImageElement[],
	size: { width: number; height: number },
	gameplayMetadataStatus: AnimationTimingMetadataStatus,
	recordFor: (
		frame: AnimationTimingReviewFrame | undefined
	) => GameplayMetadataRecord | undefined
) {
	const [firstGround] = points(
		spatialField(recordFor(frames[0]), "ground_point")?.value
	);
	const [lastGround] = points(
		spatialField(recordFor(frames.at(-1)), "ground_point")?.value
	);
	const firstRegion =
		images[0] && frames[0] ? getRegion(images[0], frames[0]) : null;
	const lastImage = images.at(-1);
	const lastFrame = frames.at(-1);
	const lastRegion =
		lastImage && lastFrame ? getRegion(lastImage, lastFrame) : null;
	const groundDelta =
		firstGround &&
		lastGround &&
		firstRegion &&
		lastRegion &&
		gameplayMetadataStatus === "ready"
			? displayedPoint(lastGround, lastRegion, size).y -
				displayedPoint(firstGround, firstRegion, size).y
			: null;
	return groundDelta;
}

function SpatialOverlay({
	label,
	size,
	zoom,
	region,
	metadata,
}: {
	label: string;
	size: { width: number; height: number };
	zoom: number;
	region: { x: number; y: number; width: number; height: number } | null;
	metadata: GameplayMetadataRecord | undefined;
}) {
	const origin = region
		? displayedPoint({ x: region.x, y: region.y }, region, size)
		: { x: 0, y: 0 };
	const offsetX = origin.x - (region?.x ?? 0);
	const offsetY = origin.y - (region?.y ?? 0);
	return (
		<svg
			aria-label={`${label} spatial overlay`}
			className="pointer-events-none absolute inset-0"
			height={size.height * zoom}
			role="img"
			viewBox={`0 0 ${size.width} ${size.height}`}
			width={size.width * zoom}
		>
			{region && metadata ? (
				<svg
					height={region.height}
					viewBox={`${region.x} ${region.y} ${region.width} ${region.height}`}
					width={region.width}
					x={offsetX + region.x}
					y={offsetY + region.y}
				>
					<title>Frame spatial marks</title>
					{(["pivot", "ground_point", "mount_points"] as const).flatMap((id) =>
						points(spatialField(metadata, id)?.value).map((point) => (
							<g
								aria-label={id}
								key={`${id}-${point.key}`}
								stroke={
									{
										pivot: "yellow",
										ground_point: "cyan",
										mount_points: "magenta",
									}[id]
								}
								strokeWidth={1 / zoom}
							>
								<path
									d={`M ${point.x - 3 / zoom} ${point.y} h ${6 / zoom} M ${point.x} ${point.y - 3 / zoom} v ${6 / zoom}`}
								/>
							</g>
						))
					)}
					{(() => {
						const value = spatialField(metadata, "collision_areas")?.value;
						return (Array.isArray(value) ? value : [value]).flatMap((area) =>
							area &&
							typeof area === "object" &&
							"x" in area &&
							"y" in area &&
							"width" in area &&
							"height" in area &&
							typeof area.x === "number" &&
							typeof area.y === "number" &&
							typeof area.width === "number" &&
							typeof area.height === "number" &&
							area.width > 0 &&
							area.height > 0
								? [
										<rect
											aria-label="collision_areas"
											fill="none"
											height={area.height}
											key={`${area.x}-${area.y}-${area.width}-${area.height}`}
											stroke="lime"
											strokeWidth={1 / zoom}
											width={area.width}
											x={area.x}
											y={area.y}
										/>,
									]
								: []
						);
					})()}
				</svg>
			) : null}
		</svg>
	);
}

export function AnimationTimingClipPreview({
	elapsedMs,
	frames,
	gameplayMetadataRecords,
	gameplayMetadataStatus,
	projectId,
	contractRevisionId,
	label,
	looping,
	onStatus,
	statusKey,
	versions,
	zoom,
}: {
	elapsedMs: number;
	gameplayMetadataRecords: GameplayMetadataRecord[];
	gameplayMetadataStatus: AnimationTimingMetadataStatus;
	projectId: string;
	contractRevisionId: string;
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
	const [loopDifference, setLoopDifference] = useState<number | null>(null);
	const [size, setSize] = useState({ width: 1, height: 1 });
	usePreviewImages(frames, versions, onStatus, statusKey, setImages, setError);

	const frameIndex = getFrameIndex(frames, elapsedMs, looping);
	useDrawPreview(
		canvas,
		images,
		frames,
		frameIndex,
		looping,
		onStatus,
		statusKey,
		setSize,
		setError
	);

	useLoopDifference(frames, images, looping, size, setLoopDifference);
	const currentFrame = frames[frameIndex];
	const recordFor = (frame: AnimationTimingReviewFrame | undefined) =>
		findMetadata(gameplayMetadataRecords, projectId, contractRevisionId, frame);
	const metadata = recordFor(currentFrame);
	const currentImage = images[frameIndex];
	const region =
		currentImage && currentFrame ? getRegion(currentImage, currentFrame) : null;
	const groundDelta = getGroundDelta(
		frames,
		images,
		size,
		gameplayMetadataStatus,
		recordFor
	);
	const atLoopBoundary =
		looping &&
		frames.length > 1 &&
		(frameIndex === 0 || frameIndex === frames.length - 1);
	return (
		<figure className="min-w-0 space-y-2">
			<figcaption>
				{label} · Frame {frameIndex + 1}
				{currentFrame ? ` · ${currentFrame.frameKey || "No frame ID"}` : ""}
				{currentFrame ? ` · ${currentFrame.durationMs} ms` : ""}
				{currentFrame?.motionPhase ? ` · ${currentFrame.motionPhase}` : ""}
			</figcaption>
			<div
				className="overflow-auto border bg-muted p-2"
				style={{ maxHeight: 420 }}
			>
				<div
					className="relative w-fit"
					style={{ width: size.width * zoom, height: size.height * zoom }}
				>
					<canvas
						aria-label={`${label} pixel preview`}
						ref={canvas}
						role="img"
						style={{
							width: size.width * zoom,
							height: size.height * zoom,
							imageRendering: "pixelated",
						}}
					/>
					<SpatialOverlay
						label={label}
						metadata={gameplayMetadataStatus === "ready" ? metadata : undefined}
						region={region}
						size={size}
						zoom={zoom}
					/>
				</div>
			</div>
			<p>
				Ground comparison (first → last):{" "}
				{groundDelta === null
					? "Ground metadata unavailable (source-pixel metadata and loaded frames required)"
					: `${groundDelta} px in displayed frame coordinates`}
				. Tolerance is not declared; human review required.
			</p>
			<FrameMetadata
				label={label}
				metadata={metadata}
				status={gameplayMetadataStatus}
			/>
			{looping && frames.length > 1 ? (
				<p>
					Loop comparison (last → first):{" "}
					{loopDifference === null
						? "Pixel comparison unavailable (images or matching frame dimensions required)"
						: `${loopDifference} differing pixels`}
					. Tolerance is not declared; human review required.
					{atLoopBoundary ? " Loop boundary." : ""}
				</p>
			) : null}
			{error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
		</figure>
	);
}
