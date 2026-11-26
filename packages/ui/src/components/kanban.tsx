"use client";

import type {
	Announcements,
	CollisionDetection,
	DragEndEvent,
	DragOverEvent,
	DragStartEvent,
	UniqueIdentifier,
} from "@dnd-kit/core";
import {
	closestCorners,
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	pointerWithin,
	useDroppable,
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
import {
	LIFTED_SURFACE,
	sortableScreenReaderInstructions,
} from "@sprite-anvil/ui/components/sortable";
import { cn } from "@sprite-anvil/ui/lib/utils";
import * as React from "react";

// Paper · 01 Components · 06 Extra primitives · Kanban. Columns are data panels
// (#232323 body, 1px #3A3A3A ring, radius 8) with a 48px #2A2A2A header and a
// Geist Mono count chip on the #1C1C1C strip. Cards are raised 48px control faces.
// The lifted card floats with a 2px focus-blue ring, a drop shadow and a Moving
// label, and leaves a dashed #7A7A7A drop slot where it will land. Space or
// Enter lifts, arrows move between cards and columns, Space or Enter drops,
// Escape cancels; every move is announced.

/** Column id → card ids in order. Column and card ids share one id space. */
export type KanbanValue = Record<string, UniqueIdentifier[]>;

interface KanbanContextValue {
	activeId: UniqueIdentifier | null;
	value: KanbanValue;
}

const KanbanContext = React.createContext<KanbanContextValue>({
	value: {},
	activeId: null,
});

const KanbanColumnContext = React.createContext<string>("");

function findColumn(value: KanbanValue, id: UniqueIdentifier) {
	if (typeof id === "string" && id in value) {
		return id;
	}
	return Object.keys(value).find((column) => value[column]?.includes(id));
}

/** Pointer first (so empty columns catch the card), corners as the fallback. */
const kanbanCollisionDetection: CollisionDetection = (args) => {
	const within = pointerWithin(args);
	if (within.length > 0) {
		const card = within.find(
			({ id }) =>
				!(
					args.droppableContainers.find((c) => c.id === id)?.data.current
						?.type === "column"
				)
		);
		return card ? [card] : within;
	}
	return closestCorners(args);
};

type KanbanProps = Omit<React.ComponentProps<"div">, "onChange"> & {
	value: KanbanValue;
	onValueChange: (value: KanbanValue) => void;
	/** Human name of a card for announcements; defaults to its id. */
	getItemLabel?: (id: UniqueIdentifier) => string;
	/** Human name of a column for announcements; defaults to its id. */
	getColumnLabel?: (column: string) => string;
};

function Kanban({
	value,
	onValueChange,
	getItemLabel = String,
	getColumnLabel = String,
	className,
	children,
	...props
}: KanbanProps) {
	const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null);
	const snapshot = React.useRef<KanbanValue | null>(null);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const placeOf = (overId: UniqueIdentifier) => {
		const column = findColumn(value, overId);
		if (!column) {
			return "outside the board";
		}
		const cards = value[column] ?? [];
		const index = cards.indexOf(overId);
		const position = index === -1 ? cards.length : index;
		return `${getColumnLabel(column)}, position ${position + 1} of ${Math.max(cards.length, position + 1)}`;
	};

	// The lifted card is first reported "over" itself; the last announced target
	// keeps that from replacing the pick-up message. The origin names the cancel.
	const lastOverId = React.useRef<UniqueIdentifier | null>(null);
	const originPlace = React.useRef("its column");
	const lastMove = React.useRef("");

	const announcements: Announcements = {
		onDragStart: ({ active }) => {
			lastOverId.current = active.id;
			lastMove.current = "";
			originPlace.current = placeOf(active.id);
			return `Picked up ${getItemLabel(active.id)} in ${originPlace.current}.`;
		},
		onDragOver: ({ active, over }) => {
			if ((over?.id ?? null) === lastOverId.current) {
				return;
			}
			lastOverId.current = over?.id ?? null;
			const message = over
				? `${getItemLabel(active.id)} moved to ${placeOf(over.id)}.`
				: `${getItemLabel(active.id)} is no longer over a column.`;
			// Two targets can describe the same place; announce it once.
			if (message === lastMove.current) {
				return;
			}
			lastMove.current = message;
			return message;
		},
		onDragEnd: ({ active, over }) =>
			over
				? `${getItemLabel(active.id)} dropped in ${placeOf(over.id)}.`
				: `${getItemLabel(active.id)} dropped.`,
		onDragCancel: ({ active }) =>
			`Moving cancelled. ${getItemLabel(active.id)} returned to ${originPlace.current}.`,
	};

	const handleDragStart = ({ active }: DragStartEvent) => {
		snapshot.current = value;
		setActiveId(active.id);
	};

	// Crossing into another column moves the card there at once, so the drop
	// slot follows the pointer or the arrow keys across columns.
	const handleDragOver = ({ active, over }: DragOverEvent) => {
		if (!over) {
			return;
		}
		const from = findColumn(value, active.id);
		const to = findColumn(value, over.id);
		if (!(from && to) || from === to) {
			return;
		}
		const target = value[to] ?? [];
		const overIndex = target.indexOf(over.id);
		const index = overIndex === -1 ? target.length : overIndex;
		onValueChange({
			...value,
			[from]: (value[from] ?? []).filter((id) => id !== active.id),
			[to]: [...target.slice(0, index), active.id, ...target.slice(index)],
		});
	};

	const handleDragEnd = ({ active, over }: DragEndEvent) => {
		setActiveId(null);
		snapshot.current = null;
		if (!over) {
			return;
		}
		const column = findColumn(value, active.id);
		if (!column || column !== findColumn(value, over.id)) {
			return;
		}
		const cards = value[column] ?? [];
		const from = cards.indexOf(active.id);
		const to = cards.indexOf(over.id);
		if (to !== -1 && from !== to) {
			onValueChange({ ...value, [column]: arrayMove(cards, from, to) });
		}
	};

	const handleDragCancel = () => {
		if (snapshot.current) {
			onValueChange(snapshot.current);
		}
		snapshot.current = null;
		setActiveId(null);
	};

	const state = React.useMemo(() => ({ value, activeId }), [value, activeId]);

	return (
		<DndContext
			accessibility={{
				announcements,
				screenReaderInstructions: sortableScreenReaderInstructions,
			}}
			collisionDetection={kanbanCollisionDetection}
			onDragCancel={handleDragCancel}
			onDragEnd={handleDragEnd}
			onDragOver={handleDragOver}
			onDragStart={handleDragStart}
			sensors={sensors}
		>
			<KanbanContext.Provider value={state}>
				<div
					className={cn("flex gap-4", className)}
					data-slot="kanban"
					{...props}
				>
					{children}
				</div>
			</KanbanContext.Provider>
		</DndContext>
	);
}

