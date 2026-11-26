import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import type * as React from "react";

function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
	return (
		<nav
			aria-label="breadcrumb"
			className={cn(className)}
			data-slot="breadcrumb"
			{...props}
		/>
	);
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
	return (
		<ol
			className={cn(
				"text-data text-workbench-muted-text flex flex-wrap items-center gap-2 font-medium wrap-break-word",
				className
			)}
			data-slot="breadcrumb-list"
			{...props}
		/>
	);
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
	return (
		<li
			className={cn(
				"inline-flex items-center gap-2 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-slot="breadcrumb-item"
			{...props}
		/>
	);
}

function BreadcrumbLink({
	className,
	render,
	...props
}: useRender.ComponentProps<"a">) {
	return useRender({
		defaultTagName: "a",
		props: mergeProps<"a">(
			{
				className: cn(
					"rounded-tag hover:text-workbench-text focus-visible:focus-ring inline-flex items-center gap-2 transition-colors duration-120 outline-none",
					className
				),
			},
			props
		),
		render,
		state: {
			slot: "breadcrumb-link",
		},
	});
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			aria-current="page"
			className={cn(
				"text-workbench-text inline-flex items-center gap-2 font-semibold",
				className
			)}
			data-slot="breadcrumb-page"
			{...props}
		/>
	);
}

function BreadcrumbSeparator({
	children,
	className,
	...props
}: React.ComponentProps<"li">) {
	return (
		<li
			aria-hidden="true"
			className={cn(
				"text-workbench-faint-text flex h-5 w-3.5 shrink-0 items-center justify-center [&>svg]:size-3.5",
				className
			)}
			data-slot="breadcrumb-separator"
			role="presentation"
			{...props}
		>
			{children ?? <ChevronRightIcon />}
		</li>
	);
}

function BreadcrumbEllipsis({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"rounded-tag text-workbench-text in-data-popup-open:border-pixel-edge in-data-popup-open:bg-workbench-preview flex size-5 items-center justify-center border border-transparent transition-colors duration-120 in-data-popup-open:shadow-[inset_0_1px_2px_var(--color-workbench-well-shade),inset_0_-1px_0_var(--color-workbench-well-light),0_1px_0_var(--color-workbench-well-rim)] [&>svg]:size-4",
				className
			)}
			data-slot="breadcrumb-ellipsis"
			role="presentation"
			{...props}
		>
			<MoreHorizontalIcon />
			<span className="sr-only">More</span>
		</span>
	);
}

export {
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
};
