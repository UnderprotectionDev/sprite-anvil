import type { PixelOperation, PixelRect } from "@sprite-anvil/api/pixel-editor";
import { useStore } from "@tanstack/react-store";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { paintScene } from "../../lib/canvas-scene";
import {
	type Cell,
	cellFromPoint,
	moveRect,
	rectFromCells,
	rgbaToHex,
} from "../../lib/pixel-geometry";
import {
	type PixelEditorToolStore,
	patchToolState,
} from "../../store/pixel-editor-tool-store";

interface PixelCanvasProps {
	changedBox?: PixelRect | null;
	disabled: boolean;
	image: HTMLImageElement | null;
	interactive: boolean;
	label: string;
	onOperation: (operation: PixelOperation) => void;
	size: { height: number; width: number };
	store: PixelEditorToolStore;
	underlay?: HTMLImageElement | null;
}

const cursorSteps: Record<string, Cell> = {
	ArrowLeft: { x: -1, y: 0 },
	ArrowRight: { x: 1, y: 0 },
	ArrowUp: { x: 0, y: -1 },
	ArrowDown: { x: 0, y: 1 },
};

function readPixelColor(image: HTMLImageElement, cell: Cell) {
	const probe = document.createElement("canvas");
	probe.width = image.naturalWidth;
	probe.height = image.naturalHeight;
	const context = probe.getContext("2d", { willReadFrequently: true });
	if (!context) {
		return null;
	}
	context.drawImage(image, 0, 0);
	const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(
		cell.x,
		cell.y,
		1,
		1
	).data;
	return a === 0 ? "#00000000" : rgbaToHex(r, g, b, a);
}

