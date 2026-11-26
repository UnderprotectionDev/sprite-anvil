import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import {
	menuChevronClassName,
	menuChoiceItemClassName,
	menuIndicatorClassName,
	menuItemClassName,
	menuLabelClassName,
	menuMotionClassName,
	menuPanelClassName,
	menuRadioDotClassName,
	menuSeparatorClassName,
	menuShortcutClassName,
} from "@sprite-anvil/ui/lib/menu-recipe";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import type * as React from "react";

function ContextMenu({ ...props }: ContextMenuPrimitive.Root.Props) {
	return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuPortal({ ...props }: ContextMenuPrimitive.Portal.Props) {
	return (
		<ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />
	);
}

function ContextMenuTrigger({
	className,
	...props
}: ContextMenuPrimitive.Trigger.Props) {
	return (
		<ContextMenuPrimitive.Trigger
			className={cn("select-none", className)}
			data-slot="context-menu-trigger"
			{...props}
		/>
	);
}

function ContextMenuContent({
	className,
	align = "start",
	alignOffset = 4,
	side = "right",
	sideOffset = 0,
	...props
}: ContextMenuPrimitive.Popup.Props &
	Pick<
		ContextMenuPrimitive.Positioner.Props,
		"align" | "alignOffset" | "side" | "sideOffset"
	>) {
	return (
		<ContextMenuPrimitive.Portal>
			<ContextMenuPrimitive.Positioner
				align={align}
				alignOffset={alignOffset}
				className="isolate z-50 outline-none"
				side={side}
				sideOffset={sideOffset}
			>
				<ContextMenuPrimitive.Popup
					className={cn(
						menuPanelClassName,
						menuMotionClassName,
						"z-50 max-h-(--available-height) w-max max-w-(--available-width) min-w-48 origin-(--transform-origin) overflow-x-hidden overflow-y-auto",
						className
					)}
					data-slot="context-menu-content"
					{...props}
				/>
			</ContextMenuPrimitive.Positioner>
		</ContextMenuPrimitive.Portal>
	);
}

function ContextMenuGroup({ ...props }: ContextMenuPrimitive.Group.Props) {
	return (
		<ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
	);
}

function ContextMenuLabel({
	className,
	inset,
	...props
}: ContextMenuPrimitive.GroupLabel.Props & {
	inset?: boolean;
}) {
	return (
		<ContextMenuPrimitive.GroupLabel
			className={cn(menuLabelClassName, className)}
			data-inset={inset}
			data-slot="context-menu-label"
			{...props}
		/>
	);
}

function ContextMenuItem({
	className,
	inset,
	variant = "default",
	...props
}: ContextMenuPrimitive.Item.Props & {
	inset?: boolean;
	variant?: "default" | "destructive";
}) {
	return (
		<ContextMenuPrimitive.Item
			className={cn("group/context-menu-item", menuItemClassName, className)}
			data-inset={inset}
			data-slot="context-menu-item"
			data-variant={variant}
			{...props}
		/>
	);
}

function ContextMenuSub({ ...props }: ContextMenuPrimitive.SubmenuRoot.Props) {
	return (
		<ContextMenuPrimitive.SubmenuRoot data-slot="context-menu-sub" {...props} />
	);
}

function ContextMenuSubTrigger({
	className,
	inset,
	children,
	...props
}: ContextMenuPrimitive.SubmenuTrigger.Props & {
	inset?: boolean;
}) {
	return (
		<ContextMenuPrimitive.SubmenuTrigger
			className={cn(
				menuItemClassName,
				"data-popup-open:bg-workbench-panel data-popup-open:[--menu-icon:var(--color-workbench-text)]",
				className
			)}
			data-inset={inset}
			data-slot="context-menu-sub-trigger"
			{...props}
		>
			{children}
			<ChevronRightIcon className={menuChevronClassName} data-chevron="" />
		</ContextMenuPrimitive.SubmenuTrigger>
	);
}

function ContextMenuSubContent({
	alignOffset = -9,
	sideOffset = 13,
	...props
}: React.ComponentProps<typeof ContextMenuContent>) {
	return (
		<ContextMenuContent
			alignOffset={alignOffset}
			data-slot="context-menu-sub-content"
			side="right"
			sideOffset={sideOffset}
			{...props}
		/>
	);
}

function ContextMenuCheckboxItem({
	className,
	children,
	checked,
	inset,
	...props
}: ContextMenuPrimitive.CheckboxItem.Props & {
	inset?: boolean;
}) {
	return (
		<ContextMenuPrimitive.CheckboxItem
			checked={checked}
			className={cn(menuChoiceItemClassName, className)}
			data-inset={inset}
			data-slot="context-menu-checkbox-item"
			{...props}
		>
			<span className={menuIndicatorClassName}>
				<ContextMenuPrimitive.CheckboxItemIndicator>
					<CheckIcon className="text-workbench-text size-4" />
				</ContextMenuPrimitive.CheckboxItemIndicator>
			</span>
			{children}
		</ContextMenuPrimitive.CheckboxItem>
	);
}

function ContextMenuRadioGroup({
	...props
}: ContextMenuPrimitive.RadioGroup.Props) {
	return (
		<ContextMenuPrimitive.RadioGroup
			data-slot="context-menu-radio-group"
			{...props}
		/>
	);
}

function ContextMenuRadioItem({
	className,
	children,
	inset,
	...props
}: ContextMenuPrimitive.RadioItem.Props & {
	inset?: boolean;
}) {
	return (
		<ContextMenuPrimitive.RadioItem
			className={cn(menuChoiceItemClassName, className)}
			data-inset={inset}
			data-slot="context-menu-radio-item"
			{...props}
		>
			<span className={menuIndicatorClassName}>
				<ContextMenuPrimitive.RadioItemIndicator
					className={menuRadioDotClassName}
				/>
			</span>
			{children}
		</ContextMenuPrimitive.RadioItem>
	);
}

function ContextMenuSeparator({
	className,
	...props
}: ContextMenuPrimitive.Separator.Props) {
	return (
		<ContextMenuPrimitive.Separator
			className={cn(menuSeparatorClassName, className)}
			data-slot="context-menu-separator"
			{...props}
		/>
	);
}

function ContextMenuShortcut({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			className={cn(menuShortcutClassName, className)}
			data-slot="context-menu-shortcut"
			{...props}
		/>
	);
}

export {
	ContextMenu,
	ContextMenuCheckboxItem,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuPortal,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
};
