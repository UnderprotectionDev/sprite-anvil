import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { ReactNode } from "react";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { Button } from "./button";

interface Props<T> {
	ariaLabel?: string;
	getItemKey: (item: T) => string;
	items: readonly T[];
	renderItem: (item: T) => ReactNode;
}

export function WindowVirtualList<T>({
	ariaLabel,
	items,
	getItemKey,
	renderItem,
}: Props<T>) {
	const listRef = useRef<HTMLUListElement>(null);
	const offset = useRef(0);
	const subscribeToLayout = useCallback((update: () => void) => {
		let frame = 0;
		const measure = () => {
			const node = listRef.current;
			const margin = node
				? node.getBoundingClientRect().top + window.scrollY
				: 0;
			if (offset.current !== margin) {
				offset.current = margin;
				update();
			}
		};
		const scheduleMeasure = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(measure);
		};
		window.addEventListener("resize", scheduleMeasure);
		const observer =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(scheduleMeasure);
		const parent = listRef.current?.parentElement;
		if (parent) {
			observer?.observe(parent);
		}
		measure();
		return () => {
			window.removeEventListener("resize", scheduleMeasure);
			observer?.disconnect();
			cancelAnimationFrame(frame);
		};
	}, []);
	const scrollMargin = useSyncExternalStore(
		subscribeToLayout,
		() => offset.current,
		() => 0
	);
	const virtualizer = useWindowVirtualizer({
		count: items.length,
		estimateSize: () => 160,
		getItemKey: (index) => getItemKey(items[index] as T),
		overscan: 5,
		useAnimationFrameWithResizeObserver: true,
		initialRect: { width: 1024, height: 800 },
		scrollMargin,
	});
	const virtualItems = virtualizer.getVirtualItems();
	const first = virtualItems[0]?.index ?? 0;
	const last = virtualItems.at(-1)?.index ?? 0;
	return (
		<>
			{items.length > 20 && (
				<Button
					disabled={first === 0}
					onClick={() =>
						virtualizer.scrollToIndex(Math.max(0, first - 1), {
							align: "start",
						})
					}
					type="button"
				>
					Previous results
				</Button>
			)}
			<ul
				aria-label={ariaLabel}
				ref={listRef}
				style={{ height: virtualizer.getTotalSize(), position: "relative" }}
			>
				{virtualItems.map((row) => (
					<li
						aria-posinset={row.index + 1}
						aria-setsize={items.length}
						data-index={row.index}
						key={row.key}
						ref={(node) => {
							if (node && node.getBoundingClientRect().height > 0) {
								virtualizer.measureElement(node);
							}
						}}
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							width: "100%",
							transform: `translateY(${row.start - scrollMargin}px)`,
							paddingBottom: 12,
						}}
					>
						{renderItem(items[row.index] as T)}
					</li>
				))}
			</ul>
			{items.length > 20 && (
				<Button
					disabled={last >= items.length - 1}
					onClick={() =>
						virtualizer.scrollToIndex(Math.min(items.length - 1, last + 1), {
							align: "start",
						})
					}
					type="button"
				>
					Next results
				</Button>
			)}
		</>
	);
}
