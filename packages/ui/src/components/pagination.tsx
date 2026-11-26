import type { Button } from "@sprite-anvil/ui/components/button";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { cva } from "class-variance-authority";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	MoreHorizontalIcon,
} from "lucide-react";
import type * as React from "react";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
	return (
		<nav
			aria-label="pagination"
			className={cn("mx-auto flex w-full justify-center", className)}
			data-slot="pagination"
			{...props}
		/>
	);
}

function PaginationContent({
	className,
	...props
}: React.ComponentProps<"ul">) {
	return (
		<ul
			className={cn("flex items-center gap-1", className)}
			data-slot="pagination-content"
			{...props}
		/>
	);
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
	return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
	isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, "size"> &
	React.ComponentProps<"a">;

// Paper · 01 Components · Pagination. Ghost links on 36px targets, radius 8; hover
// is a flat #3F3F3F with no bevel; the current page is the raised #EBEBEB nav chip.
const paginationLinkVariants = cva(
	"rounded-control text-data focus-visible:focus-ring aria-disabled:text-workbench-faint-text inline-flex h-9 shrink-0 cursor-pointer items-center justify-center font-medium transition-colors duration-120 outline-none select-none aria-disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			shape: {
				icon: "w-9",
				text: "text-workbench-text gap-1 px-3",
			},
			active: {
				true: "bevel bevel-nav bg-workbench-nav text-workbench-nav-ink pb-(--bevel-depth) font-bold",
				false: "hover:bg-workbench-control hover:text-workbench-text",
			},
		},
		compoundVariants: [
			{ shape: "icon", active: false, className: "text-workbench-muted-text" },
		],
		defaultVariants: {
			shape: "icon",
			active: false,
		},
	}
);

function PaginationLink({
	className,
	isActive,
	size = "icon",
	...props
}: PaginationLinkProps) {
	return (
		<a
			aria-current={isActive ? "page" : undefined}
			className={cn(
				paginationLinkVariants({
					shape: size?.startsWith("icon") ? "icon" : "text",
					active: Boolean(isActive),
				}),
				className
			)}
			data-active={isActive}
			data-size={size}
			data-slot="pagination-link"
			{...props}
		/>
	);
}

function PaginationPrevious({
	className,
	text = "Previous",
	...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
	return (
		<PaginationLink
			aria-label="Go to previous page"
			className={className}
			size="default"
			{...props}
		>
			<ChevronLeftIcon data-icon="inline-start" />
			<span className="hidden sm:block">{text}</span>
		</PaginationLink>
	);
}

function PaginationNext({
	className,
	text = "Next",
	...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
	return (
		<PaginationLink
			aria-label="Go to next page"
			className={className}
			size="default"
			{...props}
		>
			<span className="hidden sm:block">{text}</span>
			<ChevronRightIcon data-icon="inline-end" />
		</PaginationLink>
	);
}

function PaginationEllipsis({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			aria-hidden
			className={cn(
				"text-workbench-faint-text flex size-9 items-center justify-center [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-slot="pagination-ellipsis"
			{...props}
		>
			<MoreHorizontalIcon />
			<span className="sr-only">More pages</span>
		</span>
	);
}

export {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
};
