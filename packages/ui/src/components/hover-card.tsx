"use client";

import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import { cn } from "@sprite-anvil/ui/lib/utils";

function HoverCard({ ...props }: PreviewCardPrimitive.Root.Props) {
	return <PreviewCardPrimitive.Root data-slot="hover-card" {...props} />;
}

function HoverCardTrigger({ ...props }: PreviewCardPrimitive.Trigger.Props) {
	return (
		<PreviewCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
	);
}

function HoverCardContent({
	className,
	side = "bottom",
	sideOffset = 8,
	align = "center",
	alignOffset = 4,
	...props
}: PreviewCardPrimitive.Popup.Props &
	Pick<
		PreviewCardPrimitive.Positioner.Props,
		"align" | "alignOffset" | "side" | "sideOffset"
	>) {
	return (
		<PreviewCardPrimitive.Portal data-slot="hover-card-portal">
			<PreviewCardPrimitive.Positioner
				align={align}
				alignOffset={alignOffset}
				className="isolate z-50"
				side={side}
				sideOffset={sideOffset}
			>
				<PreviewCardPrimitive.Popup
					className={cn(
						"data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 border-pixel-edge bg-workbench-preview text-popover-foreground data-closed:animate-out data-open:animate-in rounded-control text-data z-50 w-80 origin-(--transform-origin) border p-4 shadow-[inset_0_1px_2px_var(--color-workbench-well-shade),inset_0_-1px_0_var(--color-workbench-well-light),0_1px_0_var(--color-workbench-well-rim),0_8px_24px_var(--color-workbench-drop-shadow-strong)] outline-hidden duration-100 focus-visible:outline-none!",
						className
					)}
					data-slot="hover-card-content"
					{...props}
				/>
			</PreviewCardPrimitive.Positioner>
		</PreviewCardPrimitive.Portal>
	);
}

export { HoverCard, HoverCardContent, HoverCardTrigger };
