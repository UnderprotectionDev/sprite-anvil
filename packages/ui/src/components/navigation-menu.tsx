import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu";
import { menuPanelClassName } from "@sprite-anvil/ui/lib/menu-recipe";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { cva } from "class-variance-authority";
import { ChevronDownIcon } from "lucide-react";

function NavigationMenu({
	align = "start",
	className,
	children,
	...props
}: NavigationMenuPrimitive.Root.Props &
	Pick<NavigationMenuPrimitive.Positioner.Props, "align">) {
	return (
		<NavigationMenuPrimitive.Root
			className={cn(
				"group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
				className
			)}
			data-slot="navigation-menu"
			{...props}
		>
			{children}
			<NavigationMenuPositioner align={align} />
		</NavigationMenuPrimitive.Root>
	);
}

function NavigationMenuList({
	className,
	...props
}: React.ComponentPropsWithRef<typeof NavigationMenuPrimitive.List>) {
	return (
		<NavigationMenuPrimitive.List
			className={cn(
				"group flex flex-1 list-none items-center justify-center gap-1",
				className
			)}
			data-slot="navigation-menu-list"
			{...props}
		/>
	);
}

function NavigationMenuItem({
	className,
	...props
}: React.ComponentPropsWithRef<typeof NavigationMenuPrimitive.Item>) {
	return (
		<NavigationMenuPrimitive.Item
			className={cn("relative", className)}
			data-slot="navigation-menu-item"
			{...props}
		/>
	);
}

const navigationMenuTriggerStyle = cva(
	"group/navigation-menu-trigger rounded-control text-data text-workbench-muted-text hover:bg-workbench-control hover:text-workbench-text focus-visible:focus-ring disabled:text-workbench-utility-disabled-text data-popup-open:border-pixel-edge data-popup-open:bg-workbench-preview data-popup-open:text-workbench-text data-open:border-pixel-edge data-open:bg-workbench-preview data-open:text-workbench-text inline-flex h-9 w-max items-center justify-center gap-1.5 border border-transparent px-3 py-0 font-medium transition-colors duration-120 outline-none disabled:pointer-events-none data-open:font-bold data-popup-open:font-bold data-popup-open:shadow-[inset_0_1px_2px_var(--color-workbench-well-shade),inset_0_-1px_0_var(--color-workbench-well-light),0_1px_0_var(--color-workbench-well-rim)]"
);

function NavigationMenuTrigger({
	className,
	children,
	...props
}: NavigationMenuPrimitive.Trigger.Props) {
	return (
		<NavigationMenuPrimitive.Trigger
			className={cn(navigationMenuTriggerStyle(), "group", className)}
			data-slot="navigation-menu-trigger"
			{...props}
		>
			{children}
			<ChevronDownIcon
				aria-hidden="true"
				className="text-workbench-faint-text group-data-open/navigation-menu-trigger:text-workbench-text group-data-popup-open/navigation-menu-trigger:text-workbench-text size-3.5 shrink-0 transition duration-300 group-data-open/navigation-menu-trigger:rotate-180 group-data-popup-open/navigation-menu-trigger:rotate-180"
			/>
		</NavigationMenuPrimitive.Trigger>
	);
}

function NavigationMenuContent({
	className,
	...props
}: NavigationMenuPrimitive.Content.Props) {
	return (
		<NavigationMenuPrimitive.Content
			className={cn(
				"data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out h-full w-auto p-2 transition-[opacity,transform,translate] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:opacity-0 data-ending-style:data-activation-direction=left:translate-x-[50%] data-ending-style:data-activation-direction=right:translate-x-[-50%] data-starting-style:opacity-0 data-starting-style:data-activation-direction=left:translate-x-[-50%] data-starting-style:data-activation-direction=right:translate-x-[50%]",
				className
			)}
			data-slot="navigation-menu-content"
			{...props}
		/>
	);
}

function NavigationMenuPositioner({
	className,
	side = "bottom",
	sideOffset = 8,
	align = "start",
	alignOffset = 0,
	...props
}: NavigationMenuPrimitive.Positioner.Props) {
	return (
		<NavigationMenuPrimitive.Portal>
			<NavigationMenuPrimitive.Positioner
				align={align}
				alignOffset={alignOffset}
				className={cn(
					"isolate z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none data-[side=bottom]:before:top-[-10px] data-[side=bottom]:before:right-0 data-[side=bottom]:before:left-0",
					className
				)}
				side={side}
				sideOffset={sideOffset}
				{...props}
			>
				<NavigationMenuPrimitive.Popup
					className={cn(
						menuPanelClassName,
						"data-[ending-style]:easing-[ease] xs:w-(--popup-width) relative box-content h-(--popup-height) w-(--popup-width) origin-(--transform-origin) p-0 transition-[opacity,transform,width,height,scale,translate] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:scale-90 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-90 data-starting-style:opacity-0"
					)}
				>
					<NavigationMenuPrimitive.Viewport className="relative size-full overflow-hidden" />
				</NavigationMenuPrimitive.Popup>
			</NavigationMenuPrimitive.Positioner>
		</NavigationMenuPrimitive.Portal>
	);
}

function NavigationMenuLink({
	className,
	...props
}: NavigationMenuPrimitive.Link.Props) {
	return (
		<NavigationMenuPrimitive.Link
			className={cn(
				"rounded-control-sm text-data text-workbench-text hover:bg-workbench-background focus-visible:bg-workbench-background focus-visible:focus-ring data-active:bg-workbench-background flex flex-col gap-1 p-3 transition-colors duration-120 outline-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-slot="navigation-menu-link"
			{...props}
		/>
	);
}

function NavigationMenuIndicator({
	className,
	...props
}: React.ComponentPropsWithRef<typeof NavigationMenuPrimitive.Icon>) {
	return (
		<NavigationMenuPrimitive.Icon
			className={cn(
				"data-[state=hidden]:fade-out data-[state=visible]:fade-in data-[state=hidden]:animate-out data-[state=visible]:animate-in top-full z-1 flex h-1.5 items-end justify-center overflow-hidden",
				className
			)}
			data-slot="navigation-menu-indicator"
			{...props}
		>
			<div className="border-pixel-edge bg-workbench-preview relative top-[60%] h-2 w-2 rotate-45 rounded-none border" />
		</NavigationMenuPrimitive.Icon>
	);
}

export {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuIndicator,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuPositioner,
	NavigationMenuTrigger,
	navigationMenuTriggerStyle,
};
