import type { PixelEditorToolState } from "../store/pixel-editor-tool-store";
import { drawBackground, drawImageCrisp, strokeRect } from "./canvas-drawing";
import { type Cell, hexToCss, moveRect, rectFromCells } from "./pixel-geometry";

export interface CanvasScene {
	anchor: Cell | null;
	hover: Cell | null;
	image: HTMLImageElement | null;
	interactive: boolean;
	path: Cell[];
	size: { height: number; width: number };
	state: PixelEditorToolState;
}

function paintGrid(context: CanvasRenderingContext2D, scene: CanvasScene) {
	const { zoom } = scene.state;
	const width = scene.size.width * zoom;
	const height = scene.size.height * zoom;
	context.fillStyle = "rgba(127, 127, 127, 0.35)";
	for (let x = 1; x < scene.size.width; x += 1) {
		context.fillRect(x * zoom, 0, 1, height);
	}
	for (let y = 1; y < scene.size.height; y += 1) {
		context.fillRect(0, y * zoom, width, 1);
	}
}

function paintGesture(context: CanvasRenderingContext2D, scene: CanvasScene) {
	const { anchor, hover, path, state } = scene;
	const { zoom, tool } = state;
	if (path.length > 0 && tool !== "eraser") {
		context.fillStyle = hexToCss(state.color);
		for (const cell of path) {
			context.fillRect(
				cell.x * zoom,
				cell.y * zoom,
				state.brushSize * zoom,
				state.brushSize * zoom
			);
		}
	}
	if (!(anchor && hover)) {
		return;
	}
	if (tool === "line") {
		context.strokeStyle = hexToCss(state.color);
		context.lineWidth = Math.max(2, zoom / 4);
		context.beginPath();
		context.moveTo((anchor.x + 0.5) * zoom, (anchor.y + 0.5) * zoom);
		context.lineTo((hover.x + 0.5) * zoom, (hover.y + 0.5) * zoom);
		context.stroke();
	} else if (tool === "select" || tool === "crop") {
		strokeRect(context, rectFromCells(anchor, hover), zoom, "#ffd400");
	} else if (tool === "move" && state.selection) {
		strokeRect(
			context,
			moveRect(state.selection, hover.x - anchor.x, hover.y - anchor.y),
			zoom,
			"#ffd400"
		);
	}
}

/** Paints the image over its backdrop; overlays stay on the canvas, never in the image. */
export function paintScene(
	context: CanvasRenderingContext2D,
	scene: CanvasScene
) {
	const { state, size, image } = scene;
	const { zoom } = state;
	const width = size.width * zoom;
	const height = size.height * zoom;
	context.clearRect(0, 0, width, height);
	drawBackground(context, width, height, state.background, state.contrastColor);
	if (image) {
		drawImageCrisp(context, image, 0, 0, width, height);
	}
	if (state.showGrid && zoom >= 8) {
		paintGrid(context, scene);
	}
	if (!scene.interactive) {
		return;
	}
	if (state.selection) {
		strokeRect(context, state.selection, zoom, "#00e5ff");
	}
	paintGesture(context, scene);
	if (scene.hover) {
		strokeRect(
			context,
			{ ...scene.hover, width: 1, height: 1 },
			zoom,
			"#ffffff"
		);
	}
}
