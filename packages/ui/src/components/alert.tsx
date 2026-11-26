import { cn } from "@sprite-anvil/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type * as React from "react";

// Paper · 02 Display + feedback · Alert. Inline, persistent message on a flat
// #2A2A2A surface with a 1px ring (radius 8, no bevel). The leading icon sits in a
// flat 32px glyph block (radius 6) aligned to the title line; only the glyph block
// carries the tone, the surface is never tinted.
const alertVariants = cva(
	"group/alert rounded-card bg-pixel-utility-low text-workbench-text *:[svg]:rounded-control-sm relative grid w-full gap-x-3 gap-y-0.5 p-4 text-left shadow-[inset_0_0_0_1px_var(--color-workbench-panel-hover)] has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] *:[svg]:row-span-2 *:[svg]:size-8 *:[svg]:shrink-0 *:[svg]:p-2",
	{
		variants: {
			variant: {
				default:
					"*:[svg]:bg-workbench-control *:[svg]:text-workbench-on-selection",
				destructive:
					"*:[svg]:bg-workbench-danger *:[svg]:text-workbench-on-action",
				success:
					"*:[svg]:bg-workbench-success *:[svg]:text-workbench-on-action",
				warning:
					"*:[svg]:bg-workbench-warning *:[svg]:text-workbench-on-action",
				info: "*:[svg]:bg-workbench-data *:[svg]:text-workbench-on-action",
				pending:
					"*:[svg]:bg-status-not-assessed *:[svg]:text-workbench-nav-ink",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	}
);

function Alert({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div
			className={cn(alertVariants({ variant }), className)}
			data-slot="alert"
			role="alert"
			{...props}
		/>
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"text-data text-workbench-text [&_a]:text-workbench-link [&_a]:hover:text-workbench-action-light font-semibold group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3",
				className
			)}
			data-slot="alert-title"
			{...props}
		/>
	);
}

function AlertDescription({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"text-label text-workbench-muted-text [&_a]:text-workbench-link [&_a]:hover:text-workbench-action-light text-balance group-has-[>svg]/alert:col-start-2 md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-2",
				className
			)}
			data-slot="alert-description"
			{...props}
		/>
	);
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("absolute top-3 right-3", className)}
			data-slot="alert-action"
			{...props}
		/>
	);
}

export { Alert, AlertAction, AlertDescription, AlertTitle };
