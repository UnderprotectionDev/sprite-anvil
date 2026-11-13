import type { PixelDraft } from "@sprite-anvil/api/pixel-editor";
import type {
	SheetSlicing,
	SheetSlicingPreview,
} from "@sprite-anvil/api/pixel-editor-structure";
import { useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { useFrameStructure } from "../../hooks/use-frame-structure";
import { FrameEditor } from "../components/frame-editor";
import { SlicingPreviewCanvas } from "../components/slicing-preview-canvas";
import { SlicingForm } from "../forms/slicing-form";

function wholeSheetSlicing(size: {
	height: number;
	width: number;
}): SheetSlicing {
	return {
		cellWidth: size.width,
		cellHeight: size.height,
		columns: 1,
		rows: 1,
		offsetX: 0,
		offsetY: 0,
		gapX: 0,
		gapY: 0,
		readingOrder: "rows-left-to-right",
	};
}

/** Frame and sprite sheet structure editing for a Working Draft. */
export function FrameStructurePanel({
	disabled,
	draft,
	projectId,
	sheetImage,
}: {
	disabled: boolean;
	draft: PixelDraft;
	projectId: string;
	sheetImage: HTMLImageElement | null;
}) {
	const frames = useFrameStructure(projectId, draft.id, draft.revision);
	const [previewed, setPreviewed] = useState<SheetSlicingPreview | null>(null);
	const { structure } = frames;
	const busy = disabled || frames.isBusy;

	if (frames.structureQuery.isPending) {
		return <p role="status">Loading the frame structure…</p>;
	}
	if (!(structure || frames.hasNoStructure)) {
		return (
			<StatusMessage tone="error">
				The frame structure could not be loaded.{" "}
				{frames.structureQuery.error instanceof Error
					? frames.structureQuery.error.message
					: ""}
			</StatusMessage>
		);
	}

	const initial = structure?.slicing ?? wholeSheetSlicing(draft.size);
	const cells = previewed?.cells ?? structure?.cells ?? [];

	return (
		<section aria-label="Frames and sprite sheet" className="space-y-4">
			<h2 className="font-semibold text-lg">Frames and sprite sheet</h2>
			<p className="text-muted-foreground text-sm">
				Slicing never changes the source Asset Version. Each frame becomes a
				Unit Version only when it changed; a new Composite Version pins them and
				the previous sheet stays untouched.
			</p>
			<div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
				<SlicingForm
					disabled={busy}
					initial={initial}
					key={JSON.stringify(initial)}
					onApply={(slicing) => {
						setPreviewed(null);
						frames.slice.mutate(slicing);
					}}
					onPreview={(slicing) =>
						frames.preview.mutate(slicing, { onSuccess: setPreviewed })
					}
				/>
				<div className="max-h-[28rem] min-w-0 overflow-auto">
					<SlicingPreviewCanvas
						cells={cells}
						image={sheetImage}
						size={draft.size}
					/>
					{previewed ? (
						<p aria-live="polite" className="text-xs" role="status">
							Preview: {previewed.frameCount} cells. Not applied yet.
						</p>
					) : null}
				</div>
			</div>

			{structure ? (
				<FrameEditor
					busy={busy}
					onCommit={() => frames.commit.mutate()}
					onEdit={(operations) => frames.edit.mutate(operations)}
					structure={structure}
				/>
			) : (
				<p className="text-sm" role="status">
					This sheet has no frames yet. Preview a slicing and apply it to create
					them.
				</p>
			)}
		</section>
	);
}
