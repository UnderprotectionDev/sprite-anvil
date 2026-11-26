"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { Badge } from "@sprite-anvil/ui/components/badge";
import { cn } from "@sprite-anvil/ui/lib/utils";
import {
	wellPopupSurfaceClassName,
	wellSurfaceClassName,
} from "@sprite-anvil/ui/lib/well-surface";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

// Paper · 01 Components · 06 Extra primitives · Color picker. A 40px recessed
// trigger prints a 20px chip and the hex value; the panel is the recessed well
// lifted off the page (radius 12, 8px inset) holding 36px radius-6 swatches, a
// Hex field in its own well and, for a locked palette, a Foreign color warning
// when the value is outside it. The selected swatch carries the 2px focus-blue
// ring; the hex value is always printed.

interface ColorSwatchOption {
	/** Accessible name of the swatch, e.g. "Ember orange". */
	label: string;
	/** Hex colour, `#RRGGBB`. */
	value: string;
}

const HEX_PATTERN = /^#?(?<digits>[0-9a-f]{6})$/iu;

/** Returns `#RRGGBB` in upper case, or `null` when the input is not six hex digits. */
function parseHexColor(input: string): string | null {
	const match = HEX_PATTERN.exec(input.trim());
	return match ? `#${match.groups?.digits?.toUpperCase()}` : null;
}

function isInPalette(value: string, palette: readonly ColorSwatchOption[]) {
	const normalized = value.toUpperCase();
	return palette.some((option) => option.value.toUpperCase() === normalized);
}

function useColorValue({
	value,
	defaultValue,
	onValueChange,
}: {
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
}) {
	const [uncontrolled, setUncontrolled] = React.useState(
		defaultValue ?? "#000000"
	);
	const current = value ?? uncontrolled;
	const setValue = (next: string) => {
		if (value === undefined) {
			setUncontrolled(next);
		}
		onValueChange?.(next);
	};
	return [current, setValue] as const;
}

/** Paper's warning glyph: an exclamation mark in the dark status-tag ink. */
function ForeignColorGlyph() {
	return (
		<svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
			<path d="M12 8v5M12 17h.01" stroke="currentColor" strokeLinecap="round" />
		</svg>
	);
}

interface ColorPickerPanelProps {
	className?: string;
	defaultValue?: string;
	/** Accessible name of the swatch group. */
	label?: string;
	/** A locked palette flags any value outside it as a foreign colour. */
	locked?: boolean;
	onValueChange?: (value: string) => void;
	palette: readonly ColorSwatchOption[];
	value?: string;
}

function ColorPickerPanel({
	palette,
	value: valueProp,
	defaultValue,
	onValueChange,
	locked = false,
	label = "Palette",
	className,
}: ColorPickerPanelProps) {
	const [value, setValue] = useColorValue({
		value: valueProp,
		defaultValue,
		onValueChange,
	});
	const hexId = React.useId();
	const errorId = React.useId();
	const [draft, setDraft] = React.useState(value);
	const [lastValue, setLastValue] = React.useState(value);
	if (lastValue !== value) {
		setLastValue(value);
		setDraft(value);
	}
	const draftInvalid = parseHexColor(draft) === null;
	const checked = palette.find(
		(option) => option.value.toUpperCase() === value.toUpperCase()
	)?.value;
	const foreign = locked && !isInPalette(value, palette);

	return (
		<div
			className={cn(
				wellPopupSurfaceClassName,
				"rounded-overlay text-workbench-text flex w-74 flex-col gap-3 p-2",
				className
			)}
			data-slot="color-picker-panel"
		>
			<RadioGroupPrimitive
				aria-label={label}
				className="flex flex-wrap gap-2 p-1.5"
				data-slot="color-picker-swatches"
				onValueChange={(next) => setValue(String(next))}
				value={checked ?? null}
			>
				{palette.map((option) => (
					<RadioPrimitive.Root
						aria-label={`${option.label} ${option.value.toUpperCase()}`}
						className="rounded-control-sm data-checked:focus-ring focus-visible:focus-ring m-0.5 size-9 shrink-0 outline-0"
						data-slot="color-picker-swatch"
						key={option.value}
						style={{ backgroundColor: option.value }}
						value={option.value}
					/>
				))}
			</RadioGroupPrimitive>
			<div className="mx-1.5 flex flex-col gap-1.5">
				<label
					className={cn(
						wellSurfaceClassName,
						"rounded-control focus-within:focus-ring has-aria-invalid:outline-destructive has-aria-invalid:focus-within:outline-destructive flex h-10 shrink-0 items-center gap-2.5 px-3 outline-0 has-aria-invalid:outline-2 has-aria-invalid:outline-offset-2"
					)}
					data-slot="color-picker-hex"
					htmlFor={hexId}
				>
					<span className="text-data text-workbench-faint-text leading-5">
						Hex
					</span>
					<input
						aria-describedby={draftInvalid ? errorId : undefined}
						aria-invalid={draftInvalid || undefined}
						autoComplete="off"
						className="text-data text-workbench-text min-w-0 flex-1 bg-transparent font-mono leading-5 outline-0 focus-visible:outline-none!"
						id={hexId}
						maxLength={7}
						onBlur={() => setDraft(value)}
						onChange={(event) => {
							const next = event.target.value;
							setDraft(next);
							const parsed = parseHexColor(next);
							if (parsed !== null && parsed !== value) {
								setLastValue(parsed);
								setValue(parsed);
							}
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								setDraft(value);
							}
						}}
						spellCheck={false}
						value={draft}
					/>
				</label>
				{draftInvalid ? (
					<p
						className="text-label text-destructive leading-[18px]"
						id={errorId}
					>
						Use six hex digits, like #D9794E.
					</p>
				) : null}
			</div>
			{foreign ? (
				<div
					className="flex items-center gap-2 px-1.5 pb-1.5"
					data-slot="color-picker-foreign"
				>
					<Badge className="pr-2.5" variant="warning">
						<ForeignColorGlyph />
						Foreign color
					</Badge>
					<span className="text-label text-workbench-muted-text leading-[18px]">
						Not in palette
					</span>
				</div>
			) : null}
		</div>
	);
}

