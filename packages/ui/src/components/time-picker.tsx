"use client";

import type { SegmentedInputProps } from "@sprite-anvil/ui/components/segmented-input";
import { SegmentedInput } from "@sprite-anvil/ui/components/segmented-input";
import { cn } from "@sprite-anvil/ui/lib/utils";

// Paper · 01 Components · 06 Extra primitives · Time picker. A segmented input
// for a duration: minutes : seconds : milliseconds in 40px segments (6px gap)
// with the faint "ms" unit at the end. The value is one number of milliseconds.

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MAX_DURATION = 59 * MS_PER_MINUTE + 59 * MS_PER_SECOND + 999;

const TIME_SEGMENTS = [
	{ label: "Minutes", max: 59, pad: 2, unit: "minutes" },
	{ label: "Seconds", max: 59, pad: 2, unit: "seconds" },
	{ label: "Milliseconds", max: 999, pad: 2, unit: "milliseconds" },
] as const;

function toSegments(milliseconds: number) {
	const total = Math.min(MAX_DURATION, Math.max(0, Math.round(milliseconds)));
	return [
		Math.floor(total / MS_PER_MINUTE),
		Math.floor((total % MS_PER_MINUTE) / MS_PER_SECOND),
		total % MS_PER_SECOND,
	];
}

function fromSegments([
	minutes = 0,
	seconds = 0,
	milliseconds = 0,
]: readonly number[]) {
	return minutes * MS_PER_MINUTE + seconds * MS_PER_SECOND + milliseconds;
}

interface TimePickerProps
	extends Omit<
		SegmentedInputProps,
		"segments" | "value" | "defaultValue" | "onValueChange" | "separator"
	> {
	defaultValue?: number;
	onValueChange?: (milliseconds: number) => void;
	/** Duration in milliseconds. */
	value?: number;
}

function TimePicker({
	value,
	defaultValue = 0,
	onValueChange,
	unit = "ms",
	segmentClassName,
	...props
}: TimePickerProps) {
	return (
		<SegmentedInput
			data-slot="time-picker"
			defaultValue={toSegments(defaultValue)}
			onValueChange={(next) => onValueChange?.(fromSegments(next))}
			segmentClassName={cn("w-10", segmentClassName)}
			segments={TIME_SEGMENTS}
			separator=":"
			unit={unit}
			value={value === undefined ? undefined : toSegments(value)}
			{...props}
		/>
	);
}

export type { TimePickerProps };
export { TimePicker };
