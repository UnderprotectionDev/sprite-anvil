import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "@sprite-anvil/ui/lib/utils";

// Paper · 02 Display + feedback · Progress. Determinate work with a known end, always
// labelled with the task (Inter 14 600) and value (Geist Mono 13). An 8px #141414
// track (radius 4) holds a 6px data-cyan fill that sits on the top edge.

function Progress({
	className,
	children,
	value,
	...props
}: ProgressPrimitive.Root.Props) {
	return (
		<ProgressPrimitive.Root
			className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-2", className)}
			data-slot="progress"
			value={value}
			{...props}
		>
			{children}
			<ProgressTrack>
				<ProgressIndicator />
			</ProgressTrack>
		</ProgressPrimitive.Root>
	);
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
	return (
		<ProgressPrimitive.Track
			className={cn(
				"rounded-tag bg-workbench-preview relative flex h-2 w-full items-start overflow-x-hidden",
				className
			)}
			data-slot="progress-track"
			{...props}
		/>
	);
}

function ProgressIndicator({
	className,
	...props
}: ProgressPrimitive.Indicator.Props) {
	return (
		<ProgressPrimitive.Indicator
			className={cn(
				"bg-workbench-data h-1.5 rounded-[3px] transition-all",
				className
			)}
			data-slot="progress-indicator"
			{...props}
		/>
	);
}

function ProgressLabel({ className, ...props }: ProgressPrimitive.Label.Props) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: Base UI Progress.Label labels the progress root through aria-labelledby, not a form control.
		<ProgressPrimitive.Label
			className={cn("text-data text-workbench-text font-semibold", className)}
			data-slot="progress-label"
			{...props}
		/>
	);
}

function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props) {
	return (
		<ProgressPrimitive.Value
			className={cn(
				"text-label text-workbench-text ml-auto font-mono tabular-nums",
				className
			)}
			data-slot="progress-value"
			{...props}
		/>
	);
}

export {
	Progress,
	ProgressIndicator,
	ProgressLabel,
	ProgressTrack,
	ProgressValue,
};
