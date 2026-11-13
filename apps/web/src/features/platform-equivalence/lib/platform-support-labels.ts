import type { PlatformSurface } from "@sprite-anvil/api/platform-equivalence-comparison";
import type {
	OpenValidationId,
	PlatformSupportBlocker,
} from "@sprite-anvil/api/platform-support-gate";
import { surfaceLabels } from "./platform-equivalence-labels";

export const openValidationLabels: Record<OpenValidationId, string> = {
	"OV-08": "OV-08 deletion and backup-removal time",
	"OV-09": "OV-09 project, upload and Project Archive size limits",
	"OV-10": "OV-10 performance and memory limits",
	"OV-11": "OV-11 supported web browsers and desktop operating systems",
};

const scenarioReasonLabels = {
	different: "the surfaces produced different results",
	equivalent: "equivalent",
	inputs_differ: "the runs used different inputs",
	missing: "not measured",
	missing_surface: "a surface has no result",
} as const;

const partLabels = {
	divergence: "Divergence results",
	lock: "Delivery Refresh Lock",
} as const;

export function blockerLabel(blocker: PlatformSupportBlocker): string {
	switch (blocker.kind) {
		case "scenario":
			return `${blocker.id}: ${scenarioReasonLabels[blocker.reason]}`;
		case "delivery_refresh":
			return `${partLabels[blocker.part]}: ${
				blocker.reason === "different" ? "different" : "not evaluated"
			}`;
		case "accessibility":
			return `${surfaceLabels[blocker.surface satisfies PlatformSurface]} accessibility: ${
				blocker.reason === "failed" ? "failed" : "not measured"
			}`;
		case "open_validation":
			return `${openValidationLabels[blocker.id]}: no published parameters or evidence`;
		default:
			return blocker satisfies never;
	}
}
