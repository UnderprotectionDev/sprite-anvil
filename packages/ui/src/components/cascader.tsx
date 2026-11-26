"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@sprite-anvil/ui/lib/utils";
import {
	wellPopupSurfaceClassName,
	wellSurfaceClassName,
} from "@sprite-anvil/ui/lib/well-surface";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";

// Paper · 01 Components · 06 Extra primitives · Cascader. Hierarchical choice in
// a recessed well lifted off the page (radius 12, 8px inset). Each column opens
// the next, split by 1px dividers; the chosen path is printed in the 40px
// trigger (Inter 15/20 600). Rows are 36px radius 6; an open parent is a flat
// #232323 row in 600 with a full-ink chevron, the confirmed leaf is the #EBEBEB
// nav chip (2px lower edge, ink 700). Right or Enter opens, Left goes back,
// Enter confirms a leaf.

interface CascaderOption {
	children?: readonly CascaderOption[];
	disabled?: boolean;
	label: string;
	value: string;
}

const PATH_SEPARATOR = " › ";

function hasChildren(option: CascaderOption) {
	return (option.children?.length ?? 0) > 0;
}

/** Resolves a value path to its options, stopping at the first unknown value. */
function resolvePath(
	options: readonly CascaderOption[],
	path: readonly string[]
): CascaderOption[] {
	const resolved: CascaderOption[] = [];
	let level: readonly CascaderOption[] = options;
	for (const value of path) {
		const option = level.find((candidate) => candidate.value === value);
		if (!option) {
			break;
		}
		resolved.push(option);
		level = option.children ?? [];
	}
	return resolved;
}

const VERTICAL_KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);

/** The enabled row a vertical key lands on within one column, if any. */
function stepWithinColumn(
	enabled: readonly number[],
	index: number,
	key: string
): number | undefined {
	if (key === "Home") {
		return enabled[0];
	}
	if (key === "End") {
		return enabled.at(-1);
	}
	const position = enabled.indexOf(index);
	return enabled[position + (key === "ArrowDown" ? 1 : -1)];
}

function useCascaderValue({
	value,
	defaultValue,
	onValueChange,
}: {
	value?: readonly string[];
	defaultValue?: readonly string[];
	onValueChange?: (value: string[]) => void;
}) {
	const [uncontrolled, setUncontrolled] = React.useState<readonly string[]>(
		defaultValue ?? []
	);
	const current = value ?? uncontrolled;
	const setValue = (next: string[]) => {
		if (value === undefined) {
			setUncontrolled(next);
		}
		onValueChange?.(next);
	};
	return [current, setValue] as const;
}

interface CascaderPanelProps {
	/** Moves focus into the panel when it mounts (used inside the popup). */
	autoFocus?: boolean;
	className?: string;
	/** Accessible name of each column, by depth. Defaults to "Level n". */
	columnLabels?: readonly string[];
	defaultValue?: readonly string[];
	/** Called after a leaf is confirmed (the popup closes on it). */
	onConfirm?: (value: string[]) => void;
	onValueChange?: (value: string[]) => void;
	options: readonly CascaderOption[];
	value?: readonly string[];
}

interface FocusTarget {
	column: number;
	index: number;
}

