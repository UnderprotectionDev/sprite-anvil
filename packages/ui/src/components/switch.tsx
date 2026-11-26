import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { wellSurfaceClassName } from "@sprite-anvil/ui/lib/well-surface";

// Paper · 01 Components · Switch. Track 36 × 20, knob 12 inset 4. Off is the
// recessed well with a #C9C9C9 knob; on is editor blue with a 2px bevel and a
// white knob. The off track's 1px edge + 3px padding and the on track's 4px
// padding keep the knob on the same 4px inset. `sm` is a 28 × 16 track.
function Switch({
	className,
	size = "default",
	...props
}: SwitchPrimitive.Root.Props & {
	size?: "sm" | "default";
}) {
	return (
		<SwitchPrimitive.Root
			className={cn(
				wellSurfaceClassName,
				"peer group/switch focus-visible:focus-ring aria-invalid:outline-destructive aria-invalid:focus-visible:outline-destructive! relative inline-flex shrink-0 items-center rounded-full px-[3px] outline-0 transition-colors duration-120 after:absolute after:-inset-x-3 after:-inset-y-2 aria-invalid:outline-2 aria-invalid:outline-offset-2 data-disabled:cursor-not-allowed data-[size=default]:h-5 data-[size=default]:w-9 data-[size=sm]:h-4 data-[size=sm]:w-7",
				"data-checked:bg-workbench-selection data-checked:border-0 data-checked:px-1 data-checked:shadow-[inset_0_1px_0_var(--color-workbench-selection-light),inset_0_-2px_0_var(--color-pixel-selection-low)]",
				// Paper defines no on + disabled track; it fades so it cannot read as live.
				"data-checked:data-disabled:opacity-50",
				className
			)}
			data-size={size}
			data-slot="switch"
			{...props}
		>
			<SwitchPrimitive.Thumb
				className="bg-workbench-muted-text data-checked:bg-workbench-on-selection data-disabled:bg-workbench-utility-disabled-text pointer-events-none block rounded-full transition-transform duration-120 group-data-[size=default]/switch:size-3 group-data-[size=sm]/switch:size-2 group-data-[size=default]/switch:data-checked:translate-x-4 group-data-[size=sm]/switch:data-checked:translate-x-3 data-unchecked:translate-x-0"
				data-slot="switch-thumb"
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
