import { cn } from "@sprite-anvil/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type * as React from "react";

// Paper · 01 Components · 06 Extra primitives · Timeline. 20px square markers on a
// dashed 3px rail. The marker shape and a printed label carry the state together,
// so state is never colour alone.
function Timeline({ className, ...props }: React.ComponentProps<"ol">) {
	return (
		<ol
			className={cn("flex flex-col", className)}
			data-slot="timeline"
			{...props}
		/>
	);
}

function TimelineItem({ className, ...props }: React.ComponentProps<"li">) {
	return (
		<li
			className={cn(
				"group/timeline-item flex min-h-19 gap-4 last:min-h-0",
				className
			)}
			data-slot="timeline-item"
			{...props}
		/>
	);
}

/** The marker column: the marker plus the dashed rail down to the next item. */
function TimelineIndicator({
	className,
	children,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			aria-hidden="true"
			className={cn("flex w-5 shrink-0 flex-col items-center gap-1", className)}
			data-slot="timeline-indicator"
			{...props}
		>
			{children}
			<span
				className="w-[3px] flex-1 bg-[repeating-linear-gradient(to_bottom,var(--color-workbench-border-strong)_0_6px,transparent_6px_10px)] group-last/timeline-item:hidden"
				data-slot="timeline-rail"
			/>
		</div>
	);
}

const timelineMarkerVariants = cva("rounded-tag size-5 shrink-0", {
	variants: {
		state: {
			active: "bg-workbench-nav",
			done: "bg-workbench-control",
			idle: "bg-workbench-background shadow-[inset_0_0_0_2px_var(--color-workbench-utility-disabled-text)]",
		},
	},
	defaultVariants: {
		state: "idle",
	},
});

function TimelineMarker({
	className,
	state = "idle",
	...props
}: React.ComponentProps<"span"> & VariantProps<typeof timelineMarkerVariants>) {
	return (
		<span
			className={cn(timelineMarkerVariants({ state }), className)}
			data-slot="timeline-marker"
			data-state={state}
			{...props}
		/>
	);
}

function TimelineContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("flex min-w-0 flex-col gap-0.5 pb-4", className)}
			data-slot="timeline-content"
			{...props}
		/>
	);
}

function TimelineTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"text-foreground text-subhead flex items-center gap-2.5 leading-[22px] font-semibold",
				className
			)}
			data-slot="timeline-title"
			{...props}
		/>
	);
}

function TimelineDescription({
	className,
	...props
}: React.ComponentProps<"p">) {
	return (
		<p
			className={cn(
				"text-data text-muted-foreground leading-[22px]",
				className
			)}
			data-slot="timeline-description"
			{...props}
		/>
	);
}

export {
	Timeline,
	TimelineContent,
	TimelineDescription,
	TimelineIndicator,
	TimelineItem,
	TimelineMarker,
	TimelineTitle,
	timelineMarkerVariants,
};