function CascaderPanel({
	options,
	value: valueProp,
	defaultValue,
	onValueChange,
	onConfirm,
	columnLabels,
	autoFocus = false,
	className,
}: CascaderPanelProps) {
	const [value, setValue] = useCascaderValue({
		value: valueProp,
		defaultValue,
		onValueChange,
	});
	const confirmed = resolvePath(options, value);
	// Open parents start on the confirmed path: every resolved option with children.
	const [openPath, setOpenPath] = React.useState<string[]>(() =>
		confirmed.filter(hasChildren).map((option) => option.value)
	);
	const openOptions = resolvePath(options, openPath);
	const columns: (readonly CascaderOption[])[] = [
		options,
		...openOptions.map((option) => option.children ?? []),
	];

	const initialFocus = (): FocusTarget => {
		const last = confirmed.length - 1;
		const column = Math.min(Math.max(last, 0), columns.length - 1);
		const index = Math.max(
			0,
			columns[column]?.findIndex(
				(option) => option.value === confirmed[column]?.value
			) ?? 0
		);
		return { column, index };
	};
	const [focus, setFocus] = React.useState<FocusTarget>(initialFocus);
	const itemRefs = React.useRef(new Map<string, HTMLDivElement>());
	const shouldMoveFocus = React.useRef(autoFocus);

	React.useEffect(() => {
		if (!shouldMoveFocus.current) {
			return;
		}
		shouldMoveFocus.current = false;
		itemRefs.current.get(`${focus.column}:${focus.index}`)?.focus();
	});

	const moveFocus = (target: FocusTarget) => {
		shouldMoveFocus.current = true;
		setFocus(target);
	};

	const enabledIndexes = (column: number) =>
		(columns[column] ?? []).flatMap((option, index) =>
			option.disabled ? [] : [index]
		);

	const openParent = (column: number, index: number) => {
		const option = columns[column]?.[index];
		if (!option || option.disabled) {
			return;
		}
		if (!hasChildren(option)) {
			const next = [...openPath.slice(0, column), option.value];
			setOpenPath(openPath.slice(0, column));
			setValue(next);
			onConfirm?.(next);
			return;
		}
		const nextOpen = [...openPath.slice(0, column), option.value];
		setOpenPath(nextOpen);
		const children = option.children ?? [];
		const confirmedChild = confirmed[column + 1]?.value;
		const childIndex = children.findIndex(
			(child) => child.value === confirmedChild && !child.disabled
		);
		const firstEnabled = children.findIndex((child) => !child.disabled);
		const childTarget = childIndex >= 0 ? childIndex : firstEnabled;
		if (childTarget >= 0) {
			moveFocus({ column: column + 1, index: childTarget });
		}
	};

	const handleKeyDown = (
		event: React.KeyboardEvent<HTMLDivElement>,
		column: number,
		index: number
	) => {
		const option = columns[column]?.[index];
		const { key } = event;
		if (VERTICAL_KEYS.has(key)) {
			event.preventDefault();
			const next = stepWithinColumn(enabledIndexes(column), index, key);
			if (next !== undefined) {
				// Moving within a column closes the columns opened from it.
				setOpenPath(openPath.slice(0, column));
				moveFocus({ column, index: next });
			}
		} else if (key === "ArrowRight" && option && hasChildren(option)) {
			event.preventDefault();
			openParent(column, index);
		} else if (key === "ArrowLeft" && column > 0) {
			event.preventDefault();
			const parentValue = openPath[column - 1];
			const parentIndex =
				columns[column - 1]?.findIndex(
					(candidate) => candidate.value === parentValue
				) ?? 0;
			moveFocus({ column: column - 1, index: Math.max(parentIndex, 0) });
		} else if (key === "Enter" || key === " ") {
			event.preventDefault();
			openParent(column, index);
		}
	};

	const valueKey = value.join("\u0000");

	return (
		<div
			className={cn(
				wellPopupSurfaceClassName,
				"rounded-overlay text-workbench-text flex p-2",
				className
			)}
			data-slot="cascader-panel"
		>
			{columns.map((column, columnIndex) => {
				const parentPath = openPath.slice(0, columnIndex);
				return (
					<div
						aria-label={
							columnLabels?.[columnIndex] ?? `Level ${columnIndex + 1}`
						}
						className="border-workbench-divider flex min-w-0 flex-1 basis-0 flex-col gap-0.5 border-r px-2 first:pl-0 last:border-r-0 last:pr-0"
						data-slot="cascader-column"
						// biome-ignore lint/suspicious/noArrayIndexKey: a column is its depth.
						key={columnIndex}
						role="listbox"
					>
						{column.map((option, index) => {
							const isParent = hasChildren(option);
							const isOpen = openPath[columnIndex] === option.value;
							const isConfirmed =
								!isParent &&
								[...parentPath, option.value].join("\u0000") === valueKey;
							const isFocusTarget =
								focus.column === columnIndex && focus.index === index;
							return (
								<div
									aria-disabled={option.disabled || undefined}
									aria-selected={isOpen || isConfirmed}
									className={cn(
										"rounded-control-sm text-data relative flex h-9 shrink-0 cursor-default items-center justify-between gap-2 px-2.5 leading-5 outline-0 select-none",
										"focus-visible:-outline-offset-2!",
										"aria-disabled:text-workbench-utility-disabled-text aria-disabled:pointer-events-none",
										isOpen && "bg-workbench-background font-semibold",
										isConfirmed &&
											"bg-workbench-nav text-workbench-nav-ink pb-0.5 font-bold shadow-[inset_0_1px_0_var(--color-workbench-on-selection),inset_0_-2px_0_var(--color-workbench-nav-edge)]",
										!(isOpen || isConfirmed) && "hover:bg-workbench-background"
									)}
									data-confirmed={isConfirmed || undefined}
									data-open={isOpen || undefined}
									data-slot="cascader-option"
									key={option.value}
									onClick={() => {
										moveFocus({ column: columnIndex, index });
										openParent(columnIndex, index);
									}}
									onFocus={() => setFocus({ column: columnIndex, index })}
									onKeyDown={(event) =>
										handleKeyDown(event, columnIndex, index)
									}
									ref={(node) => {
										const key = `${columnIndex}:${index}`;
										if (node) {
											itemRefs.current.set(key, node);
										} else {
											itemRefs.current.delete(key);
										}
									}}
									role="option"
									tabIndex={isFocusTarget ? 0 : -1}
								>
									<span className="truncate">{option.label}</span>
									{isParent ? (
										<ChevronRightIcon
											aria-hidden="true"
											className={cn(
												"size-3.5 shrink-0",
												isOpen
													? "text-workbench-text"
													: "text-workbench-faint-text"
											)}
										/>
									) : null}
								</div>
							);
						})}
					</div>
				);
			})}
		</div>
	);
}

