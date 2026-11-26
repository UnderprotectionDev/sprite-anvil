"use client";

import { cn } from "@sprite-anvil/ui/lib/utils";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";

// Paper · 01 Components · 06 Extra primitives · Tree. A data panel (#232323,
// 1px #3A3A3A ring, radius 8, 8px inset, 2px row gap) of 36px rows indented
// 24px per level. Parents lead with a 14px muted chevron; leaves have no chevron
// lane. The selected node is a flat #333333 row with ink 700. Keyboard follows
// the WAI-ARIA tree pattern with a roving tab stop: Up and Down move, Right
// opens or enters, Left closes or goes to the parent, Home and End jump, Enter
// or Space selects, and typing a letter jumps to the next matching label.

interface TreeNode {
	children?: readonly TreeNode[];
	disabled?: boolean;
	/** A 16px leading icon (folder, file, …). */
	icon?: React.ReactNode;
	id: string;
	label: string;
}

interface VisibleNode {
	level: number;
	node: TreeNode;
	parentId: string | null;
	posInSet: number;
	setSize: number;
}

const TYPEAHEAD_RESET_MS = 500;

function isParent(node: TreeNode) {
	return (node.children?.length ?? 0) > 0;
}

function flattenVisible(
	nodes: readonly TreeNode[],
	expanded: ReadonlySet<string>,
	level = 0,
	parentId: string | null = null
): VisibleNode[] {
	return nodes.flatMap((node, index) => {
		const entry: VisibleNode = {
			node,
			level,
			parentId,
			setSize: nodes.length,
			posInSet: index + 1,
		};
		if (isParent(node) && expanded.has(node.id)) {
			return [
				entry,
				...flattenVisible(node.children ?? [], expanded, level + 1, node.id),
			];
		}
		return [entry];
	});
}

type TreeKeyAction =
	| { type: "focus"; id: string }
	| { type: "expand"; id: string; open: boolean }
	| { type: "select" };

function focusAt(
	visible: readonly VisibleNode[],
	index: number
): TreeKeyAction | null {
	const target = visible.at(index);
	return target && index >= 0 ? { type: "focus", id: target.node.id } : null;
}

/** Maps a navigation key on the row at `index` to what the tree should do. */
function resolveTreeKey(
	key: string,
	visible: readonly VisibleNode[],
	index: number,
	expanded: ReadonlySet<string>
): TreeKeyAction | null {
	const entry = visible[index];
	if (!entry) {
		return null;
	}
	const { node, parentId } = entry;
	const open = expanded.has(node.id);
	switch (key) {
		case "ArrowDown":
			return focusAt(visible, index + 1);
		case "ArrowUp":
			return focusAt(visible, index - 1);
		case "Home":
			return focusAt(visible, 0);
		case "End":
			return focusAt(visible, visible.length - 1);
		case "ArrowRight":
			if (!isParent(node)) {
				return null;
			}
			return open
				? focusAt(visible, index + 1)
				: { type: "expand", id: node.id, open: true };
		case "ArrowLeft":
			if (isParent(node) && open) {
				return { type: "expand", id: node.id, open: false };
			}
			return parentId === null ? null : { type: "focus", id: parentId };
		case "Enter":
		case " ":
			return { type: "select" };
		default:
			return null;
	}
}

function isPrintableKey(event: React.KeyboardEvent) {
	return (
		event.key.length === 1 && !(event.metaKey || event.ctrlKey || event.altKey)
	);
}

/** The next visible row whose label starts with `buffer`, wrapping around. */
function findTypeaheadMatch(
	visible: readonly VisibleNode[],
	index: number,
	buffer: string
): string | null {
	const query = buffer.toLowerCase();
	// A fresh single letter starts after the current row; a longer buffer
	// keeps the current row when it still matches.
	const start = buffer.length === 1 ? index + 1 : index;
	const ordered = [...visible.slice(start), ...visible.slice(0, start)];
	const match = ordered.find((candidate) =>
		candidate.node.label.toLowerCase().startsWith(query)
	);
	return match ? match.node.id : null;
}

function useControllable<T>(
	value: T | undefined,
	defaultValue: T,
	onChange?: (next: T) => void
) {
	const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
	const current = value === undefined ? uncontrolled : value;
	const setValue = (next: T) => {
		if (value === undefined) {
			setUncontrolled(next);
		}
		onChange?.(next);
	};
	return [current, setValue] as const;
}

type TreeProps = Omit<
	React.ComponentProps<"div">,
	"children" | "defaultValue" | "onSelect"
> & {
	items: readonly TreeNode[];
	expanded?: readonly string[];
	defaultExpanded?: readonly string[];
	onExpandedChange?: (expanded: string[]) => void;
	selected?: string | null;
	defaultSelected?: string | null;
	onSelectedChange?: (selected: string) => void;
};

