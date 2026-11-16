import type { AssetVersion } from "@sprite-anvil/api/asset-versions";

export const reviewDispositionLabels = {
	candidate: "Candidate",
	approved: "Approved",
	rejected: "Rejected",
} satisfies Record<AssetVersion["reviewDisposition"], string>;
