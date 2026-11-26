"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Menubar as MenubarPrimitive } from "@base-ui/react/menubar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@sprite-anvil/ui/components/dropdown-menu";
import {
	menuChoiceItemClassName,
	menuIndicatorClassName,
	menuRadioDotClassName,
} from "@sprite-anvil/ui/lib/menu-recipe";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import type * as React from "react";

function Menubar({ className, ...props }: MenubarPrimitive.Props) {
	return (
		<MenubarPrimitive
			className={cn(
				"bevel bevel-utility rounded-control bg-workbench-utility flex h-10 w-fit shrink-0 items-center gap-1 px-1 pb-(--bevel-depth)",
				className
			)}
			data-slot="menubar"
			{...props}
		/>
	);
}

function MenubarMenu({ ...props }: React.ComponentProps<typeof DropdownMenu>) {
	return <DropdownMenu data-slot="menubar-menu" {...props} />;
}

function MenubarGroup({
	...props
}: React.ComponentProps<typeof DropdownMenuGroup>) {
	return <DropdownMenuGroup data-slot="menubar-group" {...props} />;
}

function MenubarPortal({
	...props
}: React.ComponentProps<typeof DropdownMenuPortal>) {
	return <DropdownMenuPortal data-slot="menubar-portal" {...props} />;
}

function MenubarTrigger({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuTrigger>) {
	return (
		<DropdownMenuTrigger
			className={cn(
				"rounded-control-sm text-data text-workbench-muted-text hover:bg-workbench-utility-hover hover:text-workbench-text focus-visible:focus-ring data-disabled:text-workbench-utility-disabled-text flex h-7 items-center border border-transparent px-2.5 font-medium outline-hidden transition-colors duration-120 select-none data-disabled:pointer-events-none",
				"data-popup-open:border-pixel-edge data-popup-open:bg-workbench-preview data-popup-open:text-workbench-text data-popup-open:font-semibold data-popup-open:shadow-[inset_0_1px_2px_var(--color-workbench-well-shade),inset_0_-1px_0_var(--color-workbench-well-light),0_1px_0_var(--color-workbench-well-rim)]",
				className
			)}
			data-slot="menubar-trigger"
			{...props}
		/>
	);
}

function MenubarContent({
	className,
	align = "start",
	alignOffset = -4,
	sideOffset = 16,
	...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
	return (
		<DropdownMenuContent
			align={align}
			alignOffset={alignOffset}
			className={cn("min-w-60", className)}
			data-slot="menubar-content"
			sideOffset={sideOffset}
			{...props}
		/>
	);
}

function MenubarItem({
	className,
	inset,
	variant = "default",
	...props
}: React.ComponentProps<typeof DropdownMenuItem>) {
	return (
		<DropdownMenuItem
			className={cn("group/menubar-item", className)}
			data-inset={inset}
			data-slot="menubar-item"
			data-variant={variant}
			{...props}
		/>
	);
}

function MenubarCheckboxItem({
	className,
	children,
	checked,
	inset,
	...props
}: MenuPrimitive.CheckboxItem.Props & {
	inset?: boolean;
}) {
	return (
		<MenuPrimitive.CheckboxItem
			checked={checked}
			className={cn(menuChoiceItemClassName, className)}
			data-inset={inset}
			data-slot="menubar-checkbox-item"
			{...props}
		>
			<span className={menuIndicatorClassName}>
				<MenuPrimitive.CheckboxItemIndicator>
					<CheckIcon className="text-workbench-text size-4" />
				</MenuPrimitive.CheckboxItemIndicator>
			</span>
			{children}
		</MenuPrimitive.CheckboxItem>
	);
}

function MenubarRadioGroup({
	...props
}: React.ComponentProps<typeof DropdownMenuRadioGroup>) {
	return <DropdownMenuRadioGroup data-slot="menubar-radio-group" {...props} />;
}

function MenubarRadioItem({
	className,
	children,
	inset,
	...props
}: MenuPrimitive.RadioItem.Props & {
	inset?: boolean;
}) {
	return (
		<MenuPrimitive.RadioItem
			className={cn(menuChoiceItemClassName, className)}
			data-inset={inset}
			data-slot="menubar-radio-item"
			{...props}
		>
			<span className={menuIndicatorClassName}>
				<MenuPrimitive.RadioItemIndicator className={menuRadioDotClassName} />
			</span>
			{children}
		</MenuPrimitive.RadioItem>
	);
}

function MenubarLabel({
	className,
	inset,
	...props
}: React.ComponentProps<typeof DropdownMenuLabel> & {
	inset?: boolean;
}) {
	return (
		<DropdownMenuLabel
			className={className}
			data-inset={inset}
			data-slot="menubar-label"
			{...props}
		/>
	);
}

function MenubarSeparator({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuSeparator>) {
	return (
		<DropdownMenuSeparator
			className={className}
			data-slot="menubar-separator"
			{...props}
		/>
	);
}

function MenubarShortcut({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuShortcut>) {
	return (
		<DropdownMenuShortcut
			className={className}
			data-slot="menubar-shortcut"
			{...props}
		/>
	);
}

function MenubarSub({
	...props
}: React.ComponentProps<typeof DropdownMenuSub>) {
	return <DropdownMenuSub data-slot="menubar-sub" {...props} />;
}

function MenubarSubTrigger({
	className,
	inset,
	...props
}: React.ComponentProps<typeof DropdownMenuSubTrigger> & {
	inset?: boolean;
}) {
	return (
		<DropdownMenuSubTrigger
			className={className}
			data-inset={inset}
			data-slot="menubar-sub-trigger"
			{...props}
		/>
	);
}

function MenubarSubContent({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuSubContent>) {
	return (
		<DropdownMenuSubContent
			className={className}
			data-slot="menubar-sub-content"
			{...props}
		/>
	);
}

export {
	Menubar,
	MenubarCheckboxItem,
	MenubarContent,
	MenubarGroup,
	MenubarItem,
	MenubarLabel,
	MenubarMenu,
	MenubarPortal,
	MenubarRadioGroup,
	MenubarRadioItem,
	MenubarSeparator,
	MenubarShortcut,
	MenubarSub,
	MenubarSubContent,
	MenubarSubTrigger,
	MenubarTrigger,
};
