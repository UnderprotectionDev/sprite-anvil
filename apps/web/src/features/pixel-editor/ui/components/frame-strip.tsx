import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	horizontalListSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
	FrameKey,
	FrameOperation,
	SheetFrameView,
	SheetStructureView,
} from "@sprite-anvil/api/pixel-editor-structure";
import { Badge } from "@sprite-anvil/ui/components/badge";
import { Button } from "@sprite-anvil/ui/components/button";
import { frameImageUrl } from "../../lib/frame-structure-api";

const statusLabels: Record<SheetFrameView["status"], string> = {
	new: "New",
	changed: "Changed",
	pinned: "Pinned",
};

function FrameItem({
	disabled,
	frame,
	onSelect,
	selected,
	view,
}: {
	disabled: boolean;
	frame: SheetFrameView;
	onSelect: (key: string) => void;
	selected: boolean;
	view: SheetStructureView;
}) {
	const sortable = useSortable({
		id: frame.key,
		disabled: disabled || frame.keep,
	});
	return (
		<li
			className="shrink-0"
			ref={sortable.setNodeRef}
			style={{
				transform: CSS.Transform.toString(sortable.transform),
				transition: sortable.transition,
			}}
		>
			{/* conventions-exception: raw-control the sortable frame card is the dnd-kit activator and needs the native button element for pointer and keyboard dragging */}
			<button
				{...sortable.attributes}
				{...sortable.listeners}
				aria-label={`Frame ${frame.index + 1}${frame.keep ? ", protected" : ""}. Press space to pick up and the arrow keys to reorder.`}
				aria-pressed={selected}
				className={`flex w-28 flex-col items-center gap-1 rounded-md border p-2 text-xs ${selected ? "border-primary bg-primary/10" : "bg-background"}`}
				onClick={() => onSelect(frame.key)}
				ref={sortable.setActivatorNodeRef}
				type="button"
			>
				<img
					alt=""
					className="h-16 w-16 bg-muted object-contain [image-rendering:pixelated]"
					height={64}
					src={frameImageUrl(view, frame)}
					width={64}
				/>
				<span className="font-medium">#{frame.index + 1}</span>
				<span>{frame.durationMs} ms</span>
				<span className="flex flex-wrap justify-center gap-1">
					<Badge variant={frame.status === "pinned" ? "outline" : "secondary"}>
						{statusLabels[frame.status]}
					</Badge>
					{frame.keep ? <Badge variant="default">Keep</Badge> : null}
				</span>
			</button>
		</li>
	);
}

/** Bottom frame strip: select, drag-reorder (pointer or keyboard), add, duplicate, delete. */
export function FrameStrip({
	disabled,
	onEdit,
	onSelect,
	selectedKey,
	view,
}: {
	disabled: boolean;
	onEdit: (operation: FrameOperation) => void;
	onSelect: (key: string) => void;
	selectedKey: string | null;
	view: SheetStructureView;
}) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);
	const selected = view.frames.find((frame) => frame.key === selectedKey);

	function onDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over || active.id === over.id) {
			return;
		}
		const target = view.frames.find((frame) => frame.key === over.id);
		if (target) {
			onEdit({
				type: "reorder",
				frameKey: String(active.id) as FrameKey,
				toIndex: target.index,
			});
		}
	}

	return (
		<section aria-label="Frame strip" className="space-y-2">
			<div className="flex flex-wrap items-center gap-2">
				<h3 className="font-medium text-sm">Frames</h3>
				<Button
					disabled={disabled}
					onClick={() => onEdit({ type: "add-blank" })}
					size="xs"
					type="button"
					variant="outline"
				>
					Add blank frame
				</Button>
				<Button
					disabled={disabled || !selected}
					onClick={() =>
						selected && onEdit({ type: "duplicate", frameKey: selected.key })
					}
					size="xs"
					type="button"
					variant="outline"
				>
					Duplicate
				</Button>
				<Button
					disabled={disabled || !selected}
					onClick={() =>
						selected && onEdit({ type: "delete", frameKey: selected.key })
					}
					size="xs"
					type="button"
					variant="outline"
				>
					Delete
				</Button>
			</div>
			<DndContext
				collisionDetection={closestCenter}
				onDragEnd={onDragEnd}
				sensors={sensors}
			>
				<SortableContext
					items={view.frames.map((frame) => frame.key)}
					strategy={horizontalListSortingStrategy}
				>
					<ol className="flex gap-2 overflow-x-auto pb-2">
						{view.frames.map((frame) => (
							<FrameItem
								disabled={disabled}
								frame={frame}
								key={frame.key}
								onSelect={onSelect}
								selected={frame.key === selectedKey}
								view={view}
							/>
						))}
					</ol>
				</SortableContext>
			</DndContext>
		</section>
	);
}
