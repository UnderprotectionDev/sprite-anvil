"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cn } from "@sprite-anvil/ui/lib/utils";

// Paper · 01 Components · 05 Data + media · Scroll Area. A thin 6px scrollbar:
// #191919 track inset 4px from the ends, #7A7A7A thumb, both fully rounded and
// visible at rest so the content length reads at a glance. The surface around
// it (usually a recessed well) belongs to the caller. Each bar renders only
// while its axis overflows.
function ScrollArea({
	className,
	children,
	...props
}: ScrollAreaPrimitive.Root.Props) {
	return (
		<ScrollAreaPrimitive.Root
			className={cn("relative", className)}
			data-slot="scroll-area"
			{...props}
		>
			<ScrollAreaPrimitive.Viewport
				className="focus-visible:focus-ring size-full rounded-[inherit] outline-none"
				data-slot="scroll-area-viewport"
			>
				{children}
			</ScrollAreaPrimitive.Viewport>
			<ScrollBar />
			<ScrollBar orientation="horizontal" />
			<ScrollAreaPrimitive.Corner />
		</ScrollAreaPrimitive.Root>
	);
}

function ScrollBar({
	className,
	orientation = "vertical",
	...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
	return (
		<ScrollAreaPrimitive.Scrollbar
			className={cn(
				"bg-workbench-sidebar flex touch-none rounded-full select-none data-horizontal:mx-1 data-horizontal:mb-[3px] data-horizontal:h-1.5 data-horizontal:flex-col data-vertical:my-1 data-vertical:me-[3px] data-vertical:w-1.5",
				className
			)}
			data-orientation={orientation}
			data-slot="scroll-area-scrollbar"
			orientation={orientation}
			{...props}
		>
			<ScrollAreaPrimitive.Thumb
				className="bg-workbench-utility-disabled-text hover:bg-workbench-faint-text relative flex-1 rounded-full transition-colors duration-120"
				data-slot="scroll-area-thumb"
			/>
		</ScrollAreaPrimitive.Scrollbar>
	);
}

export { ScrollArea, ScrollBar };
