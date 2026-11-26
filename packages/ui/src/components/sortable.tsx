"use client";

import type {
	Announcements,
	DragEndEvent,
	ScreenReaderInstructions,
	UniqueIdentifier,
} from "@dnd-kit/core";
import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@sprite-anvil/ui/lib/utils";
import * as React from "react";

// Paper · 01 Components · 06 Extra primitives · Sortable. A Required Set order:
// 52px rows (flat #2A2A2A, radius 8, 1px #3A3A3A ring) with a 44px grip slot.
// The lifted row turns raised (control face, 1px top light, 3px bottom edge),
// gains a 2px focus-blue ring with a 2px ground gap and a drop shadow, sets its
// label in 600 and prints a Moving label. Space or Enter lifts, arrows move,
// Space or Enter drops, Escape cancels; every move is announced.

/** An item id: a string or number unique within one list or board. */
export type SortableId = UniqueIdentifier;

export const sortableScreenReaderInstructions: ScreenReaderInstructions = {
	draggable:
		"To pick up an item, press Space or Enter. Use the arrow keys to move it. Press Space or Enter again to drop it in its new position, or press Escape to cancel.",
};

/** Raised lifted face shared by Sortable rows and Kanban cards. */
export const LIFTED_SURFACE =
	"bg-workbench-control pb-[3px] shadow-[inset_0_1px_0_var(--color-workbench-raised-light),inset_0_-3px_0_var(--color-pixel-utility-low),0_0_0_2px_var(--color-workbench-background),0_0_0_4px_var(--color-workbench-focus),0_8px_24px_var(--color-workbench-drop-shadow)]";

interface SortableContextValue {
	activeId: UniqueIdentifier | null;
	movingLabel: string;
}

const SortableStateContext = React.createContext<SortableContextValue>({
	activeId: null,
	movingLabel: "Moving",
});

type SortableProps = Omit<React.ComponentProps<"ul">, "onChange"> & {
	/** Item ids in their current order. */
	value: UniqueIdentifier[];
	onValueChange: (value: UniqueIdentifier[]) => void;
	/** Human name of an item for live-region announcements; defaults to its id. */
	getItemLabel?: (id: UniqueIdentifier) => string;
	/** Text printed on the lifted row. */
	movingLabel?: string;
};

function Sortable({
	value,
	onValueChange,
	getItemLabel = String,
	movingLabel = "Moving",
	className,
	children,
	...props
}: SortableProps) {
	const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const position = (id: UniqueIdentifier) =>
		`position ${value.indexOf(id) + 1} of ${value.length}`;

	// dnd-kit reports the lifted row as "over" itself right after pick-up; the
	// last announced target keeps that from replacing the pick-up message.
	const lastOverId = React.useRef<UniqueIdentifier | null>(null);

	const announcements: Announcements = {
		onDragStart: ({ active }) => {
			lastOverId.current = active.id;
			return `Picked up ${getItemLabel(active.id)}. It is in ${position(active.id)}.`;
		},
		onDragOver: ({ active, over }) => {
			if ((over?.id ?? null) === lastOverId.current) {
				return;
			}
			lastOverId.current = over?.id ?? null;
			return over
				? `${getItemLabel(active.id)} moved to ${position(over.id)}.`
				: `${getItemLabel(active.id)} is no longer over the list.`;
		},
		onDragEnd: ({ active, over }) =>
			over
				? `${getItemLabel(active.id)} dropped at ${position(over.id)}.`
				: `${getItemLabel(active.id)} dropped.`,
		onDragCancel: ({ active }) =>
			`Moving cancelled. ${getItemLabel(active.id)} returned to ${position(active.id)}.`,
	};

	const handleDragEnd = ({ active, over }: DragEndEvent) => {
		setActiveId(null);
		if (!over || active.id === over.id) {
			return;
		}
		onValueChange(
			arrayMove(value, value.indexOf(active.id), value.indexOf(over.id))
		);
	};

	const state = React.useMemo(
		() => ({ activeId, movingLabel }),
		[activeId, movingLabel]
	);

	return (
		<DndContext
			accessibility={{
				announcements,
				screenReaderInstructions: sortableScreenReaderInstructions,
			}}
			collisionDetection={closestCenter}
			onDragCancel={() => setActiveId(null)}
			onDragEnd={handleDragEnd}
			onDragStart={({ active }) => setActiveId(active.id)}
			sensors={sensors}
		>
			<SortableContext items={value} strategy={verticalListSortingStrategy}>
				<SortableStateContext.Provider value={state}>
					<ul
						className={cn("flex flex-col gap-2", className)}
						data-slot="sortable"
						{...props}
					>
						{children}
					</ul>
				</SortableStateContext.Provider>
			</SortableContext>
		</DndContext>
	);
}

type SortableItemProps = Omit<React.ComponentProps<"li">, "id"> & {
	value: UniqueIdentifier;
	disabled?: boolean;
};

/** One row. The whole row is the drag activator (role button, roledescription sortable). */
function SortableItem({
	value,
	disabled,
	className,
	style,
	children,
	...props
}: SortableItemProps) {
	const { movingLabel } = React.useContext(SortableStateContext);
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: value, disabled });

	return (
		<li
			className={cn(
				"group/sortable-item rounded-control text-body text-workbench-text relative flex h-13 shrink-0 cursor-grab items-center leading-5 outline-0 select-none",
				"bg-pixel-utility-low shadow-[inset_0_0_0_1px_var(--color-workbench-panel-hover)]",
				"not-data-dragging:focus-visible:focus-ring",
				"data-dragging:z-10 data-dragging:cursor-grabbing data-dragging:font-semibold",
				isDragging && LIFTED_SURFACE,
				"aria-disabled:text-workbench-utility-disabled-text aria-disabled:cursor-default",
				className
			)}
			data-dragging={isDragging ? "" : undefined}
			data-slot="sortable-item"
			ref={setNodeRef}
			style={{
				...style,
				transform: CSS.Translate.toString(transform),
				transition,
			}}
			{...attributes}
			{...listeners}
			{...props}
		>
			{children}
			{isDragging ? (
				<span
					className="text-label text-workbench-info-soft ml-auto pr-4 leading-4 font-semibold"
					data-slot="sortable-item-moving"
				>
					{movingLabel}
				</span>
			) : null}
		</li>
	);
}

/** The 44px grip slot. Decorative: the row itself carries the drag semantics. */
function SortableItemHandle({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"text-workbench-faint-text group-data-dragging/sortable-item:text-workbench-text flex w-11 shrink-0 items-center justify-center",
				className
			)}
			data-slot="sortable-item-handle"
			{...props}
		>
			<GripIcon />
		</span>
	);
}

/** Six-dot grip, Paper's 16px glyph (r 1.6 dots on a 24 grid). */
function GripIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={cn("size-4 shrink-0", className)}
			fill="currentColor"
			viewBox="0 0 24 24"
		>
			<circle cx="9" cy="6" r="1.6" />
			<circle cx="15" cy="6" r="1.6" />
			<circle cx="9" cy="12" r="1.6" />
			<circle cx="15" cy="12" r="1.6" />
			<circle cx="9" cy="18" r="1.6" />
			<circle cx="15" cy="18" r="1.6" />
		</svg>
	);
}

function SortableItemLabel({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			className={cn("min-w-0 flex-1 truncate", className)}
			data-slot="sortable-item-label"
			{...props}
		/>
	);
}

export {
	GripIcon,
	Sortable,
	SortableItem,
	SortableItemHandle,
	SortableItemLabel,
};
