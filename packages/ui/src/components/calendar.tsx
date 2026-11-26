"use client";

import { Button, buttonVariants } from "@sprite-anvil/ui/components/button";
import { cn } from "@sprite-anvil/ui/lib/utils";
import {
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
} from "lucide-react";
import * as React from "react";
import type { CustomComponents, DayButton, Locale } from "react-day-picker";
import {
	DayPicker,
	getDefaultClassNames,
	useDayPicker,
} from "react-day-picker";

// Paper · 01 Components · 05 Data + media · Calendar. #232323 panel with a 1px
// #3A3A3A inset ring, radius 8, no bevel. Day cells 32 × 32 with radius 4;
// outside-month days dim. The selected day is the light navigation chip with
// dark ink; a range middle is flat #333333; today gets a 2px focus-blue outline.
// Inside a popover the panel drops its own surface and ring.
function CalendarRoot({
	className,
	rootRef,
	...props
}: React.ComponentProps<CustomComponents["Root"]>) {
	return (
		<div
			className={cn(className)}
			data-slot="calendar"
			ref={rootRef}
			{...props}
		/>
	);
}

function CalendarChevron({
	className,
	orientation,
	...props
}: React.ComponentProps<CustomComponents["Chevron"]>) {
	if (orientation === "left") {
		return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
	}
	if (orientation === "right") {
		return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
	}
	return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
}

function CalendarDayButtonAdapter(
	props: React.ComponentProps<CustomComponents["DayButton"]>
) {
	const { dayPickerProps } = useDayPicker();
	return <CalendarDayButton locale={dayPickerProps.locale} {...props} />;
}

function CalendarWeekNumber({
	children,
	...props
}: React.ComponentProps<CustomComponents["WeekNumber"]>) {
	return (
		<td {...props}>
			<div className="flex size-(--cell-size) items-center justify-center text-center">
				{children}
			</div>
		</td>
	);
}

function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	captionLayout = "label",
	buttonVariant = "outline",
	locale,
	formatters,
	components,
	...props
}: React.ComponentProps<typeof DayPicker> & {
	buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
	const defaultClassNames = getDefaultClassNames();

	return (
		<DayPicker
			captionLayout={captionLayout}
			className={cn(
				"group/calendar rounded-card bg-background text-data text-foreground p-3 shadow-[inset_0_0_0_1px_var(--color-workbench-panel-hover)] [--cell-radius:var(--radius-tag)] [--cell-size:--spacing(8)] in-data-[slot=card-content]:bg-transparent in-data-[slot=card-content]:shadow-none in-data-[slot=popover-content]:bg-transparent in-data-[slot=popover-content]:p-0 in-data-[slot=popover-content]:shadow-none",
				String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
				String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
				className
			)}
			classNames={{
				root: cn("w-fit", defaultClassNames.root),
				months: cn(
					"relative flex flex-col gap-6 md:flex-row",
					defaultClassNames.months
				),
				month: cn("flex w-full flex-col gap-3", defaultClassNames.month),
				nav: cn(
					"absolute inset-x-0 top-0 flex h-7 w-full items-center justify-between gap-1",
					defaultClassNames.nav
				),
				button_previous: cn(
					buttonVariants({ variant: buttonVariant, size: "icon-xs" }),
					"aria-disabled:text-workbench-utility-disabled-text [&_svg]:text-muted-foreground select-none [--bevel-depth:3px] [--bevel-edge:var(--color-pixel-utility-low)]! aria-disabled:pointer-events-none",
					defaultClassNames.button_previous
				),
				button_next: cn(
					buttonVariants({ variant: buttonVariant, size: "icon-xs" }),
					"aria-disabled:text-workbench-utility-disabled-text [&_svg]:text-muted-foreground select-none [--bevel-depth:3px] [--bevel-edge:var(--color-pixel-utility-low)]! aria-disabled:pointer-events-none",
					defaultClassNames.button_next
				),
				month_caption: cn(
					"flex h-7 w-full items-center justify-center px-9",
					defaultClassNames.month_caption
				),
				dropdowns: cn(
					"text-data flex h-7 w-full items-center justify-center gap-1.5 font-semibold",
					defaultClassNames.dropdowns
				),
				dropdown_root: cn(
					"relative rounded-(--cell-radius)",
					defaultClassNames.dropdown_root
				),
				dropdown: cn(
					"bg-popover absolute inset-0 opacity-0",
					defaultClassNames.dropdown
				),
				caption_label: cn(
					"text-data font-semibold select-none",
					captionLayout === "label"
						? ""
						: "[&>svg]:text-muted-foreground flex items-center gap-1 rounded-(--cell-radius) [&>svg]:size-3.5",
					defaultClassNames.caption_label
				),
				month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
				weekdays: cn("flex", defaultClassNames.weekdays),
				weekday: cn(
					"text-label text-workbench-faint-text w-(--cell-size) flex-1 rounded-(--cell-radius) font-medium select-none",
					defaultClassNames.weekday
				),
				week: cn("mt-2 flex w-full", defaultClassNames.week),
				week_number_header: cn(
					"w-(--cell-size) select-none",
					defaultClassNames.week_number_header
				),
				week_number: cn(
					"text-label text-workbench-faint-text select-none",
					defaultClassNames.week_number
				),
				day: cn(
					"group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)",
					props.showWeekNumber
						? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-(--cell-radius)"
						: "[&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)",
					defaultClassNames.day
				),
				range_start: cn(
					"rounded-l-(--cell-radius)",
					defaultClassNames.range_start
				),
				range_middle: cn("rounded-none", defaultClassNames.range_middle),
				range_end: cn("rounded-r-(--cell-radius)", defaultClassNames.range_end),
				today: cn("rounded-(--cell-radius)", defaultClassNames.today),
				outside: cn(
					"text-workbench-utility-disabled-text",
					defaultClassNames.outside
				),
				disabled: cn(
					"text-workbench-utility-disabled-text",
					defaultClassNames.disabled
				),
				hidden: cn("invisible", defaultClassNames.hidden),
				...classNames,
			}}
			components={{
				Root: CalendarRoot,
				Chevron: CalendarChevron,
				DayButton: CalendarDayButtonAdapter,
				WeekNumber: CalendarWeekNumber,
				...components,
			}}
			formatters={{
				formatMonthDropdown: (date) =>
					date.toLocaleString(locale?.code, { month: "short" }),
				...formatters,
			}}
			locale={locale}
			showOutsideDays={showOutsideDays}
			{...props}
		/>
	);
}

