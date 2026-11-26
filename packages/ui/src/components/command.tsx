"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@sprite-anvil/ui/components/dialog";
import {
	menuPanelClassName,
	menuRowClassName,
	menuSeparatorClassName,
	menuShortcutClassName,
	menuWellClassName,
} from "@sprite-anvil/ui/lib/menu-recipe";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { Command as CommandPrimitive } from "cmdk";
import { CheckIcon, SearchIcon } from "lucide-react";
import type * as React from "react";

function Command({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive>) {
	return (
		<CommandPrimitive
			className={cn(
				menuPanelClassName,
				"flex size-full flex-col gap-1 overflow-hidden",
				className
			)}
			data-slot="command"
			{...props}
		/>
	);
}

function CommandDialog({
	title = "Command Palette",
	description = "Search for a command to run...",
	children,
	className,
	showCloseButton = false,
	...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
	title?: string;
	description?: string;
	className?: string;
	showCloseButton?: boolean;
	children: React.ReactNode;
}) {
	return (
		<Dialog {...props}>
			<DialogHeader className="sr-only">
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription>{description}</DialogDescription>
			</DialogHeader>
			<DialogContent
				className={cn(
					"rounded-card top-1/3 translate-y-0 gap-0 overflow-visible bg-transparent p-0 shadow-none sm:max-w-[480px]",
					className
				)}
				showCloseButton={showCloseButton}
			>
				{children}
			</DialogContent>
		</Dialog>
	);
}

/** `children` sit at the end of the search well (Paper: the ⌘ K key chips). */
function CommandInput({
	className,
	children,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
	children?: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				menuWellClassName,
				"rounded-control has-[input:focus-visible]:outline-workbench-focus flex h-10 shrink-0 items-center gap-2 pr-1.5 pl-2.5 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2"
			)}
			data-slot="command-input-wrapper"
		>
			<SearchIcon
				aria-hidden="true"
				className="text-workbench-faint-text size-4 shrink-0"
			/>
			<CommandPrimitive.Input
				className={cn(
					"text-data text-workbench-text placeholder:text-workbench-faint-text disabled:text-workbench-utility-disabled-text h-full min-w-0 flex-1 bg-transparent outline-hidden focus-visible:outline-hidden! disabled:cursor-not-allowed",
					className
				)}
				data-slot="command-input"
				{...props}
			/>
			{children}
		</div>
	);
}

function CommandList({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
	return (
		<CommandPrimitive.List
			className={cn(
				"no-scrollbar max-h-80 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none",
				className
			)}
			data-slot="command-list"
			{...props}
		/>
	);
}

function CommandEmpty({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
	return (
		<CommandPrimitive.Empty
			className={cn("text-data text-workbench-muted-text p-3", className)}
			data-slot="command-empty"
			{...props}
		/>
	);
}

function CommandGroup({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
	return (
		<CommandPrimitive.Group
			className={cn(
				"text-workbench-text **:[[cmdk-group-heading]]:text-label **:[[cmdk-group-heading]]:text-workbench-faint-text overflow-hidden **:[[cmdk-group-heading]]:flex **:[[cmdk-group-heading]]:h-7 **:[[cmdk-group-heading]]:items-center **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:font-medium",
				className
			)}
			data-slot="command-group"
			{...props}
		/>
	);
}

function CommandSeparator({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
	return (
		<CommandPrimitive.Separator
			className={cn(menuSeparatorClassName, className)}
			data-slot="command-separator"
			{...props}
		/>
	);
}

function CommandItem({
	className,
	children,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
	return (
		<CommandPrimitive.Item
			className={cn(
				"group/command-item",
				menuRowClassName,
				"data-[selected=true]:bg-workbench-panel data-[disabled=true]:text-workbench-label-text data-[disabled=true]:pointer-events-none data-[disabled=true]:[--menu-icon:var(--color-workbench-label-text)] data-[disabled=true]:[--menu-shortcut:var(--color-workbench-label-text)] data-[selected=true]:[--menu-icon:var(--color-workbench-text)]",
				className
			)}
			data-slot="command-item"
			{...props}
		>
			{children}
			<CheckIcon className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
		</CommandPrimitive.Item>
	);
}

function CommandShortcut({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			className={cn(menuShortcutClassName, className)}
			data-slot="command-shortcut"
			{...props}
		/>
	);
}

export {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
};
