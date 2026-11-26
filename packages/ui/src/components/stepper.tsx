import { cn } from "@sprite-anvil/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import type * as React from "react";

// Paper · 01 Components · 06 Extra primitives · Stepper. 40px flat plates with no
// bevel (indicators, not buttons): done is the success plate with a check,
// current is the light nav chip with its number, pending is the control plate.
// The status text carries the state; colour never stands alone.
type StepperState = "done" | "current" | "pending";

function Stepper({ className, ...props }: React.ComponentProps<"ol">) {
	return (
		<ol
			className={cn("flex items-start", className)}
			data-slot="stepper"
			{...props}
		/>
	);
}

function StepperItem({
	className,
	state = "pending",
	...props
}: React.ComponentProps<"li"> & { state?: StepperState }) {
	return (
		<li
			aria-current={state === "current" ? "step" : undefined}
			className={cn(
				"group/step flex w-24 shrink-0 flex-col items-center gap-2 text-center",
				className
			)}
			data-slot="stepper-item"
			data-state={state}
			{...props}
		/>
	);
}

function StepperIndicator({
	className,
	children,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"rounded-control text-subhead flex size-10 shrink-0 items-center justify-center font-mono font-semibold",
				"bg-workbench-control text-muted-foreground",
				"group-data-[state=current]/step:bg-workbench-nav group-data-[state=current]/step:text-workbench-nav-ink group-data-[state=current]/step:font-bold",
				"group-data-[state=done]/step:bg-workbench-success group-data-[state=done]/step:text-workbench-on-action",
				className
			)}
			data-slot="stepper-indicator"
			{...props}
		>
			<span className="group-data-[state=done]/step:hidden">{children}</span>
			<CheckIcon
				className="hidden size-[18px] group-data-[state=done]/step:block"
				strokeWidth={3}
			/>
		</span>
	);
}

function StepperTitle({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"text-data text-muted-foreground group-data-[state=current]/step:text-foreground group-data-[state=current]/step:font-semibold",
				className
			)}
			data-slot="stepper-title"
			{...props}
		/>
	);
}

function StepperStatus({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"text-foreground text-label group-data-[state=pending]/step:text-workbench-faint-text font-semibold",
				className
			)}
			data-slot="stepper-status"
			{...props}
		/>
	);
}

/** The dashed link between two steps; `complete` once the step before it is done. */
function StepperSeparator({
	className,
	complete = false,
	...props
}: React.ComponentProps<"li"> & { complete?: boolean }) {
	return (
		<li
			aria-hidden="true"
			className={cn(
				"flex h-10 flex-1 items-center justify-center gap-1",
				className
			)}
			data-complete={complete ? "" : undefined}
			data-slot="stepper-separator"
			{...props}
		>
			<span className="bg-workbench-utility-disabled-text in-data-complete:bg-workbench-success h-[3px] w-2 shrink-0" />
			<span className="bg-workbench-utility-disabled-text in-data-complete:bg-workbench-success h-[3px] w-2 shrink-0" />
		</li>
	);
}

export type { StepperState };
export {
	Stepper,
	StepperIndicator,
	StepperItem,
	StepperSeparator,
	StepperStatus,
	StepperTitle,
};