type KanbanColumnProps = React.ComponentProps<"section"> & {
	value: string;
};

function KanbanColumn({
	value,
	className,
	children,
	...props
}: KanbanColumnProps) {
	return (
		<KanbanColumnContext.Provider value={value}>
			<section
				className={cn(
					"rounded-card bg-workbench-background flex min-w-0 flex-1 flex-col overflow-clip shadow-[inset_0_0_0_1px_var(--color-workbench-panel-hover)]",
					className
				)}
				data-slot="kanban-column"
				{...props}
			>
				{children}
			</section>
		</KanbanColumnContext.Provider>
	);
}

function KanbanColumnHeader({
	className,
	...props
}: React.ComponentProps<"header">) {
	return (
		<header
			className={cn(
				"rounded-t-card bg-pixel-utility-low flex h-12 shrink-0 items-center justify-between gap-2 px-4 shadow-[inset_0_1px_0_var(--color-workbench-panel-hover),inset_1px_0_0_var(--color-workbench-panel-hover),inset_-1px_0_0_var(--color-workbench-panel-hover)]",
				className
			)}
			data-slot="kanban-column-header"
			{...props}
		/>
	);
}

function KanbanColumnTitle({
	className,
	...props
}: React.ComponentProps<"h4">) {
	return (
		<h4
			className={cn(
				"text-body text-workbench-text truncate leading-5 font-semibold",
				className
			)}
			data-slot="kanban-column-title"
			{...props}
		/>
	);
}

