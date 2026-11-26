import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "@sprite-anvil/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

// Paper · 01 Components · Button. Raised flat face, 1px top light, 3px dark bottom
// edge (2px on the 28px size). Pressing drops the face 2px and shrinks the edge to 1px.
const buttonVariants = cva(
	"group/button focus-visible:focus-ring aria-invalid:outline-destructive aria-invalid:focus-visible:outline-destructive! disabled:bg-pixel-utility-low disabled:text-workbench-utility-disabled-text inline-flex shrink-0 items-center justify-center pb-(--bevel-depth) whitespace-nowrap transition-colors duration-120 select-none disabled:pointer-events-none disabled:shadow-none aria-invalid:outline-2 aria-invalid:outline-offset-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
	{
		variants: {
			variant: {
				default:
					"bevel bevel-action rounded-control bg-primary text-primary-foreground hover:bg-workbench-action-hover active:bg-workbench-action-pressed font-extrabold active:[--bevel-depth:1px] active:[--bevel-light:transparent] active:not-aria-[haspopup]:translate-y-0.5",
				outline:
					"bevel bevel-utility rounded-control bg-workbench-utility text-foreground hover:bg-workbench-utility-hover aria-expanded:bg-workbench-utility-hover active:bg-workbench-utility-pressed font-semibold active:[--bevel-depth:1px] active:[--bevel-light:transparent] active:not-aria-[haspopup]:translate-y-0.5",
				secondary:
					"bevel bevel-utility rounded-control bg-workbench-utility text-foreground hover:bg-workbench-utility-hover aria-expanded:bg-workbench-utility-hover active:bg-workbench-utility-pressed font-semibold active:[--bevel-depth:1px] active:[--bevel-light:transparent] active:not-aria-[haspopup]:translate-y-0.5",
				ghost:
					"rounded-control text-foreground hover:bg-accent aria-expanded:bg-accent active:bg-workbench-utility-pressed bg-transparent font-semibold [--bevel-depth:0px] disabled:bg-transparent",
				destructive:
					"bevel bevel-danger rounded-control bg-destructive text-destructive-foreground hover:bg-workbench-danger-hover active:bg-workbench-danger-pressed font-bold active:[--bevel-depth:1px] active:[--bevel-light:transparent] active:not-aria-[haspopup]:translate-y-0.5",
				link: "rounded-control text-workbench-link hover:text-workbench-action-light bg-transparent font-semibold underline underline-offset-4 [--bevel-depth:0px] disabled:bg-transparent",
			},
			size: {
				default:
					"text-action h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
				xs: "bevel-edge rounded-control-sm text-label h-7 gap-1.5 px-3 [--bevel-depth:2px] active:[--bevel-depth:1px] active:[--bevel-light:transparent] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
				sm: "text-action h-9 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
				lg: "text-action h-11 gap-2 px-6 has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
				icon: "size-11 px-0",
				"icon-xs":
					"bevel-edge rounded-control-sm size-7 px-0 [--bevel-depth:2px] active:[--bevel-depth:1px] active:[--bevel-light:transparent] [&_svg:not([class*='size-'])]:size-3.5",
				"icon-sm": "size-9 px-0",
				"icon-lg": "size-11 px-0",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	}
);

function Button({
	className,
	variant = "default",
	size = "default",
	...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
	return (
		<ButtonPrimitive
			className={cn(buttonVariants({ variant, size, className }))}
			data-slot="button"
			{...props}
		/>
	);
}

export { Button, buttonVariants };
