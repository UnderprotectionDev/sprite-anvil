"use client";

import { cn } from "@sprite-anvil/ui/lib/utils";
import type * as React from "react";

// Paper · 01 Components · Field label: 14/20 medium. Next to a disabled choice
// control the text drops to the disabled ink; in a disabled field it fades.
function Label({ className, ...props }: React.ComponentProps<"label">) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: Call sites provide htmlFor or nest a control through forwarded props.
		<label
			className={cn(
				"text-data text-foreground group-data-[disabled=true]:text-workbench-faint-text peer-disabled:text-workbench-utility-disabled-text peer-data-disabled:text-workbench-utility-disabled-text flex items-center gap-2 font-medium select-none group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed",
				className
			)}
			data-slot="label"
			{...props}
		/>
	);
}

export { Label };
