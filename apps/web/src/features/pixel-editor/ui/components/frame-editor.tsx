import type {
	FrameOperation,
	SheetStructureView,
} from "@sprite-anvil/api/pixel-editor-structure";
import { Button } from "@sprite-anvil/ui/components/button";
import { useState } from "react";
import { FrameSettingsForm } from "../forms/frame-settings-form";
import { FrameSourceForm } from "../forms/frame-source-form";
import { FrameAlignmentCanvas } from "./frame-alignment-canvas";
import { FrameStrip } from "./frame-strip";

/** Frame strip, selected-frame settings, alignment overlays and the pinning action. */
export function FrameEditor({
	busy,
	onCommit,
	onEdit,
	structure,
}: {
	busy: boolean;
	onCommit: () => void;
	onEdit: (operations: FrameOperation | FrameOperation[]) => void;
	structure: SheetStructureView;
}) {
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const selected =
		structure.frames.find((frame) => frame.key === selectedKey) ??
		structure.frames[0] ??
		null;
	const previous = selected ? structure.frames[selected.index - 1] : undefined;
	const next = selected ? structure.frames[selected.index + 1] : undefined;
	const nothingToPin =
		structure.affectedFrameKeys.length === 0 &&
		!structure.orderChanged &&
		structure.lastCommit !== null;

	return (
		<>
			<FrameStrip
				disabled={busy}
				onEdit={onEdit}
				onSelect={setSelectedKey}
				selectedKey={selected?.key ?? null}
				view={structure}
			/>
			{selected ? (
				<div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
					<div className="space-y-4">
						<FrameSettingsForm
							disabled={busy}
							frame={selected}
							key={`${selected.key}-${structure.draftRevision}`}
							onEdit={onEdit}
						/>
						<FrameSourceForm
							disabled={busy}
							onAdd={(assetVersionId) =>
								onEdit({ type: "add-from-asset-version", assetVersionId })
							}
							onReplace={(assetVersionId) =>
								onEdit({
									type: "replace",
									frameKey: selected.key,
									assetVersionId,
								})
							}
						/>
					</div>
					<FrameAlignmentCanvas
						frame={selected}
						next={next ?? null}
						previous={previous ?? null}
						view={structure}
					/>
				</div>
			) : null}
			<div className="flex flex-wrap items-center gap-3">
				<Button
					disabled={busy || nothingToPin}
					onClick={onCommit}
					type="button"
				>
					Pin frames in a new Composite Version
				</Button>
				<p aria-live="polite" className="text-sm" role="status">
					{structure.affectedFrameKeys.length} frame(s) will get a new Unit
					Version
					{structure.orderChanged ? "; the frame order changed" : ""}.
					{structure.lastCommit
						? ` Last Composite Version: ${structure.lastCommit.compositeVersionId}.`
						: ""}
				</p>
			</div>
		</>
	);
}
