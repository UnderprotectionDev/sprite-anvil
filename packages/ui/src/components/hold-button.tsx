"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "@sprite-anvil/ui/lib/utils";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";

// Paper · 01 Components · 06 Extra primitives · Hold button. Hold to confirm a
// destructive step: a 44px #FF3B6B plate with the #B8193F 3px bevel, 1px
// #FF7C9C top light and #191919 ink at 800. While held, the lighter #FF8FAB fill
// grows from the left (white top light, same bevel) and the label reads
// `holdingLabel`. Releasing early cancels; Space or Enter also works.

interface HoldButtonProps
	extends Omit<ButtonPrimitive.Props, "children" | "onClick"> {
	children: React.ReactNode;
	/** How long the hold lasts, in milliseconds. */
	duration?: number;
	/**
	 * Draws a fixed elapsed time instead of tracking a hold. For static
	 * previews; real use leaves it unset.
	 */
	elapsed?: number;
	/** Label while the hold is in progress. */
	holdingLabel?: React.ReactNode;
	/** Runs once the hold reaches `duration`. */
	onHoldComplete?: () => void;
	/** Reports elapsed hold time in milliseconds; 0 when the hold ends. */
	onHoldProgress?: (elapsed: number) => void;
}

const DEFAULT_DURATION = 1500;

function HoldButton({
	children,
	holdingLabel = "Keep holding…",
	duration = DEFAULT_DURATION,
	onHoldComplete,
	onHoldProgress,
	elapsed: elapsedProp,
	className,
	disabled,
	onPointerDown,
	onPointerUp,
	onPointerLeave,
	onPointerCancel,
	onKeyDown,
	onKeyUp,
	onBlur,
	...props
}: HoldButtonProps) {
	const [trackedElapsed, setTrackedElapsed] = useState(0);
	const frameRef = useRef<number | null>(null);
	const startRef = useRef(0);
	const elapsed = elapsedProp ?? trackedElapsed;
	const holding = elapsed > 0;
	const progress = Math.min(1, elapsed / duration);

	function report(next: number) {
		setTrackedElapsed(next);
		onHoldProgress?.(next);
	}

	function stop() {
		if (frameRef.current !== null) {
			cancelAnimationFrame(frameRef.current);
			frameRef.current = null;
		}
		report(0);
	}

	function tick(now: number) {
		const next = Math.min(duration, now - startRef.current);
		if (next >= duration) {
			frameRef.current = null;
			report(0);
			onHoldComplete?.();
			return;
		}
		report(next);
		frameRef.current = requestAnimationFrame(tick);
	}

	function start() {
		if (disabled || elapsedProp !== undefined || frameRef.current !== null) {
			return;
		}
		startRef.current = performance.now();
		frameRef.current = requestAnimationFrame(tick);
	}

	useEffect(
		() => () => {
			if (frameRef.current !== null) {
				cancelAnimationFrame(frameRef.current);
			}
		},
		[]
	);

	return (
		<ButtonPrimitive
			className={cn(
				"bevel bevel-danger rounded-control bg-destructive text-action text-destructive-foreground focus-visible:focus-ring disabled:bg-pixel-utility-low disabled:text-workbench-utility-disabled-text relative isolate inline-flex h-11 w-45 shrink-0 touch-none items-center justify-center overflow-clip pb-(--bevel-depth) leading-[18px] font-extrabold whitespace-nowrap outline-0 select-none disabled:pointer-events-none disabled:shadow-none",
				className
			)}
			data-holding={holding ? "" : undefined}
			data-slot="hold-button"
			disabled={disabled}
			onBlur={(event) => {
				stop();
				onBlur?.(event);
			}}
			onKeyDown={(event) => {
				onKeyDown?.(event);
				if ((event.key === " " || event.key === "Enter") && !event.repeat) {
					event.preventDefault();
					start();
				}
			}}
			onKeyUp={(event) => {
				onKeyUp?.(event);
				if (event.key === " " || event.key === "Enter") {
					stop();
				}
			}}
			onPointerCancel={(event) => {
				stop();
				onPointerCancel?.(event);
			}}
			onPointerDown={(event) => {
				onPointerDown?.(event);
				if (event.button === 0) {
					start();
				}
			}}
			onPointerLeave={(event) => {
				stop();
				onPointerLeave?.(event);
			}}
			onPointerUp={(event) => {
				stop();
				onPointerUp?.(event);
			}}
			{...props}
		>
			{holding ? (
				<span
					aria-hidden="true"
					className="bg-workbench-danger-soft rounded-l-control absolute inset-y-0 left-0 -z-10 shadow-[inset_0_1px_0_var(--color-workbench-on-selection),inset_0_-3px_0_var(--color-pixel-danger-low)]"
					data-slot="hold-button-fill"
					style={{ width: `${progress * 100}%` }}
				/>
			) : null}
			{holding ? (
				<span data-slot="hold-button-label">{holdingLabel}</span>
			) : (
				<span data-slot="hold-button-label">{children}</span>
			)}
		</ButtonPrimitive>
	);
}

export type { HoldButtonProps };
export { HoldButton };
