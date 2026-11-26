import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { Button } from "@sprite-anvil/ui/components/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@sprite-anvil/ui/components/input-group";
import { cn } from "@sprite-anvil/ui/lib/utils";
import {
	wellPopupSurfaceClassName,
	wellSurfaceClassName,
} from "@sprite-anvil/ui/lib/well-surface";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import * as React from "react";

const Combobox = ComboboxPrimitive.Root;

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
	return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
}

function ComboboxTrigger({
	className,
	children,
	...props
}: ComboboxPrimitive.Trigger.Props) {
	return (
		<ComboboxPrimitive.Trigger
			className={cn("[&_svg:not([class*='size-'])]:size-4", className)}
			data-slot="combobox-trigger"
			{...props}
		>
			{children}
			<ChevronDownIcon className="text-workbench-faint-text pointer-events-none size-4" />
		</ComboboxPrimitive.Trigger>
	);
}

function ComboboxClear({ className, ...props }: ComboboxPrimitive.Clear.Props) {
	return (
		<ComboboxPrimitive.Clear
			className={cn(className)}
			data-slot="combobox-clear"
			render={<InputGroupButton size="icon-xs" variant="ghost" />}
			{...props}
		>
			<XIcon className="pointer-events-none" />
		</ComboboxPrimitive.Clear>
	);
}

function ComboboxInput({
	className,
	children,
	disabled = false,
	showTrigger = true,
	showClear = false,
	...props
}: ComboboxPrimitive.Input.Props & {
	showTrigger?: boolean;
	showClear?: boolean;
}) {
	// Combobox.InputGroup makes the whole shell the popup anchor, so the list
	// spans the field instead of starting after a leading icon addon.
	return (
		<ComboboxPrimitive.InputGroup
			render={<InputGroup className={cn("w-auto", className)} />}
		>
			<ComboboxPrimitive.Input
				render={<InputGroupInput disabled={disabled} />}
				{...props}
			/>
			<InputGroupAddon align="inline-end">
				{showTrigger ? (
					<InputGroupButton
						className="group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent"
						data-slot="input-group-button"
						disabled={disabled}
						render={<ComboboxTrigger />}
						size="icon-xs"
						variant="ghost"
					/>
				) : null}
				{showClear ? <ComboboxClear disabled={disabled} /> : null}
			</InputGroupAddon>
			{children}
		</ComboboxPrimitive.InputGroup>
	);
}

function ComboboxContent({
	className,
	side = "bottom",
	sideOffset = 6,
	align = "start",
	alignOffset = 0,
	anchor,
	...props
}: ComboboxPrimitive.Popup.Props &
	Pick<
		ComboboxPrimitive.Positioner.Props,
		"side" | "align" | "sideOffset" | "alignOffset" | "anchor"
	>) {
	return (
		<ComboboxPrimitive.Portal>
			<ComboboxPrimitive.Positioner
				align={align}
				alignOffset={alignOffset}
				anchor={anchor}
				className="isolate z-50"
				side={side}
				sideOffset={sideOffset}
			>
				<ComboboxPrimitive.Popup
					className={cn(
						wellPopupSurfaceClassName,
						"group/combobox-content data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:animate-out data-open:animate-in rounded-control text-popover-foreground relative flex max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-(--anchor-width) origin-(--transform-origin) flex-col gap-0.5 overflow-hidden px-2 pt-2 pb-[11px] duration-100 *:data-[slot=input-group]:mb-1.5 *:data-[slot=input-group]:h-9",
						className
					)}
					data-chips={!!anchor}
					data-slot="combobox-content"
					{...props}
				/>
			</ComboboxPrimitive.Positioner>
		</ComboboxPrimitive.Portal>
	);
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
	return (
		<ComboboxPrimitive.List
			className={cn(
				"no-scrollbar flex max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 flex-col gap-0.5 overflow-y-auto overscroll-contain data-empty:hidden",
				className
			)}
			data-slot="combobox-list"
			{...props}
		/>
	);
}

