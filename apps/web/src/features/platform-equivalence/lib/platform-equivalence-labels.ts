import type {
	PlatformEquivalenceComparison,
	PlatformEquivalenceSection,
	PlatformSurface,
	platformEquivalenceNotEvaluated,
} from "@sprite-anvil/api/platform-equivalence-comparison";
import { isTauri } from "@tauri-apps/api/core";

/** The surface this app declares for itself. The server cannot verify it. */
export function currentSurface(): PlatformSurface {
	return isTauri() ? "desktop" : "web";
}

export const surfaceLabels: Record<PlatformSurface, string> = {
	desktop: "Desktop app",
	web: "Web app",
};

export const sectionLabels: Record<PlatformEquivalenceSection, string> = {
	authoritative_record: "Authoritative records",
	engine_neutral_package: "Engine-Neutral Bundle",
	quality_evidence: "Quality evidence",
};

export const outcomeLabels: Record<
	PlatformEquivalenceComparison["outcome"],
	string
> = {
	different: "The surfaces produced different results.",
	equivalent: "The surfaces produced equivalent results.",
	inputs_differ:
		"The runs were made from different inputs, so they were not compared.",
	missing_surface: "A surface has no run yet, so nothing was compared.",
};

export const sectionResultLabels = {
	different: "Different",
	not_compared: "Not compared",
	same: "Same",
} as const;

export const notEvaluatedLabels: Record<
	(typeof platformEquivalenceNotEvaluated)[number],
	string
> = {
	delivery_refresh_lock: "Delivery Refresh Lock",
	divergence: "Divergence results",
	extended_acceptance_scenarios: "Extended Acceptance Scenarios (YAS)",
	reference_acceptance_scenarios: "Reference Acceptance Scenarios (RAS)",
};
