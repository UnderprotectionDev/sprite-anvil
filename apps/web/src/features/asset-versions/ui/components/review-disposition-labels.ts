import type { AssetVersion } from "@sprite-anvil/api/asset-versions";

export const reviewDispositionLabels = {
	candidate: "Aday",
	approved: "Onaylandı",
	rejected: "Reddedildi",
} satisfies Record<AssetVersion["reviewDisposition"], string>;
