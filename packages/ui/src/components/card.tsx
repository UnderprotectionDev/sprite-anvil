import { cn } from "@sprite-anvil/ui/lib/utils";
import type * as React from "react";

// Paper · 02 Display + feedback · Card. The canonical asset card: flat #2A2A2A,
// radius 8, 1px #3A3A3A ring, no bevel. Body padding 16, name Inter 16/20 600,
// meta 14/18 muted. A leading preview well or image runs edge to edge.

function Card({
	className,
	size = "default",
	...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
	return (
		<div
			className={cn(
				"group/card rounded-card bg-pixel-utility-low text-data text-workbench-text flex flex-col gap-(--card-spacing) overflow-hidden py-(--card-spacing) shadow-[inset_0_0_0_1px_var(--color-workbench-panel-hover)] [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-none *:[img:last-child]:rounded-none",
				className
			)}
			data-size={size}
			data-slot="card"
			{...props}
		/>
	);
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"group/card-header @container/card-header grid auto-rows-min items-start gap-0.5 px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
				className
			)}
			data-slot="card-header"
			{...props}
		/>
	);
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"text-subhead text-workbench-text group-data-[size=sm]/card:text-data leading-5 font-semibold",
				className
			)}
			data-slot="card-title"
			{...props}
		/>
	);
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"text-data text-workbench-muted-text group-data-[size=sm]/card:text-label leading-[18px]",
				className
			)}
			data-slot="card-description"
			{...props}
		/>
	);
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"col-start-2 row-span-2 row-start-1 self-start justify-self-end",
				className
			)}
			data-slot="card-action"
			{...props}
		/>
	);
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("px-(--card-spacing)", className)}
			data-slot="card-content"
			{...props}
		/>
	);
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"border-workbench-divider flex items-center border-t p-(--card-spacing)",
				className
			)}
			data-slot="card-footer"
			{...props}
		/>
	);
}

export {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
};
