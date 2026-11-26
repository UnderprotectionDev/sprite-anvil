import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { Button } from "@sprite-anvil/ui/components/button";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { XIcon } from "lucide-react";
import type * as React from "react";

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
	return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
	return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
	return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
	return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
	return (
		<SheetPrimitive.Backdrop
			className={cn(
				"bg-workbench-scrim fixed inset-0 z-50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
				className
			)}
			data-slot="sheet-overlay"
			{...props}
		/>
	);
}

function SheetContent({
	className,
	children,
	side = "right",
	showCloseButton = true,
	...props
}: SheetPrimitive.Popup.Props & {
	side?: "top" | "right" | "bottom" | "left";
	showCloseButton?: boolean;
}) {
	return (
		<SheetPortal>
			<SheetOverlay />
			<SheetPrimitive.Popup
				className={cn(
					// Paper · 04 Sheet: floating background panel, 1px panel-hover ring, drop
					// shadow cast away from the edge, 12px radius on the open side only.
					"bg-popover text-popover-foreground text-data fixed z-50 flex flex-col transition duration-200 ease-in-out outline-none focus-visible:outline-none! data-ending-style:opacity-0 data-starting-style:opacity-0",
					"data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:rounded-t-[12px] data-[side=bottom]:shadow-[inset_0_0_0_1px_var(--color-workbench-panel-hover),0_-16px_40px_var(--color-workbench-drop-shadow-strong)] data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem]",
					"data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-[360px] data-[side=left]:max-w-[calc(100%-3rem)] data-[side=left]:rounded-r-[12px] data-[side=left]:shadow-[inset_0_0_0_1px_var(--color-workbench-panel-hover),16px_0_40px_var(--color-workbench-drop-shadow-strong)] data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem]",
					"data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-[360px] data-[side=right]:max-w-[calc(100%-3rem)] data-[side=right]:rounded-l-[12px] data-[side=right]:shadow-[inset_0_0_0_1px_var(--color-workbench-panel-hover),-16px_0_40px_var(--color-workbench-drop-shadow-strong)] data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem]",
					"data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:rounded-b-[12px] data-[side=top]:shadow-[inset_0_0_0_1px_var(--color-workbench-panel-hover),0_16px_40px_var(--color-workbench-drop-shadow-strong)] data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem]",
					className
				)}
				data-side={side}
				data-slot="sheet-content"
				{...props}
			>
				{children}
				{showCloseButton ? (
					<SheetPrimitive.Close
						data-slot="sheet-close"
						render={
							<Button
								className="rounded-tag text-muted-foreground hover:text-foreground absolute top-3 right-3"
								size="icon-sm"
								variant="ghost"
							/>
						}
					>
						<XIcon className="size-4" />
						<span className="sr-only">Close</span>
					</SheetPrimitive.Close>
				) : null}
			</SheetPrimitive.Popup>
		</SheetPortal>
	);
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("flex flex-col gap-1.5 px-5 pt-5 pr-13 pb-4", className)}
			data-slot="sheet-header"
			{...props}
		/>
	);
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"border-workbench-divider mt-auto flex flex-wrap justify-end gap-2 border-t px-5 pt-4 pb-5",
				className
			)}
			data-slot="sheet-footer"
			{...props}
		/>
	);
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
	return (
		<SheetPrimitive.Title
			className={cn(
				"text-foreground text-subhead leading-5 font-semibold",
				className
			)}
			data-slot="sheet-title"
			{...props}
		/>
	);
}

function SheetDescription({
	className,
	...props
}: SheetPrimitive.Description.Props) {
	return (
		<SheetPrimitive.Description
			className={cn("text-muted-foreground text-data", className)}
			data-slot="sheet-description"
			{...props}
		/>
	);
}

export {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
};
