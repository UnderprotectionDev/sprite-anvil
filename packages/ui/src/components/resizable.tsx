import { cn } from "@sprite-anvil/ui/lib/utils";
import { GripVerticalIcon } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";

// Paper · 01 Components · 05 Data + media · Resizable. Handles are a 1px #303030
// divider with a raised 12 × 24 grip (#3F3F3F face, 2px #0A0A0A edge). The
// handle turns selection blue (2px line, blue grip) only while it is dragged.
function ResizablePanelGroup({
	className,
	...props
}: ResizablePrimitive.GroupProps) {
	return (
		<ResizablePrimitive.Group
			className={cn(
				"flex h-full w-full aria-[orientation=vertical]:flex-col",
				className
			)}
			data-slot="resizable-panel-group"
			{...props}
		/>
	);
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
	return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
	withHandle,
	className,
	...props
}: ResizablePrimitive.SeparatorProps & {
	withHandle?: boolean;
}) {
	return (
		<ResizablePrimitive.Separator
			className={cn(
				"group/handle bg-workbench-divider focus-visible:bg-workbench-focus focus-visible:[&>div]:focus-ring data-[separator=active]:bg-workbench-selection relative flex w-px items-center justify-center transition-colors duration-120 outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-2 after:-translate-x-1/2 focus-visible:w-0.5 focus-visible:outline-none! aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-2 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 data-[separator=active]:w-0.5 aria-[orientation=horizontal]:data-[separator=active]:h-0.5 [&[aria-orientation=horizontal]>div]:rotate-90",
				className
			)}
			data-slot="resizable-handle"
			{...props}
		>
			{withHandle ? (
				<div className="rounded-control-sm bg-workbench-control text-workbench-text group-data-[separator=active]/handle:bg-workbench-selection group-data-[separator=active]/handle:text-workbench-on-selection z-10 flex h-6 w-3 shrink-0 items-center justify-center pb-0.5 shadow-[inset_0_1px_0_var(--color-workbench-raised-light),inset_0_-2px_0_var(--color-pixel-edge)] transition-colors duration-120 group-data-[separator=active]/handle:shadow-[inset_0_1px_0_var(--color-workbench-selection-light),inset_0_-2px_0_var(--color-pixel-selection-low)]">
					<GripVerticalIcon className="size-2.5" strokeWidth={2.5} />
				</div>
			) : null}
		</ResizablePrimitive.Separator>
	);
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
