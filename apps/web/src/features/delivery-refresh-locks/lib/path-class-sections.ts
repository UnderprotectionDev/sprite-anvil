import type { DeliveryRefreshPathClass } from "@sprite-anvil/api/delivery-refresh-classification";

/** How the review names and explains each path class; the classes themselves come from the shared module. */
export const pathClassSections: Record<
	DeliveryRefreshPathClass,
	{ description: string; title: string }
> = {
	diverged: {
		description:
			"Paths that no longer match what Sprite Anvil wrote. Nothing is written for them until you decide.",
		title: "Diverged",
	},
	missing: {
		description:
			"Owned paths that are gone from the folder. The new bundle's file is written back when it still ships one.",
		title: "Missing",
	},
	stale: {
		description:
			"Owned paths the new bundle no longer ships. They are left in place, never deleted, and stop being owned.",
		title: "Stale",
	},
	"to-update": {
		description:
			"Paths the new bundle changes or adds while your copy still matches the lock.",
		title: "To update",
	},
	unchanged: {
		description:
			"Owned paths whose bytes already match the new bundle. Nothing is written.",
		title: "Unchanged",
	},
};
