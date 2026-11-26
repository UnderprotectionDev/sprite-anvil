import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Separator } from "@sprite-anvil/ui/components/separator";
import { cn } from "@sprite-anvil/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type * as React from "react";

// Paper · 02 Display + feedback · Item. A list row with media, content and a
// trailing action: 40px #141414 thumbnail well (radius 8), 12px row inset, title
// Inter 16/20 600, meta 14/18 muted. A group is one flat #2A2A2A list with 1px
// dividers; the selected row gets the 2px focus-blue inset outline.

function ItemGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"group/item-group rounded-card bg-pixel-utility-low flex w-full flex-col overflow-hidden",
				className
			)}
			data-slot="item-group"
			{...props}
		/>
	);
}

function ItemSeparator({
	className,
	...props
}: React.ComponentProps<typeof Separator>) {
	return (
		<Separator
			className={cn("bg-workbench-divider my-0", className)}
			data-slot="item-separator"
			orientation="horizontal"
			{...props}
		/>
	);
}

const itemVariants = cva(
	"group/item text-data text-workbench-text focus-visible:outline-workbench-focus aria-selected:bg-workbench-row-selected aria-selected:outline-workbench-focus data-selected:bg-workbench-row-selected data-selected:outline-workbench-focus [a]:hover:bg-workbench-row-selected flex w-full flex-wrap items-center outline-0 transition-colors duration-100 focus-visible:outline-2 focus-visible:-outline-offset-2 aria-selected:rounded-[7px] aria-selected:outline-2 aria-selected:-outline-offset-2 data-selected:rounded-[7px] data-selected:outline-2 data-selected:-outline-offset-2 [a]:transition-colors",
	{
		variants: {
			variant: {
				default: "",
				outline:
					"rounded-card shadow-[inset_0_0_0_1px_var(--color-workbench-panel-hover)]",
				muted: "rounded-card bg-pixel-utility-low",
			},
			size: {
				default: "gap-3 py-3 pr-2 pl-3",
				sm: "gap-2.5 px-3 py-2.5",
				xs: "gap-2 px-2.5 py-2 in-data-[slot=dropdown-menu-content]:p-0",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	}
);

function Item({
	className,
	variant = "default",
	size = "default",
	render,
	...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof itemVariants>) {
	return useRender({
		defaultTagName: "div",
		props: mergeProps<"div">(
			{
				className: cn(itemVariants({ variant, size, className })),
			},
			props
		),
		render,
		state: {
			slot: "item",
			variant,
			size,
		},
	});
}

const itemMediaVariants = cva(
	"flex shrink-0 items-center justify-center gap-2 [&_svg]:pointer-events-none",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				icon: "rounded-card bg-workbench-preview text-workbench-text size-10 group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 [&_svg:not([class*='size-'])]:size-4",
				image:
					"rounded-card bg-workbench-preview size-10 overflow-hidden group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 [&_img]:size-4/5 [&_img]:object-contain [&_img]:[image-rendering:pixelated]",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	}
);

function ItemMedia({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof itemMediaVariants>) {
	return (
		<div
			className={cn(itemMediaVariants({ variant, className }))}
			data-slot="item-media"
			data-variant={variant}
			{...props}
		/>
	);
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex min-w-0 flex-1 flex-col gap-0.5 group-data-[size=xs]/item:gap-0 [&+[data-slot=item-content]]:flex-none",
				className
			)}
			data-slot="item-content"
			{...props}
		/>
	);
}

function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"text-subhead text-workbench-text group-data-[size=sm]/item:text-data group-data-[size=xs]/item:text-data line-clamp-1 flex w-fit items-center gap-2 leading-5 font-semibold underline-offset-4",
				className
			)}
			data-slot="item-title"
			{...props}
		/>
	);
}

function ItemDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			className={cn(
				"text-data text-workbench-muted-text group-data-[size=xs]/item:text-label [&>a]:text-workbench-link [&>a:hover]:text-workbench-action-light line-clamp-2 text-left leading-[18px] font-normal [&>a]:underline [&>a]:underline-offset-4",
				className
			)}
			data-slot="item-description"
			{...props}
		/>
	);
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"text-workbench-muted-text group-aria-selected/item:text-workbench-text group-data-selected/item:text-workbench-text flex items-center gap-2 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-slot="item-actions"
			{...props}
		/>
	);
}

function ItemHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex basis-full items-center justify-between gap-2",
				className
			)}
			data-slot="item-header"
			{...props}
		/>
	);
}

function ItemFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex basis-full items-center justify-between gap-2",
				className
			)}
			data-slot="item-footer"
			{...props}
		/>
	);
}

export {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemFooter,
	ItemGroup,
	ItemHeader,
	ItemMedia,
	ItemSeparator,
	ItemTitle,
};
