import { Meter as MeterPrimitive } from "@base-ui/react/meter";
import { cn } from "@sprite-anvil/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type * as React from "react";

// Paper · 01 Components · 06 Extra primitives · Meter. A measured value in a known
// range: recessed well, flat 14px segments, no bevel. The label and the printed
// count carry the result; the segment colour only supports it.
const meterSegmentVariants = cva("h-3.5 flex-1 rounded-[3px]", {
	variants: {
		tone: {
			success: "data-filled:bg-workbench-success",
			warning: "data-filled:bg-workbench-warning",
			danger: "data-filled:bg-workbench-danger",
			data: "data-filled:bg-workbench-data",
		},
	},
	defaultVariants: {
		tone: "success",
	},
});

type MeterProps = MeterPrimitive.Root.Props &
	VariantProps<typeof meterSegmentVariants> & {
		/** Number of flat segments the track is divided into. */
		segments?: number;
	};

function Meter({
	className,
	children,
	segments = 8,
	tone = "success",
	value,
	min = 0,
	max = 100,
	...props
}: MeterProps) {
	const range = max - min;
	const ratio = range > 0 ? (value - min) / range : 0;
	const filled = Math.round(Math.min(Math.max(ratio, 0), 1) * segments);

	return (
		<MeterPrimitive.Root
			className={cn("flex flex-col gap-2.5", className)}
			data-slot="meter"
			max={max}
			min={min}
			value={value}
			{...props}
		>
			{children}
			<MeterPrimitive.Track
				className="well rounded-control flex gap-1.5 p-2.5"
				data-slot="meter-track"
			>
				{Array.from({ length: segments }, (_, index) => (
					<span
						aria-hidden="true"
						className={cn(
							meterSegmentVariants({ tone }),
							"bg-workbench-utility"
						)}
						data-filled={index < filled ? "" : undefined}
						data-slot="meter-segment"
						// biome-ignore lint/suspicious/noArrayIndexKey: segments are positional and never reorder.
						key={index}
					/>
				))}
			</MeterPrimitive.Track>
		</MeterPrimitive.Root>
	);
}

function MeterHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("flex items-center justify-between gap-3", className)}
			data-slot="meter-header"
			{...props}
		/>
	);
}

function MeterLabel({ className, ...props }: MeterPrimitive.Label.Props) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: Base UI Meter.Label labels the meter root through aria-labelledby, not a form control.
		<MeterPrimitive.Label
			className={cn("text-action text-foreground font-semibold", className)}
			data-slot="meter-label"
			{...props}
		/>
	);
}

function MeterValue({ className, ...props }: MeterPrimitive.Value.Props) {
	return (
		<MeterPrimitive.Value
			className={cn("text-label text-muted-foreground font-mono", className)}
			data-slot="meter-value"
			{...props}
		/>
	);
}

export { Meter, MeterHeader, MeterLabel, MeterValue, meterSegmentVariants };
