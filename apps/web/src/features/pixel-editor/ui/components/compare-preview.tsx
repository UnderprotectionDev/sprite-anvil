import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useStore } from "@tanstack/react-store";
import { useEffect, useRef } from "react";
import { drawBackground, drawImageCrisp } from "../../lib/canvas-drawing";
import { opaqueHex } from "../../lib/pixel-geometry";
import {
	type PixelEditorToolStore,
	patchToolState,
	type TransparencyBackground,
	transparencyBackgrounds,
} from "../../store/pixel-editor-tool-store";

const backgroundLabels: Record<TransparencyBackground, string> = {
	checker: "Checker",
	light: "Light",
	dark: "Dark",
	contrast: "Contrast colour",
};

const previewScales = [1, 2, 3, 4];

/** Real-size preview, separate from editing zoom, over a chosen transparency backdrop. */
export function ComparePreview({
	draftImage,
	size,
	sourceImage,
	store,
}: {
	draftImage: HTMLImageElement | null;
	size: { height: number; width: number };
	sourceImage: HTMLImageElement | null;
	store: PixelEditorToolStore;
}) {
	const state = useStore(store, (current) => current);
	const scale = state.previewScale;
	return (
		<section aria-label="Real-size preview" className="space-y-3">
			<h3 className="font-medium text-sm">Real-size preview</h3>
			<div className="flex flex-wrap gap-1">
				{previewScales.map((value) => (
					<Button
						aria-pressed={scale === value}
						key={value}
						onClick={() => patchToolState(store, { previewScale: value })}
						size="xs"
						type="button"
						variant={scale === value ? "default" : "outline"}
					>
						{value}×
					</Button>
				))}
			</div>
			<fieldset className="space-y-1">
				<legend className="text-xs">Transparency background</legend>
				<div className="flex flex-wrap gap-1">
					{transparencyBackgrounds.map((background) => (
						<Button
							aria-pressed={state.background === background}
							key={background}
							onClick={() => patchToolState(store, { background })}
							size="xs"
							type="button"
							variant={state.background === background ? "default" : "outline"}
						>
							{backgroundLabels[background]}
						</Button>
					))}
				</div>
				{state.background === "contrast" ? (
					<Label className="flex items-center gap-2 text-xs" htmlFor="contrast">
						<span>Contrast colour</span>
						<Input
							className="h-8 w-12 p-0.5"
							id="contrast"
							onChange={(event) =>
								patchToolState(store, {
									contrastColor: opaqueHex(event.target.value),
								})
							}
							type="color"
							value={state.contrastColor.slice(0, 7)}
						/>
					</Label>
				) : null}
			</fieldset>
			<div className="flex flex-wrap items-start gap-3">
				<PreviewSurface
					background={state.background}
					contrastColor={state.contrastColor}
					image={draftImage}
					label="Working Draft at real size"
					scale={scale}
					size={size}
				/>
				{sourceImage ? (
					<PreviewSurface
						background={state.background}
						contrastColor={state.contrastColor}
						image={sourceImage}
						label="Source at real size"
						scale={scale}
						size={{
							width: sourceImage.naturalWidth,
							height: sourceImage.naturalHeight,
						}}
					/>
				) : null}
			</div>
		</section>
	);
}

function PreviewSurface({
	background,
	contrastColor,
	image,
	label,
	scale,
	size,
}: {
	background: TransparencyBackground;
	contrastColor: string;
	image: HTMLImageElement | null;
	label: string;
	scale: number;
	size: { height: number; width: number };
}) {
	const ref = useRef<HTMLCanvasElement>(null);
	const width = size.width * scale;
	const height = size.height * scale;
	useEffect(() => {
		const context = ref.current?.getContext("2d");
		if (!context) {
			return;
		}
		context.clearRect(0, 0, width, height);
		drawBackground(context, width, height, background, contrastColor);
		if (image) {
			drawImageCrisp(context, image, 0, 0, width, height);
		}
	}, [background, contrastColor, height, image, width]);
	return (
		<figure className="space-y-1">
			<canvas
				aria-label={label}
				className="max-w-none border"
				height={height}
				ref={ref}
				role="img"
				width={width}
			/>
			<figcaption className="text-muted-foreground text-xs">
				{label.replace(" at real size", "")} · {size.width}×{size.height}
			</figcaption>
		</figure>
	);
}
