"use client";

import { cn } from "@sprite-anvil/ui/lib/utils";
import type * as React from "react";

// Paper · 01 Components · 05 Data + media · Table. Flat card surface (#232323)
// with a 1px #3A3A3A edge and radius 8, no bevel. Header 36 on #2A2A2A with
// 13/18 600 muted labels, rows 44 split by 1px #303030 dividers. A selected row
// reads as #2C2C2C with a 2px focus-blue inset outline.
function Table({ className, ...props }: React.ComponentProps<"table">) {
	return (
		<div
			className="rounded-card border-border bg-card relative w-full overflow-x-auto border"
			data-slot="table-container"
		>
			<table
				className={cn(
					"text-data text-foreground w-full caption-bottom border-separate border-spacing-0",
					className
				)}
				data-slot="table"
				{...props}
			/>
		</div>
	);
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
	return (
		<thead
			className={cn("bg-muted [&_tr]:hover:bg-transparent", className)}
			data-slot="table-header"
			{...props}
		/>
	);
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
	return (
		<tbody
			className={cn(
				// Edge cells follow the container radius so row fills are not clipped.
				"[&_tr:last-child>*]:border-b-0 [&_tr:last-child>:first-child]:rounded-bl-[7px] [&_tr:last-child>:last-child]:rounded-br-[7px]",
				className
			)}
			data-slot="table-body"
			{...props}
		/>
	);
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
	return (
		<tfoot
			className={cn(
				"bg-muted [&_td]:border-workbench-divider font-semibold [&_td]:border-t [&>tr]:hover:bg-transparent [&>tr:last-child>*]:border-b-0",
				className
			)}
			data-slot="table-footer"
			{...props}
		/>
	);
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
	return (
		<tr
			className={cn(
				"hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-workbench-row-selected data-[state=selected]:outline-workbench-focus [&>*]:border-workbench-divider transition-colors duration-120 data-[state=selected]:rounded-[7px] data-[state=selected]:outline-2 data-[state=selected]:-outline-offset-2 [&>*]:border-b",
				className
			)}
			data-slot="table-row"
			{...props}
		/>
	);
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
	return (
		<th
			className={cn(
				"text-label text-muted-foreground h-9 px-2 text-left align-middle font-semibold whitespace-nowrap first:pl-3 last:pr-3 [&:has([role=checkbox])]:pr-0",
				className
			)}
			data-slot="table-head"
			{...props}
		/>
	);
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
	return (
		<td
			className={cn(
				"h-11 px-2 align-middle whitespace-nowrap first:pl-3 last:pr-3 [&:has([role=checkbox])]:pr-0",
				className
			)}
			data-slot="table-cell"
			{...props}
		/>
	);
}

function TableCaption({
	className,
	...props
}: React.ComponentProps<"caption">) {
	return (
		<caption
			className={cn(
				"border-workbench-divider text-label text-workbench-faint-text border-t py-3",
				className
			)}
			data-slot="table-caption"
			{...props}
		/>
	);
}

export {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
};
