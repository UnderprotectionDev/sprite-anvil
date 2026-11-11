import type {
	RuntimeValidationEvidenceKind,
	RuntimeValidationEvidenceSource,
} from "@sprite-anvil/api/runtime-validation";
import type {
	RuntimeValidationFailureSource,
	RuntimeValidationOutcome,
} from "@sprite-anvil/api/runtime-validation-decisions";
import type { RuntimeValidationBlocker } from "@sprite-anvil/api/runtime-validation-readiness";

export const evidenceKindLabels: Record<RuntimeValidationEvidenceKind, string> =
	{
		observation: "Observation",
		recording: "Recording",
		screenshot: "Screenshot",
		test_result: "Test result",
	};

export const evidenceSourceLabels: Record<
	RuntimeValidationEvidenceSource,
	string
> = {
	adapter_draft: "Drafted by the adapter",
	manual: "Added by you",
};

export const outcomeLabels: Record<RuntimeValidationOutcome, string> = {
	fail: "Fail",
	inconclusive: "Inconclusive",
	pass: "Pass",
};

export const failureSourceLabels: Record<
	RuntimeValidationFailureSource,
	string
> = {
	asset_content: "Asset Content",
	engine_adapter: "Engine Adapter",
	game_configuration: "Game Configuration",
	multiple_sources: "Multiple Sources",
	source_unknown: "Source Unknown",
};

export const blockerLabels: Record<RuntimeValidationBlocker, string> = {
	decision_pending: "A record exists but you have not finalized its outcome.",
	failed_revalidation_required:
		"The latest record failed from a confirmed source. Revalidation Required for this use: add a new record after the fix.",
	failed_source_unknown:
		"The latest record failed and its source is Source Unknown. Confirm the failure source, then add a new record after the fix.",
	inconclusive:
		"The latest record is Inconclusive. Add a new record for this environment.",
	no_record: "No record exists for this exact Export Bundle and environment.",
	superseded:
		"A newer record supersedes the latest record for this environment.",
};

export function errorMessageOf(error: unknown): string | undefined {
	return error instanceof Error && error.message ? error.message : undefined;
}
