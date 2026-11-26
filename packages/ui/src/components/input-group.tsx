"use client";

import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { wellSurfaceClassName } from "@sprite-anvil/ui/lib/well-surface";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type * as React from "react";

// Paper · 01 Components · Input Group. One recessed 40px shell; icon, text, unit
// and button addons are lanes inside it. The inner control is transparent.
function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				wellSurfaceClassName,
				"group/input-group rounded-control text-data relative flex h-10 w-full min-w-0 items-center outline-0 transition-colors duration-120 has-[>textarea]:h-auto",
				"has-[>[data-align=inline-end]]:[&>input]:pr-2 has-[>[data-align=inline-start]]:[&>input]:pl-2",
				"has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
				"has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",
				// Focus and invalid ring the whole group, never the inner text.
				"has-[[data-slot=input-group-control]:focus-visible]:focus-ring",
				"has-[[data-slot][aria-invalid=true]]:outline-destructive has-[[data-slot][aria-invalid=true]]:outline-2 has-[[data-slot][aria-invalid=true]]:outline-offset-2",
				className
			)}
			data-slot="input-group"
			role="group"
			{...props}
		/>
	);
}

const inputGroupAddonVariants = cva(
	"text-data text-workbench-faint-text group-data-[disabled=true]/input-group:text-workbench-utility-disabled-text flex h-auto cursor-text items-center justify-center gap-2 py-1.5 select-none [&>svg:not([class*='size-'])]:size-4",
	{
		variants: {
			align: {
				"inline-start":
					"order-first pl-3 has-[>button]:pl-[5px] has-[>kbd]:pl-[7px]",
				"inline-end":
					"order-last pr-3 has-[>button]:pr-[5px] has-[>kbd]:pr-[7px]",
				"block-start":
					"[.border-b]:border-workbench-divider order-first w-full justify-start px-3 pt-2.5 group-has-[>input]/input-group:pt-2.5 [.border-b]:pb-2.5",
				"block-end":
					"[.border-t]:border-workbench-divider order-last w-full justify-start px-3 pb-2.5 group-has-[>input]/input-group:pb-2.5 [.border-t]:pt-2.5",
			},
		},
		defaultVariants: {
			align: "inline-start",
		},
	}
);

function InputGroupAddon({
	className,
	align = "inline-start",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
	return (
		<div
			className={cn(inputGroupAddonVariants({ align }), className)}
			data-align={align}
			data-slot="input-group-addon"
			role="group"
			{...props}
		/>
	);
}

const inputGroupButtonVariants = cva("text-label flex items-center gap-1.5", {
	variants: {
		size: {
			xs: "rounded-control-sm h-7 px-2 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&>svg:not([class*='size-'])]:size-4",
			sm: "rounded-control-sm h-8 px-2.5",
			"icon-xs":
				"rounded-control-sm size-7 p-0 has-[>svg]:p-0 [&>svg:not([class*='size-'])]:size-4",
			"icon-sm": "rounded-control-sm size-8 p-0 has-[>svg]:p-0",
		},
	},
	defaultVariants: {
		size: "xs",
	},
});

function InputGroupButton({
	className,
	type = "button",
	variant = "ghost",
	size = "xs",
	...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "type"> &
	VariantProps<typeof inputGroupButtonVariants> & {
		type?: "button" | "submit" | "reset";
	}) {
	return (
		<Button
			className={cn(inputGroupButtonVariants({ size }), className)}
			data-size={size}
			type={type}
			variant={variant}
			{...props}
		/>
	);
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"text-data text-workbench-faint-text flex items-center gap-2 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			{...props}
		/>
	);
}

function InputGroupInput({
	className,
	...props
}: React.ComponentProps<"input">) {
	return (
		<Input
			className={cn(
				"h-full flex-1 rounded-none border-0 bg-transparent shadow-none outline-none focus-visible:outline-none! aria-invalid:outline-none!",
				className
			)}
			data-slot="input-group-control"
			{...props}
		/>
	);
}

function InputGroupTextarea({
	className,
	...props
}: React.ComponentProps<"textarea">) {
	return (
		<Textarea
			className={cn(
				"flex-1 resize-none rounded-none border-0 bg-transparent py-2.5 shadow-none outline-none focus-visible:outline-none! aria-invalid:outline-none!",
				className
			)}
			data-slot="input-group-control"
			{...props}
		/>
	);
}

export {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	InputGroupText,
	InputGroupTextarea,
};
