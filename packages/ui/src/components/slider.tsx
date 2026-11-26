import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { wellRailClassName } from "@sprite-anvil/ui/lib/well-surface";

// Paper · 01 Components · Slider. 6px recessed rail (radius 3), editor-blue range,
// 18px thumb with a nav face and 2px nav-edge base. Disabled greys range and thumb.
function Slider({
	className,
	defaultValue,
	value,
	min = 0,
	max = 100,
	getAriaLabel,
	getAriaValueText,
	...props
}: SliderPrimitive.Root.Props &
	Pick<SliderPrimitive.Thumb.Props, "getAriaLabel" | "getAriaValueText">) {
	let thumbCount = 2;
	if (Array.isArray(value)) {
		thumbCount = value.length;
	} else if (Array.isArray(defaultValue)) {
		thumbCount = defaultValue.length;
	} else if (typeof value === "number" || typeof defaultValue === "number") {
		// A single value renders one thumb, not a duplicate range end.
		thumbCount = 1;
	}

	return (
		<SliderPrimitive.Root
			className={cn("data-horizontal:w-full data-vertical:h-full", className)}
			data-slot="slider"
			defaultValue={defaultValue}
			max={max}
			min={min}
			thumbAlignment="edge"
			value={value}
			{...props}
		>
			{/* Paper insets the rail 12px from each end and lets the edge-aligned thumb
			    travel 3px in, so the thumb centre sits on the rail end at min and max. */}
			<SliderPrimitive.Control className="relative flex touch-none items-center select-none data-horizontal:mx-[3px] data-horizontal:h-4.5 data-vertical:my-[3px] data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
				<SliderPrimitive.Track
					className={cn(
						wellRailClassName,
						"relative grow overflow-hidden rounded-[3px] select-none data-horizontal:mx-[9px] data-horizontal:h-1.5 data-vertical:my-[9px] data-vertical:h-full data-vertical:w-1.5"
					)}
					data-slot="slider-track"
				>
					<SliderPrimitive.Indicator
						className="bg-workbench-selection data-disabled:bg-workbench-border-strong rounded-[3px] select-none data-horizontal:h-full data-vertical:w-full"
						data-slot="slider-range"
					/>
				</SliderPrimitive.Track>
				{Array.from({ length: thumbCount }, (_, index) => (
					<SliderPrimitive.Thumb
						className="bevel bevel-nav bg-workbench-nav has-[:focus-visible]:focus-ring data-disabled:bg-workbench-label-text relative block size-4.5 shrink-0 rounded-full transition-colors duration-120 outline-none select-none [--bevel-depth:2px] after:absolute after:-inset-2 data-disabled:pointer-events-none data-disabled:[--bevel-edge:var(--color-workbench-utility-hover)] data-disabled:[--bevel-light:transparent]"
						data-slot="slider-thumb"
						getAriaLabel={getAriaLabel}
						getAriaValueText={getAriaValueText}
						// biome-ignore lint/suspicious/noArrayIndexKey: Slider thumbs retain their positional identity and may share a value.
						key={index}
					/>
				))}
			</SliderPrimitive.Control>
		</SliderPrimitive.Root>
	);
}

export { Slider };