type CascaderProps = Omit<CascaderPanelProps, "autoFocus" | "onConfirm"> & {
	placeholder?: string;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	disabled?: boolean;
	id?: string;
	triggerClassName?: string;
	"aria-labelledby"?: string;
	"aria-label"?: string;
	"aria-invalid"?: boolean;
};

function Cascader({
	options,
	value: valueProp,
	defaultValue,
	onValueChange,
	columnLabels,
	className,
	placeholder = "Choose…",
	open,
	defaultOpen,
	onOpenChange,
	disabled,
	id,
	triggerClassName,
	"aria-labelledby": ariaLabelledBy,
	"aria-label": ariaLabel,
	"aria-invalid": ariaInvalid,
}: CascaderProps) {
	const [value, setValue] = useCascaderValue({
		value: valueProp,
		defaultValue,
		onValueChange,
	});
	const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
		defaultOpen ?? false
	);
	const isOpen = open ?? uncontrolledOpen;
	const setOpen = (next: boolean) => {
		if (open === undefined) {
			setUncontrolledOpen(next);
		}
		onOpenChange?.(next);
	};
	const path = resolvePath(options, value);
	const printed = path.map((option) => option.label).join(PATH_SEPARATOR);
	const triggerText = printed === "" ? placeholder : printed;

	return (
		<PopoverPrimitive.Root
			data-slot="cascader"
			onOpenChange={setOpen}
			open={isOpen}
		>
			<PopoverPrimitive.Trigger
				aria-invalid={ariaInvalid || undefined}
				aria-label={ariaLabel}
				aria-labelledby={ariaLabelledBy}
				className={cn(
					wellSurfaceClassName,
					"rounded-control text-workbench-text focus-visible:focus-ring data-popup-open:focus-ring aria-invalid:outline-destructive aria-invalid:focus-visible:outline-destructive! disabled:text-workbench-utility-disabled-text flex h-10 w-full shrink-0 items-center gap-2.5 pr-3 pl-4 outline-0 select-none disabled:cursor-not-allowed aria-invalid:outline-2 aria-invalid:outline-offset-2",
					triggerClassName
				)}
				data-slot="cascader-trigger"
				disabled={disabled}
				id={id}
			>
				<span
					className={cn(
						"flex-1 truncate text-left text-[15px] leading-5 font-semibold",
						printed === "" ? "text-workbench-faint-text font-normal" : null
					)}
					data-slot="cascader-value"
				>
					{triggerText}
				</span>
				<ChevronDownIcon
					aria-hidden="true"
					className="text-workbench-text size-4 shrink-0"
				/>
			</PopoverPrimitive.Trigger>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Positioner
					align="start"
					className="isolate z-50"
					sideOffset={12}
				>
					<PopoverPrimitive.Popup
						className="data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:animate-out data-open:animate-in w-(--anchor-width) origin-(--transform-origin) outline-hidden duration-100"
						data-slot="cascader-content"
						initialFocus={false}
					>
						<CascaderPanel
							autoFocus
							className={className}
							columnLabels={columnLabels}
							onConfirm={() => setOpen(false)}
							onValueChange={setValue}
							options={options}
							value={value}
						/>
					</PopoverPrimitive.Popup>
				</PopoverPrimitive.Positioner>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}

export type { CascaderOption };
export { Cascader, CascaderPanel };
