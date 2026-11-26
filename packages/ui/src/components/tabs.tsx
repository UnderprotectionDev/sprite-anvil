import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@sprite-anvil/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

function Tabs({
	className,
	orientation = "horizontal",
	...props
}: TabsPrimitive.Root.Props) {
	return (
		<TabsPrimitive.Root
			className={cn(
				"group/tabs flex gap-2 data-horizontal:flex-col",
				className
			)}
			data-orientation={orientation}
			data-slot="tabs"
			{...props}
		/>
	);
}

// Paper · 01 Components · Tabs. `default` is the recessed view switch: a #141414
// well whose active segment is the raised #EBEBEB nav chip. `line` is the app tab
// recipe: a #191919 bar, a #232323 active tab and a 2px selection-blue top line.
// `raised` (Paper · 06 Tabs counter / Tabs vertical) sets every trigger as its own
// 40px raised #3F3F3F plate, gap 8; the active one is the #EBEBEB nav chip, or a
// flat #333333 panel row when the list is vertical.
const tabsListVariants = cva(
	"group/tabs-list text-workbench-muted-text inline-flex w-fit items-center group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col group-data-vertical/tabs:items-stretch",
	{
		variants: {
			variant: {
				default:
					"rounded-control border-pixel-edge bg-workbench-preview gap-0.5 border p-0.5 shadow-[inset_0_1px_2px_var(--color-workbench-well-shade),inset_0_-1px_0_var(--color-workbench-well-light),0_1px_0_var(--color-workbench-well-rim)]",
				line: "bg-workbench-sidebar gap-1 rounded-none",
				raised: "gap-2",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	}
);

function TabsList({
	className,
	variant = "default",
	...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
	return (
		<TabsPrimitive.List
			className={cn(tabsListVariants({ variant }), className)}
			data-slot="tabs-list"
			data-variant={variant}
			{...props}
		/>
	);
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
	return (
		<TabsPrimitive.Tab
			className={cn(
				"group/tabs-trigger text-data text-workbench-muted-text hover:text-workbench-text focus-visible:focus-ring data-disabled:text-workbench-faint-text relative inline-flex flex-1 items-center justify-center gap-2 px-3 font-medium whitespace-nowrap transition-colors duration-120 outline-none group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start focus-visible:z-10 data-disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				// Recessed view switch: the active segment is the raised nav chip.
				"group-data-[variant=default]/tabs-list:rounded-control-sm group-data-[variant=default]/tabs-list:data-active:bevel group-data-[variant=default]/tabs-list:data-active:bevel-nav group-data-[variant=default]/tabs-list:data-active:bg-workbench-nav group-data-[variant=default]/tabs-list:data-active:text-workbench-nav-ink group-data-[variant=default]/tabs-list:h-7.5 group-data-[variant=default]/tabs-list:data-active:pb-(--bevel-depth) group-data-[variant=default]/tabs-list:data-active:font-bold group-data-[variant=default]/tabs-list:data-active:[--bevel-depth:2px]",
				// Raised tabs: separate plates; active is the nav chip (flat panel row when vertical).
				"group-data-[variant=raised]/tabs-list:rounded-control group-data-[variant=raised]/tabs-list:bevel group-data-[variant=raised]/tabs-list:bevel-utility group-data-[variant=raised]/tabs-list:bg-workbench-control group-data-[variant=raised]/tabs-list:text-action group-data-[variant=raised]/tabs-list:text-workbench-text group-data-[variant=raised]/tabs-list:hover:bg-workbench-utility-hover group-data-[variant=raised]/tabs-list:data-active:bevel-nav group-data-[variant=raised]/tabs-list:data-active:bg-workbench-nav group-data-[variant=raised]/tabs-list:data-active:text-workbench-nav-ink group-data-vertical/tabs:group-data-[variant=raised]/tabs-list:data-active:bg-workbench-panel group-data-vertical/tabs:group-data-[variant=raised]/tabs-list:data-active:text-workbench-text group-data-[variant=raised]/tabs-list:h-10 group-data-[variant=raised]/tabs-list:flex-none group-data-[variant=raised]/tabs-list:pr-3.5 group-data-[variant=raised]/tabs-list:pb-(--bevel-depth) group-data-[variant=raised]/tabs-list:pl-4 group-data-[variant=raised]/tabs-list:leading-[18px] group-data-[variant=raised]/tabs-list:font-semibold group-data-vertical/tabs:group-data-[variant=raised]/tabs-list:px-4 group-data-[variant=raised]/tabs-list:data-active:font-bold group-data-vertical/tabs:group-data-[variant=raised]/tabs-list:data-active:pb-0 group-data-vertical/tabs:group-data-[variant=raised]/tabs-list:data-active:shadow-none",
				// App tabs: flat bar, active tab lifts to the panel ground with a top line.
				"group-data-[variant=line]/tabs-list:rounded-t-tag group-data-[variant=line]/tabs-list:hover:bg-workbench-strip group-data-[variant=line]/tabs-list:data-active:hover:bg-workbench-background group-data-[variant=line]/tabs-list:data-active:bg-workbench-background group-data-[variant=line]/tabs-list:data-active:text-workbench-text group-data-[variant=line]/tabs-list:h-9 group-data-[variant=line]/tabs-list:flex-none group-data-[variant=line]/tabs-list:data-active:font-semibold",
				"after:bg-workbench-selection after:absolute after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-1.5 group-data-horizontal/tabs:after:top-0 group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-1.5 group-data-vertical/tabs:after:left-0 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
				className
			)}
			data-slot="tabs-trigger"
			{...props}
		/>
	);
}

/** A Geist Mono count beside a tab label (versions, checks, clips). */
function TabsCount({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"text-label text-workbench-faint-text group-data-active/tabs-trigger:text-workbench-muted-text group-data-[variant=default]/tabs-list:group-data-active/tabs-trigger:text-workbench-utility-disabled-text font-mono font-normal",
				className
			)}
			data-slot="tabs-count"
			{...props}
		/>
	);
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
	return (
		<TabsPrimitive.Panel
			className={cn(
				"text-data focus-visible:focus-ring flex-1 outline-none",
				className
			)}
			data-slot="tabs-content"
			{...props}
		/>
	);
}

function scrollBehavior(): ScrollBehavior {
	return typeof window !== "undefined" &&
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
		? "auto"
		: "smooth";
}

/** Scrolls `viewport` the least distance that shows `tab` whole. */
function revealTab(viewport: HTMLElement, tab: Element) {
	const view = viewport.getBoundingClientRect();
	const rect = tab.getBoundingClientRect();
	if (view.width === 0) {
		return;
	}
	// A tab wider than the strip aligns to its start edge.
	const delta =
		rect.left < view.left || rect.width > view.width
			? rect.left - view.left
			: Math.max(0, rect.right - view.right);
	if (delta !== 0) {
		viewport.scrollBy({ behavior: scrollBehavior(), left: delta });
	}
}

// Paper · 06 Extra primitives · Scrollable tabs. 32px raised #3F3F3F arrow
// buttons (radius 6) either side of a clipped strip move by one tab; the
// selected tab is always scrolled into view and the strip is clipped, never
// faded. An arrow at its end keeps its face and bevel and dims only its icon
// to #7A7A7A. The arrows are pointer affordances: keyboard users move with the
// tab list's own arrow keys, so the buttons stay out of the Tab order.
const TABS_SCROLL_BUTTON =
	"bevel bevel-utility rounded-control-sm bg-workbench-control text-workbench-text hover:bg-workbench-utility-hover disabled:text-workbench-utility-disabled-text inline-flex size-8 shrink-0 items-center justify-center pb-(--bevel-depth) transition-colors duration-120 outline-0 disabled:pointer-events-none [&_svg]:size-4";

function TabsScroller({
	className,
	children,
	scrollBackLabel = "Scroll tabs back",
	scrollForwardLabel = "Scroll tabs forward",
	...props
}: React.ComponentProps<"div"> & {
	scrollBackLabel?: string;
	scrollForwardLabel?: string;
}) {
	const viewportRef = useRef<HTMLDivElement>(null);
	const [atStart, setAtStart] = useState(true);
	const [atEnd, setAtEnd] = useState(true);

	const syncEdges = useCallback(() => {
		const viewport = viewportRef.current;
		if (!viewport) {
			return;
		}
		setAtStart(viewport.scrollLeft <= 0);
		setAtEnd(
			viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 1
		);
	}, []);

	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) {
			return;
		}
		const revealActive = () => {
			const active = viewport.querySelector(
				'[role="tab"][aria-selected="true"]'
			);
			if (active) {
				revealTab(viewport, active);
			}
		};
		revealActive();
		syncEdges();
		viewport.addEventListener("scroll", syncEdges, { passive: true });
		const resize = new ResizeObserver(() => {
			syncEdges();
			revealActive();
		});
		resize.observe(viewport);
		for (const child of viewport.children) {
			resize.observe(child);
		}
		const selection = new MutationObserver(revealActive);
		selection.observe(viewport, {
			attributeFilter: ["aria-selected"],
			subtree: true,
		});
		return () => {
			viewport.removeEventListener("scroll", syncEdges);
			resize.disconnect();
			selection.disconnect();
		};
	}, [syncEdges]);

	const step = (direction: -1 | 1) => {
		const viewport = viewportRef.current;
		if (!viewport) {
			return;
		}
		const view = viewport.getBoundingClientRect();
		const tabs = [...viewport.querySelectorAll('[role="tab"]')];
		const target =
			direction < 0
				? tabs.findLast(
						(tab) => tab.getBoundingClientRect().left < view.left - 1
					)
				: tabs.find(
						(tab) => tab.getBoundingClientRect().right > view.right + 1
					);
		if (target) {
			revealTab(viewport, target);
		}
	};

	return (
		<div
			className={cn("flex min-w-0 items-center gap-2", className)}
			data-slot="tabs-scroller"
			{...props}
		>
			<button
				aria-label={scrollBackLabel}
				className={TABS_SCROLL_BUTTON}
				data-slot="tabs-scroll-button"
				disabled={atStart}
				onClick={() => step(-1)}
				tabIndex={-1}
				type="button"
			>
				<ChevronLeftIcon aria-hidden="true" />
			</button>
			<div
				className="-m-1 flex min-w-0 flex-1 scroll-px-1 [scrollbar-width:none] overflow-x-auto overscroll-x-contain p-1 [&::-webkit-scrollbar]:hidden"
				data-slot="tabs-scroll-viewport"
				ref={viewportRef}
			>
				{children}
			</div>
			<button
				aria-label={scrollForwardLabel}
				className={TABS_SCROLL_BUTTON}
				data-slot="tabs-scroll-button"
				disabled={atEnd}
				onClick={() => step(1)}
				tabIndex={-1}
				type="button"
			>
				<ChevronRightIcon aria-hidden="true" />
			</button>
		</div>
	);
}

export {
	Tabs,
	TabsContent,
	TabsCount,
	TabsList,
	TabsScroller,
	TabsTrigger,
	tabsListVariants,
};
