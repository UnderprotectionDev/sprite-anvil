import { cn } from "@sprite-anvil/ui/lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
	return (
		<kbd
			className={cn(
				"rounded-tag bg-workbench-control text-workbench-muted-text pointer-events-none inline-flex h-[22px] w-fit min-w-[22px] items-center justify-center gap-1 px-1.5 font-mono text-[12px] leading-4 select-none [&_svg:not([class*='size-'])]:size-3",
				className
			)}
			data-slot="kbd"
			{...props}
		/>
	);
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<kbd
			className={cn("inline-flex items-center gap-1", className)}
			data-slot="kbd-group"
			{...props}
		/>
	);
}

export { Kbd, KbdGroup };
