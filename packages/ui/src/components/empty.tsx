import { cn } from "@sprite-anvil/ui/lib/utils";
import { wellSurfaceClassName } from "@sprite-anvil/ui/lib/well-surface";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

// Paper · 02 Display + feedback · Empty. First-run or cleared state inside a
// recessed #141414 well (radius 12): a 36px flat icon tile, an Inter 16/20 600
// title, one sentence of help and the single next step.

function Empty({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"rounded-overlay flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-5 px-6 py-10 text-center text-balance",
				wellSurfaceClassName,
				className
			)}
			data-slot="empty"
			{...props}
		/>
	);
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("flex max-w-sm flex-col items-center gap-3", className)}
			data-slot="empty-header"
			{...props}
		/>
	);
}

const emptyMediaVariants = cva(
	"flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				icon: "rounded-card bg-workbench-control text-workbench-text flex size-9 shrink-0 items-center justify-center [&_svg:not([class*='size-'])]:size-5",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	}
);

function EmptyMedia({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
	return (
		<div
			className={cn(emptyMediaVariants({ variant, className }))}
			data-slot="empty-icon"
			data-variant={variant}
			{...props}
		/>
	);
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"text-subhead text-workbench-text leading-5 font-semibold",
				className
			)}
			data-slot="empty-title"
			{...props}
		/>
	);
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<div
			className={cn(
				"text-data text-workbench-muted-text [&>a]:text-workbench-link [&>a:hover]:text-workbench-action-light max-w-[280px] leading-[22px] [&>a]:underline [&>a]:underline-offset-4",
				className
			)}
			data-slot="empty-description"
			{...props}
		/>
	);
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"text-data flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-balance",
				className
			)}
			data-slot="empty-content"
			{...props}
		/>
	);
}

export {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
};
