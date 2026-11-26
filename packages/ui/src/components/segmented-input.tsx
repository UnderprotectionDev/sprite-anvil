"use client";

import { cn } from "@sprite-anvil/ui/lib/utils";
import { wellSurfaceClassName } from "@sprite-anvil/ui/lib/well-surface";
import type * as React from "react";
import { Fragment, useRef, useState } from "react";

// Paper · 01 Components · 06 Extra primitives · Segmented input. Fixed-shape
// values in a recessed 44px well (8px sides). Each segment is one tab stop and a
// spinbutton; the active segment is a 30px editor-blue block (#2563EB, 1px
// #5C8BF2 top light, 3px #1A47B8 bevel) because it is a selection. Separators and
// the unit are faint Geist Mono. Up/Down step by one, PageUp/PageDown by ten,
// Home/End jump to the bounds, digits type over the value, Left/Right switch
// segment.

interface SegmentedInputSegment {
	/** Accessible name of the segment, for example "Width" or "Minutes". */
	label: string;
	max: number;
	min?: number;
	/** Pads the shown value with leading zeros to this many digits. */
	pad?: number;
	/** Unit announced with the value, for example "px" or "seconds". */
	unit?: string;
}

interface SegmentedInputProps
	extends Omit<
		React.ComponentProps<"div">,
		"defaultValue" | "onChange" | "children"
	> {
	/**
	 * Draws this segment as active until the field is used, without taking
	 * focus. For static previews; real use leaves it unset.
	 */
	defaultActiveSegment?: number;
	defaultValue?: readonly number[];
	disabled?: boolean;
	onValueChange?: (value: number[]) => void;
	segmentClassName?: string;
	segments: readonly SegmentedInputSegment[];
	/** Drawn between segments, for example ":" or "×". */
	separator?: React.ReactNode;
	/** Trailing unit read with the value, for example "px". */
	unit?: React.ReactNode;
	value?: readonly number[];
}

const PAGE_STEP = 10;
const DIGIT = /^\d$/u;

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function formatSegment(value: number, segment: SegmentedInputSegment) {
	return String(value).padStart(segment.pad ?? 0, "0");
}

