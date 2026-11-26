"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { wellSurfaceClassName } from "@sprite-anvil/ui/lib/well-surface";
import { CheckIcon, MinusIcon } from "lucide-react";

// Paper · 01 Components · Checkbox. 16px box, 4px radius. Unchecked is the
// recessed well; checked and indeterminate are editor blue with a 2px bevel and
// a white mark. Disabled keeps the box; the label beside it dims.
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
	return (
		<CheckboxPrimitive.Root
			className={cn(
				wellSurfaceClassName,
				"peer group/checkbox rounded-tag text-workbench-on-selection focus-visible:focus-ring aria-invalid:outline-destructive aria-invalid:focus-visible:outline-destructive! relative flex size-4 shrink-0 items-center justify-center outline-0 transition-colors duration-120 after:absolute after:-inset-x-3 after:-inset-y-2 aria-invalid:outline-2 aria-invalid:outline-offset-2 data-disabled:cursor-not-allowed",
				"data-checked:bg-workbench-selection data-indeterminate:bg-workbench-selection data-checked:border-0 data-checked:shadow-[inset_0_1px_0_var(--color-workbench-selection-light),inset_0_-2px_0_var(--color-pixel-selection-low)] data-indeterminate:border-0 data-indeterminate:shadow-[inset_0_1px_0_var(--color-workbench-selection-light),inset_0_-2px_0_var(--color-pixel-selection-low)]",
				// Paper defines no checked + disabled box; it fades so it cannot read as live.
				"data-checked:data-disabled:opacity-50 data-indeterminate:data-disabled:opacity-50",
				className
			)}
			data-slot="checkbox"
			{...props}
		>
			<CheckboxPrimitive.Indicator
				className="grid place-content-center text-current transition-none [&>svg]:size-3"
				data-slot="checkbox-indicator"
			>
				<CheckIcon
					className="group-data-indeterminate/checkbox:hidden"
					strokeWidth={3}
				/>
				<MinusIcon
					className="hidden group-data-indeterminate/checkbox:block"
					strokeWidth={3}
				/>
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox };
