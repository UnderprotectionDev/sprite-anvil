import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { Button } from "./button";

interface Props<T> {
	getItemKey: (item: T) => string;
	items: readonly T[];
	renderItem: (item: T) => ReactNode;
}

export function WindowVirtualList<T>({
	items,
	getItemKey,
	renderItem,
}: Props<T>) {
	const listRef = useRef<HTMLUListElement>(null);
	const [scrollMargin, setScrollMargin] = useState(0);
	useLayoutEffect(() => {
		const update = () =>
			setScrollMargin(
				(listRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY
			);
		update();
		window.addEventListener("resize", update);
		const observer =
			typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
		if (listRef.current?.parentElement) {
			observer?.observe(listRef.current.parentElement);
		}
		return () => {
			window.removeEventListener("resize", update);
			observer?.disconnect();
		};
	}, []);
	const virtualizer = useWindowVirtualizer({
		count: items.length,
		estimateSize: () => 160,
		getItemKey: (index) => getItemKey(items[index] as T),
		overscan: 5,
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
