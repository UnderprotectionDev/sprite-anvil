"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { wellSurfaceClassName } from "@sprite-anvil/ui/lib/well-surface";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
	return (
		<RadioGroupPrimitive
			className={cn("grid w-full gap-3.5", className)}
			data-slot="radio-group"
			{...props}
		/>
	);
}

// Paper · 01 Components · Radio Group. Unselected is a recessed round well;
// checked is editor blue with a 2px bevel and a 6px white dot. Inside a choice
// card the card carries the focus outline, so the radio does not repeat it.
function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
	return (
		<RadioPrimitive.Root
			className={cn(
				wellSurfaceClassName,
				"group/radio-group-item peer focus-visible:focus-ring aria-invalid:outline-destructive aria-invalid:focus-visible:outline-destructive! relative flex aspect-square size-4 shrink-0 rounded-full outline-0 transition-colors duration-120 after:absolute after:-inset-x-3 after:-inset-y-2 aria-invalid:outline-2 aria-invalid:outline-offset-2 data-disabled:cursor-not-allowed",
				"data-checked:bg-workbench-selection data-checked:border-0 data-checked:shadow-[inset_0_1px_0_var(--color-workbench-selection-light),inset_0_-2px_0_var(--color-pixel-selection-low)]",
				"in-data-[slot=field-label]:focus-visible:outline-none!",
				// Paper defines no checked + disabled radio; it fades so it cannot read as live.
				"data-disabled:opacity-50",
				className
			)}
			data-slot="radio-group-item"
			{...props}
		>
			<RadioPrimitive.Indicator
				className="flex size-full items-center justify-center"
				data-slot="radio-group-indicator"
			>
				<span className="bg-workbench-on-selection size-1.5 rounded-full" />
			</RadioPrimitive.Indicator>
		</RadioPrimitive.Root>
	);
}

export { RadioGroup, RadioGroupItem };
