import { cn } from "@sprite-anvil/ui/lib/utils";
import type * as React from "react";

// Paper · 01 Components · 06 Extra primitives · Action bar. A dark floating
// bulk-selection bar: a flat clear button, the count as plain text, then 36px
// actions valid for every selected row, primary last. The caller renders the bar
// only while rows are selected and wires Escape to the same clear action.
function ActionBar({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"rounded-overlay bg-workbench-preview flex min-h-14 items-center gap-2 py-2.5 pr-2.5 pl-2 shadow-[inset_0_0_0_1px_var(--color-workbench-panel-hover),0_8px_24px_var(--color-workbench-drop-shadow)]",
				className
			)}
			data-slot="action-bar"
			role="group"
			{...props}
		/>
	);
}

function ActionBarCount({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"text-data text-foreground shrink-0 pl-1 font-mono font-semibold tabular-nums",
				className
			)}
			data-slot="action-bar-count"
			{...props}
		/>
	);
}

function ActionBarLabel({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"text-data text-workbench-muted-text -ml-0.5 min-w-0 flex-1 truncate",
				className
			)}
			data-slot="action-bar-label"
			{...props}
		/>
	);
}

export { ActionBar, ActionBarCount, ActionBarLabel };