type ColorPickerProps = ColorPickerPanelProps & {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	disabled?: boolean;
	id?: string;
	/** Visually hidden name read before the hex value on the trigger. */
	triggerLabel?: string;
	triggerClassName?: string;
	"aria-labelledby"?: string;
};

function ColorPicker({
	palette,
	value: valueProp,
	defaultValue,
	onValueChange,
	locked,
	label,
	className,
	open,
	defaultOpen,
	onOpenChange,
	disabled,
	id,
	triggerLabel = "Color",
	triggerClassName,
	"aria-labelledby": ariaLabelledBy,
}: ColorPickerProps) {
	const [value, setValue] = useColorValue({
		value: valueProp,
		defaultValue,
		onValueChange,
	});
	return (
		<PopoverPrimitive.Root
			data-slot="color-picker"
			defaultOpen={defaultOpen}
			onOpenChange={onOpenChange}
			open={open}
		>
			<PopoverPrimitive.Trigger
				aria-labelledby={ariaLabelledBy}
				className={cn(
					wellSurfaceClassName,
					"rounded-control text-data text-workbench-text focus-visible:focus-ring data-popup-open:focus-ring disabled:text-workbench-utility-disabled-text flex h-10 w-50 shrink-0 items-center gap-2.5 px-3 outline-0 select-none disabled:cursor-not-allowed",
					triggerClassName
				)}
				data-slot="color-picker-trigger"
				disabled={disabled}
				id={id}
			>
				<span
					aria-hidden="true"
					className="rounded-tag size-5 shrink-0 shadow-[inset_0_0_0_1px_var(--color-pixel-edge)]"
					style={{ backgroundColor: value }}
				/>
				<span className="flex-1 text-left font-mono leading-5">
					<span className="sr-only">{triggerLabel} </span>
					{value.toUpperCase()}
				</span>
				<ChevronDownIcon
					aria-hidden="true"
					className="text-workbench-text size-4 shrink-0"
				/>
			</PopoverPrimitive.Trigger>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Positioner
					align="start"
					className="isolate z-50"
					sideOffset={12}
				>
					<PopoverPrimitive.Popup
						className="data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:animate-out data-open:animate-in origin-(--transform-origin) outline-hidden duration-100"
						data-slot="color-picker-content"
					>
						<ColorPickerPanel
							className={className}
							label={label}
							locked={locked}
							onValueChange={setValue}
							palette={palette}
							value={value}
						/>
					</PopoverPrimitive.Popup>
				</PopoverPrimitive.Positioner>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}

export type { ColorSwatchOption };
export { ColorPicker, ColorPickerPanel, parseHexColor };
