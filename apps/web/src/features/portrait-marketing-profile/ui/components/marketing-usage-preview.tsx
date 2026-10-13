import type { MarketingUsageReviewInput } from "@sprite-anvil/api/marketing-usage-reviews";
import { useRef } from "react";

type Item = Pick<
	MarketingUsageReviewInput["items"][number],
	| "naturalSize"
	| "crop"
	| "safeArea"
	| "displaySize"
	| "presentation"
	| "opaqueColor"
>;
export function MarketingUsagePreview({
	item,
	previewUrl,
	name,
	onReady,
}: {
	item: Item;
	previewUrl: string;
	name: string;
	onReady?: (ready: boolean) => void;
}) {
	const loaded = useRef(new Set<string>());
	const sx = item.displaySize.width / item.crop.width;
	const sy = item.displaySize.height / item.crop.height;
	return (
		<div className="grid gap-4 sm:grid-cols-2">
			{(["light", "dark"] as const).map((background) => (
				<figure className="space-y-2" key={background}>
					<figcaption>
						{background === "light" ? "Açık zemin" : "Koyu zemin"} ·{" "}
						{item.displaySize.width} × {item.displaySize.height} px
					</figcaption>
					<div
						className="overflow-auto rounded border p-4"
						style={{
							backgroundColor: background === "light" ? "#fafafa" : "#18181b",
						}}
					>
						<div
							style={{
								position: "relative",
								overflow: "hidden",
								width: item.displaySize.width,
								height: item.displaySize.height,
								backgroundColor:
									item.presentation === "opaque"
										? (item.opaqueColor ?? undefined)
										: undefined,
							}}
						>
							{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Image load/error reports source availability; no interaction handler. */}
							<img
								alt={`${name} · ${background === "light" ? "açık" : "koyu"} zemin`}
								crossOrigin="use-credentials"
								height={item.naturalSize.height}
								onError={() => {
									loaded.current.clear();
									onReady?.(false);
								}}
								onLoad={() => {
									loaded.current.add(background);
									onReady?.(loaded.current.size === 2);
								}}
								src={previewUrl}
								style={{
									position: "absolute",
									maxWidth: "none",
									width: item.naturalSize.width * sx,
									height: item.naturalSize.height * sy,
									left: -item.crop.x * sx,
									top: -item.crop.y * sy,
									imageRendering: "auto",
								}}
								width={item.naturalSize.width}
							/>
							<div
								aria-label="Güvenli alan"
								role="note"
								style={{
									position: "absolute",
									pointerEvents: "none",
									border: "1px dashed #e11d48",
									left: (item.safeArea.x - item.crop.x) * sx,
									top: (item.safeArea.y - item.crop.y) * sy,
									width: item.safeArea.width * sx,
									height: item.safeArea.height * sy,
								}}
							/>
						</div>
					</div>
				</figure>
			))}
		</div>
	);
}
