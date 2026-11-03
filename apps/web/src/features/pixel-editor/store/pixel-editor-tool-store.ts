import type { PixelRect } from "@sprite-anvil/api/pixel-editor";
import { createStore } from "@tanstack/store";

export const pixelTools = [
	"pen",
	"eraser",
	"picker",
	"line",
	"fill",
	"select",
	"move",
	"crop",
] as const;
export type PixelTool = (typeof pixelTools)[number];

export const transparencyBackgrounds = [
	"checker",
	"light",
	"dark",
	"contrast",
] as const;
export type TransparencyBackground = (typeof transparencyBackgrounds)[number];

export const compareModes = [
	"draft",
	"source",
	"side-by-side",
	"overlay",
	"transition",
] as const;
export type CompareMode = (typeof compareModes)[number];

export interface PixelEditorToolState {
	background: TransparencyBackground;
	brushSize: number;
	color: string;
	compareMode: CompareMode;
	contrastColor: string;
	previewScale: number;
	selection: PixelRect | null;
	showGrid: boolean;
	tool: PixelTool;
	zoom: number;
}

export function createPixelEditorToolStore() {
	return createStore<PixelEditorToolState>({
		background: "checker",
		brushSize: 1,
		color: "#000000ff",
		compareMode: "draft",
		contrastColor: "#ff00ffff",
		previewScale: 1,
		selection: null,
		showGrid: true,
		tool: "pen",
		zoom: 16,
	});
}

export type PixelEditorToolStore = ReturnType<
	typeof createPixelEditorToolStore
>;

export function patchToolState(
	store: PixelEditorToolStore,
	patch: Partial<PixelEditorToolState>
) {
	store.setState((state) => ({ ...state, ...patch }));
}
