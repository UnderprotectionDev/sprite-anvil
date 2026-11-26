import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { wellSurfaceClassName } from "@sprite-anvil/ui/lib/well-surface";
import type * as React from "react";

// Paper · 01 Components · Input. 40px recessed well, 8px radius, 14/20 text.
// Compact (h-9) and dialog (h-11) heights come from the caller's className.
// Focus adds the 2px focus outline offset 2px; invalid swaps it for danger.
// Number inputs draw their arrows as one background image (globals.css), so
// every engine shows the same control without a wrapper. This is its hit area.
const STEPPER_WIDTH = 22;
const STEPPER_INSET = 5;
const STEPPER_HEIGHT = 30;
const REPEAT_DELAY_MS = 400;
const REPEAT_EVERY_MS = 60;

function stepperDirection(event: React.MouseEvent<HTMLInputElement>) {
	const input = event.currentTarget;
	const box = input.getBoundingClientRect();
	const fromRight = box.right - event.clientX;
	const fromMiddle = event.clientY - (box.top + box.height / 2);
	const inside =
		Math.abs(fromMiddle) <= STEPPER_HEIGHT / 2 &&
		fromRight >= STEPPER_INSET &&
		fromRight <= STEPPER_INSET + STEPPER_WIDTH &&
		!(input.disabled || input.readOnly);
	if (!inside) {
		return 0;
	}
	return fromMiddle < 0 ? 1 : -1;
}

function markStepper(input: HTMLInputElement, direction: number) {
	input.style.cursor = direction === 0 ? "" : "pointer";
	if (direction === 0) {
		delete input.dataset.step;
	} else {
		input.dataset.step = direction > 0 ? "up" : "down";
	}
}

function step(input: HTMLInputElement, direction: number) {
	const before = input.value;
	if (input.step === "any") {
		input.value = String((Number(before) || 0) + direction);
	} else if (direction > 0) {
		input.stepUp();
	} else {
		input.stepDown();
	}
	if (input.value !== before) {
		// stepUp/stepDown fire nothing; React reads the new value from "input".
		input.dispatchEvent(new Event("input", { bubbles: true }));
		input.dispatchEvent(new Event("change", { bubbles: true }));
	}
}

/** Steps once, then repeats while the button stays down. */
function holdStepper(input: HTMLInputElement, direction: number) {
	input.dataset.pressed = "";
	step(input, direction);
	let timer = window.setTimeout(function repeat() {
		// The field can unmount or lock while the button is still held.
		if (!input.isConnected || input.disabled || input.readOnly) {
			release();
			return;
		}
		step(input, direction);
		timer = window.setTimeout(repeat, REPEAT_EVERY_MS);
	}, REPEAT_DELAY_MS);
	const release = () => {
		window.clearTimeout(timer);
		delete input.dataset.pressed;
		window.removeEventListener("mouseup", release);
		window.removeEventListener("blur", release);
	};
	window.addEventListener("mouseup", release);
	window.addEventListener("blur", release);
}

function Input({
	className,
	type,
	onMouseDown,
	onMouseLeave,
	onMouseMove,
	...props
}: React.ComponentProps<"input">) {
	return (
		<InputPrimitive
			className={cn(
				wellSurfaceClassName,
				"rounded-control text-data text-foreground placeholder:text-workbench-faint-text focus-visible:focus-ring aria-invalid:outline-destructive aria-invalid:focus-visible:outline-destructive! disabled:text-workbench-utility-disabled-text disabled:placeholder:text-workbench-utility-disabled-text h-10 w-full min-w-0 px-3 outline-0 transition-colors duration-120 disabled:cursor-not-allowed aria-invalid:outline-2 aria-invalid:outline-offset-2",
				"[&[type=number]]:pr-9 [&[type=number]]:font-mono [&[type=password]]:font-mono [&[type=password]]:tracking-[0.12em]",
				"[&[type=file]]:text-label [&[type=file]]:text-muted-foreground file:text-data file:text-foreground file:me-3 file:border-0 file:bg-transparent file:p-0 file:font-sans file:font-semibold [&[type=file]]:py-[9px] [&[type=file]]:font-mono",
				className
			)}
			data-slot="input"
			onMouseDown={(event) => {
				onMouseDown?.(event);
				if (type !== "number" || event.defaultPrevented || event.button !== 0) {
					return;
				}
				const direction = stepperDirection(event);
				if (direction !== 0) {
					event.preventDefault();
					event.currentTarget.focus();
					markStepper(event.currentTarget, direction);
					holdStepper(event.currentTarget, direction);
				}
			}}
			onMouseLeave={(event) => {
				onMouseLeave?.(event);
				if (type === "number") {
					markStepper(event.currentTarget, 0);
				}
			}}
			onMouseMove={(event) => {
				onMouseMove?.(event);
				if (type === "number") {
					markStepper(event.currentTarget, stepperDirection(event));
				}
			}}
			type={type}
			{...props}
		/>
	);
}

export { Input };
