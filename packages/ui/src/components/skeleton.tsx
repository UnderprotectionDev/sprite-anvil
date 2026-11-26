import { cn } from "@sprite-anvil/ui/lib/utils";

// Paper · 02 Display + feedback · Skeleton. #3F3F3F bars (radius 4) that mirror the
// layout they stand in for, on the #2A2A2A surface.

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"rounded-tag bg-workbench-control animate-pulse",
				className
			)}
			data-slot="skeleton"
			{...props}
		/>
	);
}

export { Skeleton };