/** Geist Mono count chip; counts the column's cards unless given children. */
function KanbanColumnCount({
	className,
	children,
	...props
}: React.ComponentProps<"span">) {
	const column = React.useContext(KanbanColumnContext);
	const { value } = React.useContext(KanbanContext);
	return (
		<span
			className={cn(
				"rounded-control-sm bg-workbench-strip text-label text-workbench-text inline-flex h-6 min-w-7 shrink-0 items-center justify-center px-1.5 font-mono leading-4",
				className
			)}
			data-slot="kanban-column-count"
			{...props}
		>
			{children ?? value[column]?.length ?? 0}
		</span>
	);
}

type KanbanColumnContentProps = React.ComponentProps<"ul"> & {
	/** Copy inside the dashed slot of an empty column. */
	emptyLabel?: React.ReactNode;
};

/** The card list and the column's drop zone (also catches drops when empty). */
function KanbanColumnContent({
	emptyLabel,
	className,
	children,
	...props
}: KanbanColumnContentProps) {
	const column = React.useContext(KanbanColumnContext);
	const { value } = React.useContext(KanbanContext);
	const cards = value[column] ?? [];
	const { setNodeRef } = useDroppable({
		id: column,
		data: { type: "column" },
	});

	return (
		<SortableContext items={cards} strategy={verticalListSortingStrategy}>
			<ul
				className={cn("flex flex-1 flex-col gap-2.5 p-3", className)}
				data-slot="kanban-column-content"
				ref={setNodeRef}
				{...props}
			>
				{children}
				{cards.length === 0 ? (
					<li
						className="rounded-control border-workbench-utility-disabled-text text-data text-workbench-muted-text flex h-12 shrink-0 items-center justify-center border-2 border-dashed px-4 text-center leading-5"
						data-slot="kanban-column-empty"
					>
						{emptyLabel}
					</li>
				) : null}
			</ul>
		</SortableContext>
	);
}

const CARD_FACE =
	"rounded-control text-body text-workbench-text flex h-12 shrink-0 items-center gap-3 px-4 leading-5";

type KanbanCardProps = Omit<React.ComponentProps<"li">, "id"> & {
	value: UniqueIdentifier;
	disabled?: boolean;
};

/** A raised card. The whole card is the drag activator; while lifted it is the drop slot. */
function KanbanCard({
	value,
	disabled,
	className,
	style,
	children,
	...props
}: KanbanCardProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: value, disabled, data: { type: "card" } });

	return (
		<li
			className={cn(
				CARD_FACE,
				"not-data-dragging:focus-visible:focus-ring cursor-grab outline-0 select-none",
				// The `bevel` utility beats `shadow-*`, so the drop slot drops it outright.
				isDragging
					? "border-workbench-utility-disabled-text border-2 border-dashed *:invisible"
					: "bevel bg-workbench-control pb-[3px]",
				className
			)}
			data-dragging={isDragging ? "" : undefined}
			data-slot="kanban-card"
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
			<span className="min-w-0 truncate">{children}</span>
		</li>
	);
}

interface KanbanOverlayProps {
	/** Renders the lifted card's content for the active card id. */
	children: (activeId: UniqueIdentifier) => React.ReactNode;
	className?: string;
	movingLabel?: string;
}

/** The floating lifted card that follows the pointer or the arrow keys. */
function KanbanOverlay({
	children,
	movingLabel = "Moving",
	className,
}: KanbanOverlayProps) {
	const { activeId } = React.useContext(KanbanContext);
	return (
		<DragOverlay>
			{activeId === null ? null : (
				<div
					className={cn(
						CARD_FACE,
						LIFTED_SURFACE,
						"cursor-grabbing justify-between font-semibold",
						className
					)}
					data-slot="kanban-overlay"
				>
					<span className="min-w-0 truncate">{children(activeId)}</span>
					<span className="text-label text-workbench-info-soft leading-5 font-semibold">
						{movingLabel}
					</span>
				</div>
			)}
		</DragOverlay>
	);
}

export {
	Kanban,
	KanbanCard,
	KanbanColumn,
	KanbanColumnContent,
	KanbanColumnCount,
	KanbanColumnHeader,
	KanbanColumnTitle,
	KanbanOverlay,
};
