import type { PlatformSurface } from "@sprite-anvil/api/platform-equivalence-comparison";
import type {
	OpenValidationId,
	PlatformSupportBlocker,
	PlatformSupportResult,
} from "@sprite-anvil/api/platform-support-gate";
import { surfaceLabels } from "./platform-equivalence-labels";

export const openValidationLabels: Record<OpenValidationId, string> = {
	"OV-08": "OV-08 deletion and backup-removal time",
	"OV-09": "OV-09 project, upload and Project Archive size limits",
	"OV-10": "OV-10 performance and memory limits",
	"OV-11": "OV-11 supported web browsers and desktop operating systems",
};

export const combinationStatusLabels: Record<
	PlatformSupportResult["status"],
	string
> = {
	supported: "Supported",
	unmeasured: "Unmeasured",
};

const noEvidenceRef = "no evidence reference";

const scenarioReasonLabels: Record<
	Extract<PlatformSupportBlocker, { kind: "scenario" }>["reason"],
	string
> = {
	different: "the surfaces produced different results",
	inputs_differ: "the runs used different inputs",
	missing: "not measured",
	missing_surface: "a surface has no result",
	no_evidence_ref: noEvidenceRef,
	same_bundle: "both surfaces recorded the same Export Bundle",
	not_bound_to_scenario: "the result belongs to another scenario",
};

const deliveryRefreshReasonLabels: Record<
	Extract<PlatformSupportBlocker, { kind: "delivery_refresh" }>["reason"],
	string
> = {
	different: "different",
	no_evidence_ref: noEvidenceRef,
	not_evaluated: "not evaluated",
};

const accessibilityReasonLabels: Record<
	Extract<PlatformSupportBlocker, { kind: "accessibility" }>["reason"],
	string
> = {
	failed: "failed",
	no_evidence_ref: noEvidenceRef,
	not_measured: "not measured",
};

const partLabels = {
	divergence: "Divergence results",
	lock: "Delivery Refresh Lock",
} as const;

export function blockerLabel(blocker: PlatformSupportBlocker): string {
	switch (blocker.kind) {
		case "scenario":
			return `${blocker.id}: ${scenarioReasonLabels[blocker.reason]}`;
		case "delivery_refresh":
			return `${partLabels[blocker.part]}: ${deliveryRefreshReasonLabels[blocker.reason]}`;
		case "accessibility":
			return `${surfaceLabels[blocker.surface satisfies PlatformSurface]} accessibility: ${accessibilityReasonLabels[blocker.reason]}`;
		case "open_validation":
			return `${openValidationLabels[blocker.id]}: no published parameters or evidence`;
		default:
			return blocker satisfies never;
	}
}
