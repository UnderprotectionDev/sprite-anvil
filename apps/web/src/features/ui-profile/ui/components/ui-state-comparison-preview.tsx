import type { UiStateComparisonInput } from "@sprite-anvil/api/ui-state-comparisons";
import { useState } from "react";
import { ENV } from "@/env";

export const stateLabels = {
	normal: "Normal",
	hover: "Hover",
	pressed: "Pressed",
	disabled: "Disabled",
	selected: "Selected",
	open: "Open",
	closed: "Closed",
} as const;
export const kindLabels = {
	panel: "Panel",
	button: "Button",
	item_slot: "Item slot",
	tooltip: "Tooltip",
	indicator: "Indicator",
	tab: "Tab",
	checkbox: "Checkbox",
} as const;
export const outcomeLabels = {
	consistent: "Consistent",
	needs_follow_up: "Needs follow-up",
	inconclusive: "Inconclusive",
} as const;
const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";
export function UiStateComparisonPreview({
	name,
	previewUrl,
	dimensions,
	region,
}: {
	name: string;
	previewUrl: string;
	dimensions: { width: number; height: number };
	region?: UiStateComparisonInput["items"][number]["region"];
}) {
	const [failed, setFailed] = useState(false);
	const bounds = region ?? { x: 0, y: 0, ...dimensions };
	if (
		bounds.width < 1 ||
		bounds.height < 1 ||
		bounds.x < 0 ||
		bounds.y < 0 ||
		bounds.x + bounds.width > dimensions.width ||
		bounds.y + bounds.height > dimensions.height
	) {
		return <p role="alert">Preview region must fit the source image.</p>;
	}
	const scale = Math.min(1, 240 / bounds.width, 180 / bounds.height);
	return (
		<figure className="space-y-2">
			<figcaption className="text-sm">
				{name} · {bounds.width} × {bounds.height} px
				{scale < 1 ? " · scaled preview" : " · 1×"}
			</figcaption>
			<div className="flex min-h-24 items-center justify-center rounded border bg-muted p-2">
				{failed ? (
					<p role="alert">Image preview could not be loaded.</p>
				) : (
					<div
						className="relative overflow-hidden"
						style={{
							width: bounds.width * scale,
							height: bounds.height * scale,
						}}
					>
						{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Image load failures are status updates, not interaction handlers. */}
						<img
							alt={name}
							height={dimensions.height * scale}
							onError={() => setFailed(true)}
							src={`${serverUrl}${previewUrl}`}
							style={{
								position: "absolute",
								maxWidth: "none",
								width: dimensions.width * scale,
								height: dimensions.height * scale,
								left: -bounds.x * scale,
								top: -bounds.y * scale,
								imageRendering: "pixelated",
							}}
							width={dimensions.width * scale}
						/>
					</div>
				)}
			</div>
		</figure>
	);
}
