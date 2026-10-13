import type { PortraitReviewItem } from "@sprite-anvil/api/portrait-identity-reviews";
import { useState } from "react";
import { ENV } from "@/env";

const trailingSlash = /\/$/;
const previewBackgrounds = {
	dark: "#171717",
	light: "#fafafa",
	transparent:
		"repeating-conic-gradient(#ddd 0% 25%,#fff 0% 50%) 0 0 / 16px 16px",
};
export function PortraitUsagePreview({
	item,
	previewUrl,
	label,
	onReady,
}: {
	item: PortraitReviewItem;
	previewUrl: string;
	label: string;
	onReady?: (ready: boolean) => void;
}) {
	const [failed, setFailed] = useState(false);
	const widthScale = item.targetSize.width / item.crop.width;
	const heightScale = item.targetSize.height / item.crop.height;
	const url = previewUrl.startsWith("/")
		? `${ENV.VITE_SERVER_URL?.replace(trailingSlash, "") ?? ""}${previewUrl}`
		: previewUrl;
	return (
		<figure className="space-y-2">
			<figcaption>
				{label} · {item.expression} ·{" "}
				{item.usagePurpose === "dialogue" ? "Diyalog" : "Arayüz"} ·{" "}
				{item.targetSize.width} × {item.targetSize.height} px
			</figcaption>
			<div className="max-w-full overflow-auto p-2">
				<div
					className="relative shrink-0 overflow-hidden border"
					style={{
						width: item.targetSize.width,
						height: item.targetSize.height,
						background: previewBackgrounds[item.background],
					}}
				>
					{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Image load events report preview integrity; no pointer/keyboard interactions. */}
					<img
						alt={`${label} ${item.expression}`}
						draggable={false}
						height={item.naturalSize.height}
						onError={() => {
							setFailed(true);
							onReady?.(false);
						}}
						onLoad={(event) => {
							if (
								event.currentTarget.naturalWidth !== item.naturalSize.width ||
								event.currentTarget.naturalHeight !== item.naturalSize.height
							) {
								setFailed(true);
								onReady?.(false);
								return;
							}
							setFailed(false);
							onReady?.(true);
						}}
						src={url}
						style={{
							position: "absolute",
							maxWidth: "none",
							width: item.naturalSize.width * widthScale,
							height: item.naturalSize.height * heightScale,
							left: -item.crop.x * widthScale,
							top: -item.crop.y * heightScale,
						}}
						width={item.naturalSize.width}
					/>
				</div>
			</div>
			{failed ? (
				<p role="alert">
					Görsel yüklenemedi veya kaynak ölçüsü uyuşmuyor. Yeniden yükleyin.
				</p>
			) : null}
		</figure>
	);
}