function Tree({
	items,
	expanded: expandedProp,
	defaultExpanded = [],
	onExpandedChange,
	selected: selectedProp,
	defaultSelected = null,
	onSelectedChange,
	className,
	...props
}: TreeProps) {
	const [expanded, setExpanded] = useControllable<readonly string[]>(
		expandedProp,
		defaultExpanded,
		onExpandedChange as ((next: readonly string[]) => void) | undefined
	);
	const [selected, setSelected] = useControllable<string | null>(
		selectedProp,
		defaultSelected,
		onSelectedChange as ((next: string | null) => void) | undefined
	);
	const expandedSet = new Set(expanded);
	const visible = flattenVisible(items, expandedSet);

	const [activeId, setActiveId] = React.useState<string | null>(null);
	// The tab stop: the focused row, else the selected row, else the first row.
	const tabStopId =
		visible.find((entry) => entry.node.id === activeId)?.node.id ??
		visible.find((entry) => entry.node.id === selected)?.node.id ??
		visible[0]?.node.id ??
		null;

	const rowRefs = React.useRef(new Map<string, HTMLDivElement>());
	const pendingFocus = React.useRef<string | null>(null);
	const typeahead = React.useRef({ text: "", at: 0 });

	React.useEffect(() => {
		const id = pendingFocus.current;
		if (id === null) {
			return;
		}
		pendingFocus.current = null;
		rowRefs.current.get(id)?.focus();
	});

	const focusRow = (id: string) => {
		pendingFocus.current = id;
		setActiveId(id);
	};

	const setNodeExpanded = (id: string, open: boolean) => {
		const next = open
			? [...expanded.filter((item) => item !== id), id]
			: expanded.filter((item) => item !== id);
		setExpanded(next);
	};

	const select = (node: TreeNode) => {
		if (!node.disabled) {
			setSelected(node.id);
		}
	};

	const handleKeyDown = (
		event: React.KeyboardEvent<HTMLDivElement>,
		index: number
	) => {
		const entry = visible[index];
		if (!entry) {
			return;
		}
		let action = resolveTreeKey(event.key, visible, index, expandedSet);
		if (action === null && isPrintableKey(event)) {
			const now = Date.now();
			const buffer =
				now - typeahead.current.at > TYPEAHEAD_RESET_MS
					? event.key
					: typeahead.current.text + event.key;
			typeahead.current = { text: buffer, at: now };
			const id = findTypeaheadMatch(visible, index, buffer);
			action = id === null ? null : { type: "focus", id };
		}
		if (action === null) {
			return;
		}
		event.preventDefault();
		if (action.type === "focus") {
			focusRow(action.id);
		} else if (action.type === "expand") {
			setNodeExpanded(action.id, action.open);
		} else {
			select(entry.node);
		}
	};

	return (
		<div
			className={cn(
				"rounded-card bg-workbench-background flex flex-col gap-0.5 p-2 shadow-[inset_0_0_0_1px_var(--color-workbench-panel-hover)]",
				className
			)}
			data-slot="tree"
			role="tree"
			{...props}
		>
			{visible.map((entry, index) => {
				const { node, level } = entry;
				const parent = isParent(node);
				const open = parent && expandedSet.has(node.id);
				const isSelected = selected === node.id;
				const Chevron = open ? ChevronDownIcon : ChevronRightIcon;
				return (
					<div
						aria-disabled={node.disabled || undefined}
						aria-expanded={parent ? open : undefined}
						aria-level={level + 1}
						aria-posinset={entry.posInSet}
						aria-selected={isSelected}
						aria-setsize={entry.setSize}
						className={cn(
							"rounded-control-sm text-data text-workbench-text flex h-9 shrink-0 cursor-default items-center gap-2 pr-2 leading-5 outline-0 select-none",
							"focus-visible:-outline-offset-2!",
							"aria-selected:bg-workbench-panel aria-selected:font-bold",
							"aria-disabled:text-workbench-utility-disabled-text"
						)}
						data-slot="tree-item"
						key={node.id}
						onClick={() => {
							setActiveId(node.id);
							select(node);
							if (parent) {
								setNodeExpanded(node.id, !open);
							}
						}}
						onFocus={() => setActiveId(node.id)}
						onKeyDown={(event) => handleKeyDown(event, index)}
						ref={(element) => {
							if (element) {
								rowRefs.current.set(node.id, element);
							} else {
								rowRefs.current.delete(node.id);
							}
						}}
						role="treeitem"
						style={{ paddingLeft: 8 + level * 24 }}
						tabIndex={node.id === tabStopId ? 0 : -1}
					>
						{parent ? (
							<Chevron
								aria-hidden="true"
								className="text-workbench-muted-text size-3.5 shrink-0"
								strokeWidth={2.5}
							/>
						) : null}
						{node.icon ? (
							<span
								aria-hidden="true"
								className="text-workbench-text flex size-4 shrink-0 items-center justify-center [&_svg]:size-4"
							>
								{node.icon}
							</span>
						) : null}
						<span className="truncate">{node.label}</span>
					</div>
				);
			})}
		</div>
	);
}

export type { TreeNode };
export { Tree };
