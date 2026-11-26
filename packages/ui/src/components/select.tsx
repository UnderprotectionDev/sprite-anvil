import { Select as SelectPrimitive } from "@base-ui/react/select";
import { cn } from "@sprite-anvil/ui/lib/utils";
import {
	wellPopupSurfaceClassName,
	wellSurfaceClassName,
} from "@sprite-anvil/ui/lib/well-surface";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type * as React from "react";

const Select = SelectPrimitive.Root;

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
	return (
		<SelectPrimitive.Group
			className={cn("flex scroll-my-1 flex-col gap-0.5", className)}
			data-slot="select-group"
			{...props}
		/>
	);
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
	return (
		<SelectPrimitive.Value
			className={cn("flex flex-1 text-left", className)}
			data-slot="select-value"
			{...props}
		/>
	);
}

function SelectTrigger({
	className,
	size = "default",
	children,
	...props
}: SelectPrimitive.Trigger.Props & {
	size?: "sm" | "default";
}) {
	return (
		<SelectPrimitive.Trigger
			className={cn(
				wellSurfaceClassName,
				"rounded-control text-data text-foreground focus-visible:focus-ring aria-invalid:outline-destructive aria-invalid:focus-visible:outline-destructive! disabled:text-workbench-utility-disabled-text data-popup-open:focus-ring data-placeholder:text-workbench-faint-text flex w-fit items-center justify-between gap-2 py-0 pr-2.5 pl-3 whitespace-nowrap outline-0 transition-colors duration-120 select-none disabled:cursor-not-allowed aria-invalid:outline-2 aria-invalid:outline-offset-2 data-[size=default]:h-10 data-[size=sm]:h-9 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-size={size}
			data-slot="select-trigger"
			{...props}
		>
			{children}
			<SelectPrimitive.Icon
				render={
					<ChevronDownIcon className="text-workbench-faint-text pointer-events-none size-4" />
				}
			/>
		</SelectPrimitive.Trigger>
	);
}

function SelectContent({
	className,
	children,
	side = "bottom",
	sideOffset = 4,
	align = "center",
	alignOffset = 0,
	alignItemWithTrigger = true,
	listLabel,
	...props
}: SelectPrimitive.Popup.Props &
	Pick<
		SelectPrimitive.Positioner.Props,
		"align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
	> & {
		/** Names the listbox when no visible Base UI label does. */
		listLabel?: string;
	}) {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Positioner
				align={align}
				alignItemWithTrigger={alignItemWithTrigger}
				alignOffset={alignOffset}
				className="isolate z-50"
				side={side}
				sideOffset={sideOffset}
			>
				<SelectPrimitive.Popup
					className={cn(
						wellPopupSurfaceClassName,
						"data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:animate-out data-open:animate-in rounded-control text-popover-foreground relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto px-2 pt-2 pb-[11px] duration-100 data-[align-trigger=true]:animate-none",
						className
					)}
					data-align-trigger={alignItemWithTrigger}
					data-slot="select-content"
					{...props}
				>
					<SelectScrollUpButton />
					<SelectPrimitive.List
						aria-label={listLabel}
						className="flex flex-col gap-0.5"
					>
						{children}
					</SelectPrimitive.List>
					<SelectScrollDownButton />
				</SelectPrimitive.Popup>
			</SelectPrimitive.Positioner>
		</SelectPrimitive.Portal>
	);
}

function SelectLabel({
	className,
	...props
}: SelectPrimitive.GroupLabel.Props) {
	return (
		<SelectPrimitive.GroupLabel
			className={cn(
				"text-label text-workbench-faint-text tracking-label flex h-7 items-center pr-2 pl-9 font-semibold uppercase",
				className
			)}
			data-slot="select-label"
			{...props}
		/>
	);
}

function SelectItem({
	className,
	children,
	...props
}: SelectPrimitive.Item.Props) {
	return (
		<SelectPrimitive.Item
			className={cn(
				"rounded-control-sm text-data text-foreground data-highlighted:bg-workbench-panel data-disabled:text-workbench-utility-disabled-text relative flex h-9 w-full shrink-0 cursor-default items-center gap-3 pr-2 pl-9 font-medium outline-hidden select-none focus-visible:outline-none! data-disabled:pointer-events-none data-selected:font-semibold [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-slot="select-item"
			{...props}
		>
			<SelectPrimitive.ItemText className="flex flex-1 shrink-0 items-center gap-3 whitespace-nowrap">
				{children}
			</SelectPrimitive.ItemText>
			<SelectPrimitive.ItemIndicator
				render={
					<span className="pointer-events-none absolute left-2 flex size-4 items-center justify-center" />
				}
			>
				<CheckIcon className="pointer-events-none" strokeWidth={2.5} />
			</SelectPrimitive.ItemIndicator>
		</SelectPrimitive.Item>
	);
}

function SelectSeparator({
	className,
	...props
}: SelectPrimitive.Separator.Props) {
	return (
		<SelectPrimitive.Separator
			className={cn(
				"bg-workbench-divider pointer-events-none my-1 h-px shrink-0",
				className
			)}
			data-slot="select-separator"
			{...props}
		/>
	);
}

function SelectScrollUpButton({
	className,
	...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
	return (
		<SelectPrimitive.ScrollUpArrow
			className={cn(
				"bg-workbench-preview top-0 z-10 flex w-full cursor-default items-center justify-center py-1 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-slot="select-scroll-up-button"
			{...props}
		>
			<ChevronUpIcon />
		</SelectPrimitive.ScrollUpArrow>
	);
}

function SelectScrollDownButton({
	className,
	...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
	return (
		<SelectPrimitive.ScrollDownArrow
			className={cn(
				"bg-workbench-preview bottom-0 z-10 flex w-full cursor-default items-center justify-center py-1 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-slot="select-scroll-down-button"
			{...props}
		>
			<ChevronDownIcon />
		</SelectPrimitive.ScrollDownArrow>
	);
}

export {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectScrollDownButton,
	SelectScrollUpButton,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
};
