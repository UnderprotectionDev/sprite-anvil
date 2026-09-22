import { useStore } from "@tanstack/react-store";

import { setColor, setZoom, studioStore } from "@/lib/studio-store";

export function StudioToolbar() {
	const zoom = useStore(studioStore, (state) => state.zoom);
	const color = useStore(studioStore, (state) => state.color);

	return (
		<div className="flex flex-wrap items-center gap-3">
			<label htmlFor="color">Color</label>
			<input
				id="color"
				onChange={(event) => setColor(event.target.value)}
				type="color"
				value={color}
			/>
			<label htmlFor="zoom">Zoom</label>
			<input
				id="zoom"
				max="24"
				min="8"
				onChange={(event) => setZoom(Number(event.target.value))}
				step="4"
				type="range"
				value={zoom}
			/>
			<output htmlFor="zoom">{zoom}×</output>
		</div>
	);
}
