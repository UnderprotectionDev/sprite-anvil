import type { FulfilmentRequirementStatus } from "@sprite-anvil/api/delivery-fulfilment";

export const requirementStatusLabels: Record<
	FulfilmentRequirementStatus,
	string
> = {
	agreed: "Agreed",
	conflict: "Conflict",
	mapped: "Mapped",
	missing: "Missing",
};

export const requirementStatusHints: Record<
	FulfilmentRequirementStatus,
	string
> = {
	agreed:
		"Several Export Bundles meet this requirement with the same Asset Versions.",
	conflict:
		"Several Export Bundles meet this requirement with different Asset Versions; only you pick which one counts.",
	mapped: "One Export Bundle meets this requirement.",
	missing: "No Export Bundle for this revision meets this requirement yet.",
};
