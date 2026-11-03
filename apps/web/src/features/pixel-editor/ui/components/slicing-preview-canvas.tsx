import type { SheetCell } from "@sprite-anvil/api/pixel-editor-structure";
import { useEffect, useRef } from "react";

const maxWidth = 640;

/** Numbered cell boundaries over the sheet; an overlay only, the source is untouched. */
export function SlicingPreviewCanvas({
	cells,
	image,
	size,
}: {
	cells: SheetCell[];
	image: HTMLImageElement | null;
	size: { height: number; width: number };
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const scale = Math.max(1, Math.floor(maxWidth / size.width));

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		if (!(canvas && context)) {
			return;
		}
		context.imageSmoothingEnabled = false;
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.fillStyle = "#1c1c1c";
		context.fillRect(0, 0, canvas.width, canvas.height);
		if (image) {
			context.drawImage(image, 0, 0, canvas.width, canvas.height);
		}
		context.font = "12px monospace";
		for (const cell of cells) {
			context.strokeStyle = "#facc15";
			context.lineWidth = 1;
			context.strokeRect(
				cell.x * scale + 0.5,
				cell.y * scale + 0.5,
				cell.width * scale - 1,
				cell.height * scale - 1
			);
			const label = String(cell.index + 1);
			context.fillStyle = "#000000";
			context.fillRect(
				cell.x * scale + 1,
				cell.y * scale + 1,
				8 + label.length * 7,
				15
			);
			context.fillStyle = "#facc15";
			context.fillText(label, cell.x * scale + 4, cell.y * scale + 13);
		}
	}, [cells, image, scale]);

	return (
		<canvas
			aria-label={`Sprite sheet with ${cells.length} numbered cells`}
			className="max-w-full rounded-md border [image-rendering:pixelated]"
			height={size.height * scale}
			ref={canvasRef}
			role="img"
			width={size.width * scale}
		/>
	);
}
