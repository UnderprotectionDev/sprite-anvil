import type {
	PixelDraft,
	PixelOperation,
} from "@sprite-anvil/api/pixel-editor";
import type {
	CompareMode,
	PixelEditorToolStore,
} from "../../store/pixel-editor-tool-store";
import { PixelCanvas } from "./pixel-canvas";

function overlayNotice(diff: PixelDraft["diff"]) {
	if (diff.sizeChanged) {
		return "Overlay: the canvas size changed, so the source cannot be aligned. Use side by side.";
	}
	const box = diff.boundingBox;
	const outline = box
		? `, outlined by a dashed box ${box.width}×${box.height} at ${box.x}, ${box.y}`
		: "; nothing to outline";
	return `Overlay: source shown dimmed under the draft. ${diff.changedPixelCount} changed pixels${outline}.`;
}

/** The editable Working Draft canvas and, by compare mode, the Source beside or beneath it. */
export function CompareStage({
	disabled,
	draft,
	draftImage,
	mode,
	onOperation,
	sourceImage,
	store,
}: {
	disabled: boolean;
	draft: PixelDraft;
	draftImage: HTMLImageElement | null;
	mode: CompareMode;
	onOperation: (operation: PixelOperation) => void;
	sourceImage: HTMLImageElement | null;
	store: PixelEditorToolStore;
}) {
	const overlay = mode === "overlay";
	const showSource = mode === "source" || mode === "side-by-side";
	return (
		<>
			<div className="flex max-h-[70vh] flex-wrap items-start gap-4 overflow-auto rounded-md border bg-muted/30 p-3">
				{mode === "source" ? null : (
					<PixelCanvas
						changedBox={overlay ? draft.diff.boundingBox : null}
						disabled={disabled}
						image={draftImage}
						interactive
						label={
							overlay
								? "Working Draft over Source pixel canvas"
								: "Working Draft pixel canvas"
						}
						onOperation={onOperation}
						size={draft.size}
						store={store}
						underlay={overlay && !draft.diff.sizeChanged ? sourceImage : null}
					/>
				)}
				{showSource && sourceImage ? (
					<PixelCanvas
						disabled
						image={sourceImage}
						interactive={false}
						label="Source Asset Version"
						onOperation={() => undefined}
						size={draft.sourceSize}
						store={store}
					/>
				) : null}
			</div>
			{overlay ? (
				<p className="text-sm" role="status">
					{overlayNotice(draft.diff)}
				</p>
			) : null}
		</>
	);
}