function SegmentedInput({
	className,
	segments,
	value: valueProp,
	defaultValue,
	onValueChange,
	separator,
	unit,
	disabled = false,
	defaultActiveSegment,
	segmentClassName,
	...props
}: SegmentedInputProps) {
	const [uncontrolledValue, setUncontrolledValue] = useState<number[]>(() =>
		segments.map((segment, index) => defaultValue?.[index] ?? segment.min ?? 0)
	);
	const value = valueProp ?? uncontrolledValue;
	const [activeSegment, setActiveSegment] = useState<number | null>(
		defaultActiveSegment ?? null
	);
	// Digits typed into the focused segment since it took focus.
	const typedRef = useRef("");
	const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);

	function commit(index: number, next: number) {
		const segment = segments[index];
		if (!segment) {
			return;
		}
		const nextValue = segments.map((_, i) => value[i] ?? segments[i]?.min ?? 0);
		nextValue[index] = clamp(next, segment.min ?? 0, segment.max);
		if (valueProp === undefined) {
			setUncontrolledValue(nextValue);
		}
		onValueChange?.(nextValue);
	}

	function focusSegment(index: number) {
		segmentRefs.current[index]?.focus();
	}

	function typeDigit(
		index: number,
		segment: SegmentedInputSegment,
		digit: string
	) {
		const min = segment.min ?? 0;
		let typed = `${typedRef.current}${digit}`;
		if (Number(typed) > segment.max) {
			typed = digit;
		}
		typedRef.current = typed;
		commit(index, Number(typed));
		// Advance once another digit could only overflow the segment.
		const full =
			typed.length >= String(segment.max).length ||
			Number(typed) * 10 > segment.max;
		if (full && Number(typed) >= min && index < segments.length - 1) {
			focusSegment(index + 1);
		}
	}

	function handleKeyDown(
		event: React.KeyboardEvent<HTMLDivElement>,
		index: number
	) {
		const segment = segments[index];
		if (!segment || disabled) {
			return;
		}
		const current = value[index] ?? segment.min ?? 0;
		const min = segment.min ?? 0;
		const steps: Record<string, number> = {
			ArrowUp: current + 1,
			ArrowDown: current - 1,
			PageUp: current + PAGE_STEP,
			PageDown: current - PAGE_STEP,
			Home: min,
			End: segment.max,
		};
		const stepped = steps[event.key];
		if (stepped !== undefined) {
			event.preventDefault();
			typedRef.current = "";
			commit(index, stepped);
			return;
		}
		if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
			event.preventDefault();
			focusSegment(index + (event.key === "ArrowLeft" ? -1 : 1));
			return;
		}
		if (event.key === "Backspace" || event.key === "Delete") {
			event.preventDefault();
			typedRef.current = typedRef.current.slice(0, -1);
			commit(index, Math.floor(current / 10));
			return;
		}
		if (DIGIT.test(event.key)) {
			event.preventDefault();
			typeDigit(index, segment, event.key);
		}
	}

	return (
		<div
			aria-disabled={disabled || undefined}
			className={cn(
				wellSurfaceClassName,
				"rounded-control aria-invalid:outline-destructive aria-disabled:bg-workbench-utility-disabled aria-disabled:text-workbench-utility-disabled-text flex h-11 min-w-0 items-center gap-1.5 px-2 aria-invalid:outline-2 aria-invalid:outline-offset-2",
				className
			)}
			data-slot="segmented-input"
			role="group"
			{...props}
		>
			{segments.map((segment, index) => {
				const current = value[index] ?? segment.min ?? 0;
				const active = !disabled && activeSegment === index;
				return (
					<Fragment key={segment.label}>
						{index > 0 && separator !== undefined ? (
							<span
								aria-hidden="true"
								className="text-body text-workbench-faint-text font-mono leading-[18px] select-none"
								data-slot="segmented-input-separator"
							>
								{separator}
							</span>
						) : null}
						<div
							aria-disabled={disabled || undefined}
							aria-label={segment.label}
							aria-valuemax={segment.max}
							aria-valuemin={segment.min ?? 0}
							aria-valuenow={current}
							aria-valuetext={
								segment.unit
									? `${current} ${segment.unit}`
									: formatSegment(current, segment)
							}
							className={cn(
								"rounded-control-sm text-body text-foreground data-active:bg-workbench-selection data-active:text-workbench-on-selection aria-disabled:text-workbench-utility-disabled-text flex h-[30px] w-11 shrink-0 cursor-default items-center justify-center font-mono leading-[18px] tabular-nums outline-0 select-none focus-visible:outline-none! data-active:pb-[3px] data-active:shadow-[inset_0_1px_0_var(--color-workbench-selection-light),inset_0_-3px_0_var(--color-pixel-selection-low)]",
								segmentClassName
							)}
							data-active={active ? "" : undefined}
							data-slot="segmented-input-segment"
							onBlur={() => setActiveSegment(null)}
							onFocus={() => {
								typedRef.current = "";
								setActiveSegment(index);
							}}
							onKeyDown={(event) => handleKeyDown(event, index)}
							onPointerDown={(event) => {
								if (disabled) {
									return;
								}
								// Keep the pointer from selecting text; focus the segment.
								event.preventDefault();
								focusSegment(index);
							}}
							ref={(node) => {
								segmentRefs.current[index] = node;
							}}
							role="spinbutton"
							tabIndex={disabled ? -1 : 0}
						>
							{formatSegment(current, segment)}
						</div>
					</Fragment>
				);
			})}
			{unit === undefined ? null : (
				<span
					aria-hidden="true"
					className="text-label text-workbench-faint-text ml-auto shrink-0 pr-1 font-mono select-none"
					data-slot="segmented-input-unit"
				>
					{unit}
				</span>
			)}
		</div>
	);
}

export type { SegmentedInputProps, SegmentedInputSegment };
export { SegmentedInput };