export function PixelCanvas({
	changedBox,
	disabled,
	image,
	interactive,
	label,
	onOperation,
	size,
	store,
	underlay,
}: PixelCanvasProps) {
	const state = useStore(store, (current) => current);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [anchor, setAnchor] = useState<Cell | null>(null);
	const [hover, setHover] = useState<Cell | null>(null);
	const [path, setPath] = useState<Cell[]>([]);
	const [notice, setNotice] = useState("");
	const { zoom } = state;
	const width = size.width * zoom;
	const height = size.height * zoom;

	useEffect(() => {
		const context = canvasRef.current?.getContext("2d");
		if (context) {
			paintScene(context, {
				anchor,
				changedBox,
				hover,
				image,
				interactive,
				path,
				size,
				state,
				underlay,
			});
		}
	}, [
		anchor,
		changedBox,
		hover,
		image,
		interactive,
		path,
		size,
		state,
		underlay,
	]);

	function reset() {
		setAnchor(null);
		setPath([]);
	}

	function cancel() {
		if (anchor) {
			setNotice("Cancelled.");
		}
		reset();
	}

	function begin(cell: Cell) {
		if (disabled) {
			return;
		}
		if (state.tool === "picker") {
			const picked = image ? readPixelColor(image, cell) : null;
			if (picked) {
				patchToolState(store, { color: picked });
			}
			return;
		}
		if (state.tool === "fill") {
			onOperation({ type: "fill", color: state.color, at: cell });
			return;
		}
		if (state.tool === "move" && !state.selection) {
			setNotice("Select an area first with the Select tool, then use Move.");
			return;
		}
		setNotice("");
		setAnchor(cell);
		setPath(state.tool === "pen" || state.tool === "eraser" ? [cell] : []);
	}

	function complete(cell: Cell) {
		if (!anchor) {
			return;
		}
		const { tool, color, brushSize, selection } = state;
		if (tool === "pen") {
			onOperation({ type: "pen", color, size: brushSize, points: path });
		} else if (tool === "eraser") {
			onOperation({ type: "eraser", size: brushSize, points: path });
		} else if (tool === "line") {
			onOperation({
				type: "line",
				color,
				size: brushSize,
				from: anchor,
				to: cell,
			});
		} else if (tool === "select") {
			patchToolState(store, { selection: rectFromCells(anchor, cell) });
		} else if (tool === "crop") {
			onOperation({ type: "crop", rect: rectFromCells(anchor, cell) });
			patchToolState(store, { selection: null });
		} else if (tool === "move" && selection) {
			const dx = cell.x - anchor.x;
			const dy = cell.y - anchor.y;
			if (dx !== 0 || dy !== 0) {
				onOperation({ type: "move-selection", rect: selection, dx, dy });
				patchToolState(store, { selection: moveRect(selection, dx, dy) });
			}
		}
		reset();
	}

	function toCell(clientX: number, clientY: number) {
		const canvas = canvasRef.current;
		if (!canvas) {
			return null;
		}
		return cellFromPoint(
			{ x: clientX, y: clientY },
			canvas.getBoundingClientRect(),
			canvas,
			zoom,
			size
		);
	}

	function moveCursor(step: Cell) {
		const current = hover ?? { x: 0, y: 0 };
		const next = {
			x: Math.min(Math.max(current.x + step.x, 0), size.width - 1),
			y: Math.min(Math.max(current.y + step.y, 0), size.height - 1),
		};
		setNotice("");
		setHover(next);
		if (anchor && (state.tool === "pen" || state.tool === "eraser")) {
			setPath((previous) => [...previous, next]);
		}
	}

	function onKeyDown(event: KeyboardEvent<HTMLElement>) {
		const step = cursorSteps[event.key];
		if (step) {
			event.preventDefault();
			moveCursor(step);
		} else if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			const current = hover ?? { x: 0, y: 0 };
			if (anchor) {
				complete(current);
			} else {
				begin(current);
			}
		} else if (event.key === "Escape") {
			cancel();
		}
	}

	if (!interactive) {
		return (
			<canvas
				aria-label={label}
				className="max-w-none border"
				height={height}
				ref={canvasRef}
				role="img"
				width={width}
			/>
		);
	}

	return (
		<div className="space-y-1">
			{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: The pixel canvas is a custom widget with its own arrow-key cursor model; application is the role for that. */}
			<div
				aria-label={`${label}. Arrow keys move the cursor, Enter applies the active tool, Escape cancels.`}
				className="w-fit outline-none focus-visible:ring-2 focus-visible:ring-ring"
				onFocus={() => setHover((current) => current ?? { x: 0, y: 0 })}
				onKeyDown={onKeyDown}
				role="application"
				// biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard focus is how the custom pixel cursor receives arrow keys.
				tabIndex={0}
			>
				<canvas
					className="max-w-none touch-none border"
					height={height}
					onPointerDown={(event) => {
						event.currentTarget.setPointerCapture(event.pointerId);
						const cell = toCell(event.clientX, event.clientY);
						if (cell) {
							setHover(cell);
							begin(cell);
						}
					}}
					onPointerLeave={() => {
						if (!anchor) {
							setHover(null);
						}
					}}
					onPointerMove={(event) => {
						const cell = toCell(event.clientX, event.clientY);
						if (!cell) {
							return;
						}
						setHover(cell);
						if (
							anchor &&
							(state.tool === "pen" || state.tool === "eraser") &&
							(path.at(-1)?.x !== cell.x || path.at(-1)?.y !== cell.y)
						) {
							setPath((previous) => [...previous, cell]);
						}
					}}
					onPointerUp={(event) => {
						const cell = toCell(event.clientX, event.clientY);
						if (cell && anchor) {
							complete(cell);
						}
					}}
					ref={canvasRef}
					width={width}
				/>
			</div>
			<p aria-live="polite" className="text-muted-foreground text-xs">
				{hover ? `Pixel ${hover.x}, ${hover.y}` : "Pixel grid"}
				{anchor ? ` · started at ${anchor.x}, ${anchor.y}` : ""}
				{state.selection
					? ` · Selection ${state.selection.width} × ${state.selection.height} at ${state.selection.x}, ${state.selection.y}`
					: ""}
				{notice ? ` · ${notice}` : ""}
			</p>
		</div>
	);
}
