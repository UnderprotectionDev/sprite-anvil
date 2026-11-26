"use client";

import { Calendar } from "@sprite-anvil/ui/components/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@sprite-anvil/ui/components/popover";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { wellSurfaceClassName } from "@sprite-anvil/ui/lib/well-surface";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import * as React from "react";

const defaultDateFormat: Intl.DateTimeFormatOptions = {
	month: "short",
	day: "numeric",
	year: "numeric",
};

function formatDefaultDate(date: Date) {
	return date.toLocaleDateString("en-US", defaultDateFormat);
}

// Paper · 01 Components · 05 Data + media · Date Picker (Popover + Calendar).
// A 40px recessed trigger shows the chosen date; the calendar opens in a popover
// directly beneath it. Open adds the focus outline and an up chevron (closed
// triggers carry no chevron), invalid swaps the outline for danger, and an empty
// value shows the faint placeholder.
function DatePicker({
	value,
	defaultValue,
	onValueChange,
	placeholder = "Pick a date",
	formatDate = formatDefaultDate,
	open,
	defaultOpen,
	onOpenChange,
	disabled,
	id,
	className,
	calendarProps,
	"aria-invalid": ariaInvalid,
	"aria-describedby": ariaDescribedBy,
	"aria-labelledby": ariaLabelledBy,
}: {
	value?: Date;
	defaultValue?: Date;
	onValueChange?: (date: Date | undefined) => void;
	placeholder?: string;
	formatDate?: (date: Date) => string;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	disabled?: boolean;
	id?: string;
	className?: string;
	calendarProps?: Omit<
		React.ComponentProps<typeof Calendar>,
		"mode" | "selected" | "onSelect"
	>;
	"aria-invalid"?: boolean;
	"aria-describedby"?: string;
	"aria-labelledby"?: string;
}) {
	const [uncontrolledValue, setUncontrolledValue] =
		React.useState(defaultValue);
	const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
		defaultOpen ?? false
	);
	const selected = value === undefined ? uncontrolledValue : value;
	const isOpen = open ?? uncontrolledOpen;

	const handleOpenChange = (nextOpen: boolean) => {
		if (open === undefined) {
			setUncontrolledOpen(nextOpen);
		}
		onOpenChange?.(nextOpen);
	};

	const handleSelect = (date: Date | undefined) => {
		if (value === undefined) {
			setUncontrolledValue(date);
		}
		onValueChange?.(date);
		handleOpenChange(false);
	};

	return (
		<Popover onOpenChange={handleOpenChange} open={isOpen}>
			<PopoverTrigger
				aria-describedby={ariaDescribedBy}
				aria-invalid={ariaInvalid}
				aria-labelledby={ariaLabelledBy}
				className={cn(
					wellSurfaceClassName,
					"group/date-picker rounded-control text-data text-foreground focus-visible:focus-ring data-popup-open:focus-ring aria-invalid:outline-destructive aria-invalid:focus-visible:outline-destructive! disabled:text-workbench-utility-disabled-text flex h-10 w-full min-w-0 items-center gap-2 px-[11px] text-left font-medium outline-0 transition-colors duration-120 disabled:cursor-not-allowed aria-invalid:outline-2 aria-invalid:outline-offset-2",
					className
				)}
				data-slot="date-picker-trigger"
				disabled={disabled}
				id={id}
			>
				<CalendarIcon
					aria-hidden="true"
					className={cn(
						"size-4 shrink-0",
						selected ? "text-muted-foreground" : "text-workbench-faint-text"
					)}
				/>
				<span
					className={cn(
						"min-w-0 flex-1 truncate",
						selected ? null : "text-workbench-faint-text font-normal"
					)}
					data-slot="date-picker-value"
				>
					{selected ? formatDate(selected) : String(placeholder)}
				</span>
				<ChevronDownIcon
					aria-hidden="true"
					className="text-workbench-faint-text hidden size-4 shrink-0 group-data-popup-open/date-picker:block group-data-popup-open/date-picker:rotate-180"
				/>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-auto px-2 py-3"
				data-slot="date-picker-content"
			>
				<Calendar
					autoFocus
					defaultMonth={selected}
					{...calendarProps}
					// The popover is the calendar surface; drop the panel's own fill,
					// ring and padding (the slot here is date-picker-content, so the
					// Calendar's popover-content override does not apply).
					className={cn(
						"bg-transparent p-0 shadow-none",
						calendarProps?.className
					)}
					mode="single"
					onSelect={handleSelect}
					selected={selected}
				/>
			</PopoverContent>
		</Popover>
	);
}

export { DatePicker };
