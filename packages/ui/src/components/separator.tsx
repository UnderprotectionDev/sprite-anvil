"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "@sprite-anvil/ui/lib/utils";

// Paper · 02 Display + feedback · Separator. A 1px #303030 line: horizontal between
// blocks, vertical between toolbar groups.

function Separator({
	className,
	orientation = "horizontal",
	...props
}: SeparatorPrimitive.Props) {
	return (
		<SeparatorPrimitive
			className={cn(
				"bg-workbench-divider shrink-0 data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
				className
			)}
			data-slot="separator"
			orientation={orientation}
			{...props}
		/>
	);
}

export { Separator };