function ComboboxItem({
	className,
	children,
	...props
}: ComboboxPrimitive.Item.Props) {
	return (
		<ComboboxPrimitive.Item
			className={cn(
				"rounded-control-sm text-data text-foreground data-highlighted:bg-workbench-panel data-disabled:text-workbench-utility-disabled-text relative flex h-9 w-full shrink-0 cursor-default items-center gap-3 pr-2 pl-9 font-medium outline-hidden select-none focus-visible:outline-none! data-disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-slot="combobox-item"
			{...props}
		>
			{children}
			<ComboboxPrimitive.ItemIndicator
				render={
					<span className="pointer-events-none absolute left-2 flex size-4 items-center justify-center" />
				}
			>
				<CheckIcon className="pointer-events-none" strokeWidth={2.5} />
			</ComboboxPrimitive.ItemIndicator>
		</ComboboxPrimitive.Item>
	);
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
	return (
		<ComboboxPrimitive.Group
			className={cn("flex flex-col gap-0.5", className)}
			data-slot="combobox-group"
			{...props}
		/>
	);
}

function ComboboxLabel({
	className,
	...props
}: ComboboxPrimitive.GroupLabel.Props) {
	return (
		<ComboboxPrimitive.GroupLabel
			className={cn(
				"text-label text-workbench-faint-text tracking-label flex h-7 items-center pr-2 pl-9 font-semibold uppercase",
				className
			)}
			data-slot="combobox-label"
			{...props}
		/>
	);
}

function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props) {
	return (
		<ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />
	);
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
	return (
		<ComboboxPrimitive.Empty
			className={cn(
				"rounded-control bg-pixel-utility-low text-data text-foreground hidden w-full flex-col items-center gap-1 p-4 text-center font-medium shadow-[inset_0_0_0_1px_var(--color-workbench-panel-hover)] group-data-empty/combobox-content:flex",
				className
			)}
			data-slot="combobox-empty"
			{...props}
		/>
	);
}

function ComboboxSeparator({
	className,
	...props
}: ComboboxPrimitive.Separator.Props) {
	return (
		<ComboboxPrimitive.Separator
			className={cn("bg-workbench-divider my-1 h-px shrink-0", className)}
			data-slot="combobox-separator"
			{...props}
		/>
	);
}

function ComboboxChips({
	className,
	...props
}: React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> &
	ComboboxPrimitive.Chips.Props) {
	return (
		<ComboboxPrimitive.Chips
			className={cn(
				wellSurfaceClassName,
				"rounded-control text-data text-foreground has-aria-invalid:outline-destructive has-[:focus-visible]:focus-ring flex min-h-10 flex-wrap items-center gap-1 px-3 py-1.5 transition-colors duration-120 has-aria-invalid:outline-2 has-aria-invalid:outline-offset-2 has-data-[slot=combobox-chip]:px-1.5",
				className
			)}
			data-slot="combobox-chips"
			{...props}
		/>
	);
}

function ComboboxChip({
	className,
	children,
	showRemove = true,
	...props
}: ComboboxPrimitive.Chip.Props & {
	showRemove?: boolean;
}) {
	return (
		<ComboboxPrimitive.Chip
			className={cn(
				"rounded-tag bg-workbench-control text-foreground text-label has-disabled:text-workbench-utility-disabled-text flex h-7 w-fit items-center justify-center gap-1 px-2 font-medium whitespace-nowrap has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-data-[slot=combobox-chip-remove]:pr-0",
				className
			)}
			data-slot="combobox-chip"
			{...props}
		>
			{children}
			{showRemove ? (
				<ComboboxPrimitive.ChipRemove
					className="text-workbench-faint-text hover:text-foreground -ml-1"
					data-slot="combobox-chip-remove"
					render={<Button size="icon-xs" variant="ghost" />}
				>
					<XIcon className="pointer-events-none" />
				</ComboboxPrimitive.ChipRemove>
			) : null}
		</ComboboxPrimitive.Chip>
	);
}

function ComboboxChipsInput({
	className,
	...props
}: ComboboxPrimitive.Input.Props) {
	return (
		<ComboboxPrimitive.Input
			className={cn(
				"text-data placeholder:text-workbench-faint-text min-w-16 flex-1 bg-transparent outline-none",
				className
			)}
			data-slot="combobox-chip-input"
			{...props}
		/>
	);
}

function useComboboxAnchor() {
	return React.useRef<HTMLDivElement | null>(null);
}

export {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxCollection,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxGroup,
	ComboboxInput,
	ComboboxItem,
	ComboboxLabel,
	ComboboxList,
	ComboboxSeparator,
	ComboboxTrigger,
	ComboboxValue,
	useComboboxAnchor,
};
