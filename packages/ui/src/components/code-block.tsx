import { cn } from "@sprite-anvil/ui/lib/utils";
import type * as React from "react";

// Paper · 01 Components · 06 Extra primitives · Code block diff. Read-only
// monospace: a flat header bar over a dark body with 28px lines. A changed line
// carries a +/− glyph (and a hidden word for screen readers) and the header counts
// the changes; the wash colour never stands alone.
type CodeBlockChange = "added" | "removed";

function CodeBlock({ className, ...props }: React.ComponentProps<"figure">) {
	return (
		<figure
			className={cn(
				"rounded-card flex flex-col overflow-hidden shadow-[0_0_0_1px_var(--color-workbench-panel-hover)]",
				className
			)}
			data-slot="code-block"
			{...props}
		/>
	);
}

function CodeBlockHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"bg-workbench-panel flex h-14 shrink-0 items-center justify-between gap-4 pr-3 pl-4",
				className
			)}
			data-slot="code-block-header"
			{...props}
		/>
	);
}

function CodeBlockTitle({
	className,
	...props
}: React.ComponentProps<"figcaption">) {
	return (
		<figcaption
			className={cn("text-data text-foreground truncate font-mono", className)}
			data-slot="code-block-title"
			{...props}
		/>
	);
}

function CodeBlockActions({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("flex shrink-0 items-center gap-4", className)}
			data-slot="code-block-actions"
			{...props}
		/>
	);
}

/** Counted header summary, for example `+2 added · −1 removed`. */
function CodeBlockDiffStat({
	className,
	added,
	removed,
	...props
}: React.ComponentProps<"p"> & { added: number; removed: number }) {
	return (
		<p
			className={cn("text-label flex items-center gap-4 font-mono", className)}
			data-slot="code-block-diff-stat"
			{...props}
		>
			<span className="text-workbench-success-soft">+{added} added</span>
			<span className="text-workbench-danger-soft">−{removed} removed</span>
		</p>
	);
}

function CodeBlockBody({ className, ...props }: React.ComponentProps<"pre">) {
	return (
		<pre
			className={cn(
				"bg-workbench-preview text-data text-foreground overflow-x-auto py-1.5 font-mono",
				className
			)}
			data-slot="code-block-body"
			{...props}
		/>
	);
}

function CodeBlockLine({
	className,
	children,
	number,
	change,
	...props
}: React.ComponentProps<"span"> & {
	number?: number;
	change?: CodeBlockChange;
}) {
	return (
		<span
			className={cn(
				"data-[change=added]:bg-workbench-success-wash data-[change=removed]:bg-workbench-danger-wash flex h-7 items-center",
				className
			)}
			data-change={change}
			data-slot="code-block-line"
			{...props}
		>
			<span
				aria-hidden="true"
				className="text-label text-workbench-faint-text w-14 shrink-0 pr-4 text-right select-none"
			>
				{number}
			</span>
			<span
				aria-hidden="true"
				className="data-[change=added]:text-workbench-success-soft data-[change=removed]:text-workbench-danger-soft w-6 shrink-0 font-bold select-none"
				data-change={change}
			>
				{change === "added" ? "+" : null}
				{change === "removed" ? "−" : null}
			</span>
			{change ? <span className="sr-only">{change}: </span> : null}
			<code className="whitespace-pre">{children}</code>
		</span>
	);
}

export type { CodeBlockChange };
export {
	CodeBlock,
	CodeBlockActions,
	CodeBlockBody,
	CodeBlockDiffStat,
	CodeBlockHeader,
	CodeBlockLine,
	CodeBlockTitle,
};
