import type { PixelRect } from "@sprite-anvil/api/pixel-editor";
import type { TransparencyBackground } from "../store/pixel-editor-tool-store";
import { hexToCss } from "./pixel-geometry";

const checkerCell = 8;

/** Fills the canvas with a flat transparency backdrop; no gradients or smoothing. */
export function drawBackground(
	context: CanvasRenderingContext2D,
	width: number,
	height: number,
	background: TransparencyBackground,
	contrastColor: string
) {
	if (background === "checker") {
		for (let y = 0; y < height; y += checkerCell) {
			for (let x = 0; x < width; x += checkerCell) {
				const odd = (x / checkerCell + y / checkerCell) % 2 === 1;
				context.fillStyle = odd ? "#9a9a9a" : "#c8c8c8";
				context.fillRect(x, y, checkerCell, checkerCell);
			}
		}
		return;
	}
	const fills = { light: "#f2f2f2", dark: "#161616" } as const;
	context.fillStyle =
		background === "contrast" ? hexToCss(contrastColor) : fills[background];
	context.fillRect(0, 0, width, height);
}

export function drawImageCrisp(
	context: CanvasRenderingContext2D,
	image: CanvasImageSource,
	x: number,
	y: number,
	width: number,
	height: number
) {
	context.imageSmoothingEnabled = false;
	context.drawImage(image, x, y, width, height);
}

export function strokeRect(
	context: CanvasRenderingContext2D,
	rect: PixelRect,
	zoom: number,
	color: string
) {
	context.lineWidth = 2;
	context.setLineDash([6, 4]);
	context.strokeStyle = color;
	context.strokeRect(
		rect.x * zoom + 1,
		rect.y * zoom + 1,
		rect.width * zoom - 2,
		rect.height * zoom - 2
	);
	context.setLineDash([]);
}