function CalendarDayButton({
	className,
	day,
	modifiers,
	locale,
	...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
	const defaultClassNames = getDefaultClassNames();

	const ref = React.useRef<HTMLButtonElement>(null);
	React.useEffect(() => {
		if (modifiers.focused) {
			ref.current?.focus();
		}
	}, [modifiers.focused]);

	return (
		<Button
			className={cn(
				"text-data text-foreground relative isolate z-10 flex size-(--cell-size) min-w-(--cell-size) flex-col gap-1 rounded-(--cell-radius) border-0 px-0 leading-none font-normal",
				"group-data-[outside=true]/day:text-workbench-utility-disabled-text group-data-[disabled=true]/day:text-workbench-utility-disabled-text",
				"group-data-[today=true]/day:shadow-[inset_0_0_0_2px_var(--color-workbench-focus)]",
				"data-[range-middle=true]:bg-workbench-panel data-[range-middle=true]:text-foreground data-[range-middle=true]:hover:bg-workbench-panel data-[range-middle=true]:rounded-none",
				"data-[range-end=true]:rounded-l-none data-[range-start=true]:rounded-r-none data-[range-end=true]:data-[range-start=true]:rounded-(--cell-radius)",
				"data-[range-end=true]:bg-workbench-nav data-[range-start=true]:bg-workbench-nav data-[selected-single=true]:bg-workbench-nav data-[range-end=true]:text-workbench-nav-ink data-[range-start=true]:text-workbench-nav-ink data-[selected-single=true]:text-workbench-nav-ink data-[range-end=true]:hover:bg-workbench-nav data-[range-start=true]:hover:bg-workbench-nav data-[selected-single=true]:hover:bg-workbench-nav data-[range-end=true]:font-bold data-[range-start=true]:font-bold data-[selected-single=true]:font-bold",
				"data-[range-end=true]:pb-0.5 data-[range-end=true]:shadow-[inset_0_1px_0_var(--color-workbench-on-selection),inset_0_-2px_0_var(--color-workbench-nav-edge)] data-[range-start=true]:pb-0.5 data-[range-start=true]:shadow-[inset_0_1px_0_var(--color-workbench-on-selection),inset_0_-2px_0_var(--color-workbench-nav-edge)] data-[selected-single=true]:pb-0.5 data-[selected-single=true]:shadow-[inset_0_1px_0_var(--color-workbench-on-selection),inset_0_-2px_0_var(--color-workbench-nav-edge)]",
				"[&>span]:text-label [&>span]:opacity-70",
				defaultClassNames.day,
				className
			)}
			data-day={day.date.toLocaleDateString(locale?.code)}
			data-range-end={modifiers.range_end}
			data-range-middle={modifiers.range_middle}
			data-range-start={modifiers.range_start}
			data-selected-single={
				modifiers.selected &&
				!modifiers.range_start &&
				!modifiers.range_end &&
				!modifiers.range_middle
			}
			ref={ref}
			size="icon"
			variant="ghost"
			{...props}
		/>
	);
}

export { Calendar, CalendarDayButton };
