import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { cn } from "cn";

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
			<SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
				<SliderPrimitive.Track
					className="bg-muted relative grow overflow-hidden rounded-none select-none data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
					data-slot="slider-track"
				>
					<SliderPrimitive.Indicator
						className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
						data-slot="slider-range"
					/>
				</SliderPrimitive.Track>
				{Array.from({ length: thumbCount }, (_, index) => (
					<SliderPrimitive.Thumb
						className="border-ring ring-ring/50 relative block size-3 shrink-0 rounded-none border bg-white transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-1 focus-visible:ring-1 focus-visible:outline-hidden active:ring-1 disabled:pointer-events-none disabled:opacity-50"
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
