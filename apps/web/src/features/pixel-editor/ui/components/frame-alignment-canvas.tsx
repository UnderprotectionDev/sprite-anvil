import type { SheetStructureView } from "@sprite-anvil/api/pixel-editor-structure";
import { Label } from "@sprite-anvil/ui/components/label";
import { Slider } from "@sprite-anvil/ui/components/slider";
import { useEffect, useRef, useState } from "react";
import { useLoadedImage } from "../../hooks/use-loaded-image";
import { frameImageUrl } from "../../lib/frame-structure-api";

const zoom = 8;

type Frame = SheetStructureView["frames"][number];

function drawPivot(
	context: CanvasRenderingContext2D,
	frame: Frame,
	shape: "cross" | "ring" | "square",
	color: string
) {
	const x = frame.pivotX * zoom;
	const y = frame.pivotY * zoom;
	context.strokeStyle = color;
	context.lineWidth = 2;
	context.beginPath();
	if (shape === "cross") {
		context.moveTo(x - 6, y);
		context.lineTo(x + 6, y);
		context.moveTo(x, y - 6);
		context.lineTo(x, y + 6);
	} else if (shape === "ring") {
		context.arc(x, y, 5, 0, Math.PI * 2);
	} else {
		context.rect(x - 5, y - 5, 10, 10);
	}
	context.stroke();
}

/**
 * Onion skin (previous and next frame at adjustable opacity), ground line and
 * pivot comparison. These are overlays on a canvas; nothing is written into pixels.
 * Pivots differ by shape as well as colour.
 */
export function FrameAlignmentCanvas({
	frame,
	previous,
	next,
	view,
}: {
	frame: Frame;
	next: Frame | null;
	previous: Frame | null;
	view: SheetStructureView;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [onion, setOnion] = useState(40);
	const current = useLoadedImage(frameImageUrl(view, frame));
	const before = useLoadedImage(
		previous ? frameImageUrl(view, previous) : null
	);
	const after = useLoadedImage(next ? frameImageUrl(view, next) : null);
	const width = view.slicing.cellWidth * zoom;
	const height = view.slicing.cellHeight * zoom;

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		if (!(canvas && context)) {
			return;
		}
		context.imageSmoothingEnabled = false;
		context.clearRect(0, 0, width, height);
		context.fillStyle = "#1c1c1c";
		context.fillRect(0, 0, width, height);
		const layers: [HTMLImageElement | null, number][] = [
			[previous ? before.image : null, onion / 100],
			[next ? after.image : null, onion / 100],
			[current.image, 1],
		];
		for (const [image, alpha] of layers) {
			if (image) {
				context.globalAlpha = alpha;
				context.drawImage(image, 0, 0, width, height);
			}
		}
		context.globalAlpha = 1;
		// Ground line at the current frame's pivot height.
		context.setLineDash([6, 4]);
		context.strokeStyle = "#7dd3fc";
		context.lineWidth = 1;
		context.beginPath();
		context.moveTo(0, frame.pivotY * zoom);
		context.lineTo(width, frame.pivotY * zoom);
		context.stroke();
		context.setLineDash([]);
		if (previous) {
			drawPivot(context, previous, "square", "#f97316");
		}
		if (next) {
			drawPivot(context, next, "ring", "#a3e635");
		}
		drawPivot(context, frame, "cross", "#ffffff");
	}, [
		after.image,
		before.image,
		current.image,
		frame,
		height,
		next,
		onion,
		previous,
		width,
	]);

	return (
		<section aria-label="Frame alignment" className="space-y-2">
			<h3 className="font-medium text-sm">Alignment: onion skin and pivots</h3>
			<Label className="flex w-72 items-center gap-2 text-xs">
				<span className="shrink-0">Onion skin opacity</span>
				<Slider
					className="min-w-24 flex-1"
					getAriaLabel={() => "Onion skin opacity"}
					max={80}
					min={0}
					onValueChange={(value) =>
						setOnion(Array.isArray(value) ? (value[0] ?? 0) : value)
					}
					step={10}
					value={[onion]}
				/>
				<span>{onion}%</span>
			</Label>
			<canvas
				aria-label={`Frame ${frame.index + 1} aligned with its previous and next frames`}
				className="rounded-md border [image-rendering:pixelated]"
				height={height}
				ref={canvasRef}
				role="img"
				width={width}
			/>
			<ul className="space-y-0.5 text-muted-foreground text-xs">
				<li>
					Dashed line: ground line at this frame's pivot height ({frame.pivotY}{" "}
					px).
				</li>
				<li>
					Cross: this frame's pivot ({frame.pivotX}, {frame.pivotY}).
				</li>
				<li>
					Square: previous frame pivot
					{previous ? ` (${previous.pivotX}, ${previous.pivotY})` : " (none)"}.
				</li>
				<li>
					Ring: next frame pivot
					{next ? ` (${next.pivotX}, ${next.pivotY})` : " (none)"}.
				</li>
			</ul>
		</section>
	);
}
