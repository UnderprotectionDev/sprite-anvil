import { cn } from "@sprite-anvil/ui/lib/utils";
import { wellSurfaceClassName } from "@sprite-anvil/ui/lib/well-surface";
import type * as React from "react";

// Paper · 01 Components · Textarea. The input well at 104px, 12px side and 10px
// top inset, 14/22 text. Disabled keeps its boundary; only the text dims.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			className={cn(
				wellSurfaceClassName,
				"rounded-control text-data text-foreground placeholder:text-workbench-faint-text focus-visible:focus-ring aria-invalid:outline-destructive aria-invalid:focus-visible:outline-destructive! disabled:text-workbench-utility-disabled-text disabled:placeholder:text-workbench-utility-disabled-text flex field-sizing-content min-h-[104px] w-full resize-none px-3 py-2.5 leading-[22px] outline-0 transition-colors duration-120 disabled:cursor-not-allowed aria-invalid:outline-2 aria-invalid:outline-offset-2",
				className
			)}
			data-slot="textarea"
			{...props}
		/>
	);
}

export { Textarea };
