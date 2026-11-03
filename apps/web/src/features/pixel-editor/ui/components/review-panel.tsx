import type { PixelDraft } from "@sprite-anvil/api/pixel-editor";
import { Badge } from "@sprite-anvil/ui/components/badge";
import { Button } from "@sprite-anvil/ui/components/button";
import { useState } from "react";
import { ReplaceColorForm } from "../forms/replace-color-form";
import { ColorSwatch } from "./color-swatch";

export function ReviewPanel({
	disabled,
	draft,
	onPickColor,
	onReplaceColor,
	projectId,
}: {
	disabled: boolean;
	draft: PixelDraft;
	onPickColor: (color: string) => void;
	onReplaceColor: (values: { from: string; to: string }) => void;
	projectId: string;
}) {
	const [replaceFrom, setReplaceFrom] = useState<string | null>(null);
	const { diff } = draft;
	const outOfPalette = new Set(
		draft.outOfPaletteColors.map((usage) => usage.color)
	);
	const replaceSource =
		replaceFrom ??
		draft.outOfPaletteColors[0]?.color ??
		draft.usedColors[0]?.color ??
		null;

	return (
		<div className="space-y-5">
			<section aria-label="Difference from the source" className="space-y-1">
				<h3 className="font-medium text-sm">Source and draft difference</h3>
				<p className="text-sm">
					{diff.changedPixelCount} changed pixels
					{diff.sizeChanged ? " (canvas size changed)" : ""}
				</p>
				<p className="text-muted-foreground text-xs">
					{diff.boundingBox
						? `Bounding box ${diff.boundingBox.width}×${diff.boundingBox.height} at ${diff.boundingBox.x}, ${diff.boundingBox.y}`
						: "No pixels differ from the source."}
				</p>
			</section>

			<section aria-label="Palette" className="space-y-2">
				<h3 className="font-medium text-sm">Colours in use</h3>
				<p className="text-muted-foreground text-xs">
					No project palette record exists yet, so the palette is the set of
					colours in the source image.
				</p>
				{draft.outOfPaletteColors.length > 0 ? (
					<p className="font-medium text-destructive text-sm" role="status">
						{draft.outOfPaletteColors.length} out-of-palette{" "}
						{draft.outOfPaletteColors.length === 1 ? "colour" : "colours"} ·{" "}
						{draft.outOfPaletteColors.reduce(
							(total, usage) => total + usage.pixelCount,
							0
						)}{" "}
						pixels
					</p>
				) : (
					<p className="text-sm" role="status">
						Every colour is in the palette.
					</p>
				)}
				<ul className="space-y-1">
					{draft.usedColors.map((usage) => (
						<li className="flex items-center gap-2 text-sm" key={usage.color}>
							<Button
								aria-label={`Use colour ${usage.color}`}
								className="size-6 p-0"
								onClick={() => onPickColor(usage.color)}
								size="icon-sm"
								type="button"
								variant="outline"
							>
								<ColorSwatch color={usage.color} />
							</Button>
							<span className="font-mono text-xs">{usage.color}</span>
							<span className="text-muted-foreground text-xs">
								{usage.pixelCount} px
							</span>
							{outOfPalette.has(usage.color) ? (
								<>
									<Badge variant="destructive">Out of palette</Badge>
									<Button
										onClick={() => setReplaceFrom(usage.color)}
										size="xs"
										type="button"
										variant="ghost"
									>
										Replace…
									</Button>
								</>
							) : null}
						</li>
					))}
				</ul>
			</section>

			{replaceSource ? (
				<ReplaceColorForm
					disabled={disabled}
					draft={draft}
					initialFrom={replaceSource}
					key={`${replaceSource}:${draft.revision}`}
					onApply={onReplaceColor}
					projectId={projectId}
				/>
			) : null}
		</div>
	);
}
