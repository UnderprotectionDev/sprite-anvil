"use client";

import { cn } from "@sprite-anvil/ui/lib/utils";
import type * as React from "react";
import { createContext, use, useCallback, useEffect, useState } from "react";

// Paper · 06 Extra primitives · Scrollspy. An in-page index beside a scrolling
// list: each 40px link jumps to its section and the one in view is marked with
// a 3px #EBEBEB bar and a 700 label; the others keep a #3A3A3A bar.

/** Distance (px) below the container top at which a section counts as in view. */
const ACTIVE_OFFSET = 8;

function prefersReducedMotion() {
	return (
		typeof window !== "undefined" &&
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
	);
}

/**
 * Tracks which of `ids` is in view inside the scroll container `root` (the
 * window when `root` is null): the last section whose top has reached the
 * container top, or the last section once the container is scrolled to its end.
 */
function useScrollspy(
	ids: readonly string[],
	root: HTMLElement | null,
	{ offset = ACTIVE_OFFSET }: { offset?: number } = {}
) {
	const [activeId, setActiveId] = useState<string | undefined>(ids[0]);

	const update = useCallback(() => {
		const rootTop = root ? root.getBoundingClientRect().top : 0;
		const atEnd = root
			? root.scrollTop + root.clientHeight >= root.scrollHeight - 1
			: window.scrollY + window.innerHeight >=
				document.documentElement.scrollHeight - 1;
		let next: string | undefined = ids[0];
		for (const id of ids) {
			const element = document.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
			if (element && element.getBoundingClientRect().top - rootTop <= offset) {
				next = id;
			}
		}
		if (atEnd && ids.length > 0) {
			next = ids.at(-1);
		}
		setActiveId(next);
	}, [ids, root, offset]);

	useEffect(() => {
		const target: HTMLElement | Window = root ?? window;
		let frame = 0;
		const onScroll = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(update);
		};
		update();
		target.addEventListener("scroll", onScroll, { passive: true });
		const resize = new ResizeObserver(onScroll);
		if (root) {
			resize.observe(root);
		}
		return () => {
			cancelAnimationFrame(frame);
			target.removeEventListener("scroll", onScroll);
			resize.disconnect();
		};
	}, [root, update]);

	return activeId;
}

/**
 * Scrolls a section to the top of `root` (the window when null) without
 * scrolling any outer container, then moves focus to the section.
 */
function scrollToSection(id: string, root: HTMLElement | null = null) {
	const element = document.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
	if (!element) {
		return;
	}
	const behavior = prefersReducedMotion() ? "auto" : "smooth";
	const { top } = element.getBoundingClientRect();
	if (root) {
		const box = root.getBoundingClientRect();
		// Client rects include CSS zoom; scrollTop does not.
		const scale = root.offsetHeight > 0 ? box.height / root.offsetHeight : 1;
		root.scrollTo({
			behavior,
			top: root.scrollTop + (top - box.top) / scale,
		});
	} else {
		window.scrollTo({ behavior, top: window.scrollY + top });
	}
	if (!element.hasAttribute("tabindex")) {
		element.setAttribute("tabindex", "-1");
	}
	element.focus({ preventScroll: true });
}

const ScrollspyRootContext = createContext<HTMLElement | null>(null);

/** The index. `root` is the scroll container its links scroll (window if null). */
function Scrollspy({
	root = null,
	className,
	...props
}: React.ComponentProps<"nav"> & { root?: HTMLElement | null }) {
	return (
		<ScrollspyRootContext value={root}>
			<nav
				className={cn("flex flex-col", className)}
				data-slot="scrollspy"
				{...props}
			/>
		</ScrollspyRootContext>
	);
}

function ScrollspyLink({
	active = false,
	targetId,
	className,
	onClick,
	...props
}: Omit<React.ComponentProps<"a">, "href"> & {
	active?: boolean;
	targetId: string;
}) {
	const root = use(ScrollspyRootContext);
	return (
		<a
			aria-current={active ? "location" : undefined}
			className={cn(
				"border-workbench-panel-hover text-data text-workbench-muted-text hover:text-workbench-text focus-visible:focus-ring data-active:border-workbench-nav data-active:text-workbench-text flex h-10 shrink-0 items-center border-l-[3px] pl-3.5 leading-5 outline-0 transition-colors duration-120 data-active:font-bold",
				className
			)}
			data-active={active ? "" : undefined}
			data-slot="scrollspy-link"
			href={`#${targetId}`}
			onClick={(event) => {
				onClick?.(event);
				if (event.defaultPrevented) {
					return;
				}
				event.preventDefault();
				scrollToSection(targetId, root);
			}}
			{...props}
		/>
	);
}

export { Scrollspy, ScrollspyLink, scrollToSection, useScrollspy };
