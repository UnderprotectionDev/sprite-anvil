import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Separator } from "@sprite-anvil/ui/components/separator";
import { cn } from "@sprite-anvil/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

// Paper · 01 Components · Button Group. Joined buttons share one 8px outer
// contour with square inner corners; a 1px #0A0A0A separator splits them.
const buttonGroupVariants = cva(
	"rounded-control flex w-fit items-stretch *:focus-visible:relative *:focus-visible:z-10 *:active:translate-y-0! has-[>[data-slot=button-group]]:gap-2 [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
	{
		variants: {
			orientation: {
				// Corners key off slotted siblings, not :first/:last-child, so the focus
				// guards an open menu inserts after its trigger keep the outer radius.
				horizontal:
					"[&>[data-slot]:has(~[data-slot])]:rounded-r-none [&>[data-slot]~[data-slot]]:rounded-l-none [&>[data-slot]~[data-slot]]:border-l-0",
				vertical:
					"flex-col [&>[data-slot]:has(~[data-slot])]:rounded-b-none [&>[data-slot]~[data-slot]]:rounded-t-none [&>[data-slot]~[data-slot]]:border-t-0",
			},
		},
		defaultVariants: {
			orientation: "horizontal",
		},
	}
);

function ButtonGroup({
	className,
	orientation,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
	return (
		<div
			className={cn(buttonGroupVariants({ orientation }), className)}
			data-orientation={orientation}
			data-slot="button-group"
			role="group"
			{...props}
		/>
	);
}

function ButtonGroupText({
	className,
	render,
	...props
}: useRender.ComponentProps<"div">) {
	return useRender({
		defaultTagName: "div",
		props: mergeProps<"div">(
			{
				className: cn(
					"rounded-control border-pixel-edge bg-pixel-utility-low text-data text-workbench-muted-text flex items-center gap-2 border px-3 font-medium [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
					className
				),
			},
			props
		),
		render,
		state: {
			slot: "button-group-text",
		},
	});
}

function ButtonGroupSeparator({
	className,
	orientation = "vertical",
	...props
}: React.ComponentProps<typeof Separator>) {
	return (
		<Separator
			className={cn(
				"bg-pixel-edge relative shrink-0 self-stretch data-horizontal:h-px data-horizontal:w-auto data-vertical:h-auto data-vertical:w-px",
				className
			)}
			data-slot="button-group-separator"
			orientation={orientation}
			{...props}
		/>
	);
}

export {
	ButtonGroup,
	ButtonGroupSeparator,
	ButtonGroupText,
	buttonGroupVariants,
};
