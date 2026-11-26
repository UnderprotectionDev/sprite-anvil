"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cn } from "@sprite-anvil/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

// Paper · 01 Components · Toggle. Off: quiet text on the track. On: the raised
// #EBEBEB nav chip (white top light, 3px nav-edge bottom, dark ink).
const toggleVariants = cva(
	"group/toggle focus-visible:focus-ring aria-invalid:outline-destructive aria-invalid:focus-visible:outline-destructive! rounded-control-sm text-data text-workbench-muted-text hover:bg-workbench-panel hover:text-foreground aria-pressed:bevel aria-pressed:bevel-nav aria-pressed:bg-workbench-nav aria-pressed:text-workbench-nav-ink aria-pressed:hover:bg-workbench-nav aria-pressed:hover:text-workbench-nav-ink disabled:text-workbench-utility-disabled-text inline-flex items-center justify-center gap-2 pb-[3px] font-medium whitespace-nowrap transition-colors duration-120 disabled:pointer-events-none disabled:hover:bg-transparent aria-invalid:outline-2 aria-invalid:outline-offset-2 aria-pressed:font-bold [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				outline:
					"border-border border bg-transparent aria-pressed:border-transparent",
			},
			size: {
				default:
					"h-8 min-w-8 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
				sm: "h-7 min-w-7 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				lg: "h-9 min-w-9 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	}
);

function Toggle({
	className,
	variant = "default",
	size = "default",
	...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
	return (
		<TogglePrimitive
			className={cn(toggleVariants({ variant, size, className }))}
			data-slot="toggle"
			{...props}
		/>
	);
}

export { Toggle, toggleVariants };
