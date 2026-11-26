import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cn } from "@sprite-anvil/ui/lib/utils";
import type * as React from "react";

// Paper · 02 Display + feedback · Avatar. Project members: neutral #3F3F3F, flat,
// no bevel, radius 8 (6 at 24px), bold initials. Groups do not overlap; they sit
// 4px apart.

function Avatar({
	className,
	size = "default",
	...props
}: AvatarPrimitive.Root.Props & {
	size?: "default" | "sm" | "lg";
}) {
	return (
		<AvatarPrimitive.Root
			className={cn(
				"group/avatar rounded-card data-[size=sm]:rounded-control-sm relative flex size-8 shrink-0 select-none data-[size=lg]:size-10 data-[size=sm]:size-6",
				className
			)}
			data-size={size}
			data-slot="avatar"
			{...props}
		/>
	);
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
	return (
		<AvatarPrimitive.Image
			className={cn(
				"aspect-square size-full rounded-[inherit] object-cover",
				className
			)}
			data-slot="avatar-image"
			{...props}
		/>
	);
}

function AvatarFallback({
	className,
	...props
}: AvatarPrimitive.Fallback.Props) {
	return (
		<AvatarPrimitive.Fallback
			className={cn(
				"bg-workbench-control text-label text-workbench-text [&>svg]:text-workbench-muted-text flex size-full items-center justify-center rounded-[inherit] leading-4 font-bold [&>svg]:size-4",
				className
			)}
			data-slot="avatar-fallback"
			{...props}
		/>
	);
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"bg-primary text-primary-foreground ring-workbench-background absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-blend-color ring-2 select-none",
				"group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
				"group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
				"group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
				className
			)}
			data-slot="avatar-badge"
			{...props}
		/>
	);
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("group/avatar-group flex gap-1", className)}
			data-slot="avatar-group"
			{...props}
		/>
	);
}

function AvatarGroupCount({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"rounded-card bg-workbench-control text-label text-workbench-text group-has-data-[size=sm]/avatar-group:rounded-control-sm relative flex size-8 shrink-0 items-center justify-center leading-4 font-bold group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
				className
			)}
			data-slot="avatar-group-count"
			{...props}
		/>
	);
}

export {
	Avatar,
	AvatarBadge,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
	AvatarImage,
};
