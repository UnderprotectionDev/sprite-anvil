import type {
	RuntimeValidationEvidenceKind,
	RuntimeValidationEvidenceSource,
} from "@sprite-anvil/api/runtime-validation";

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

export function errorMessageOf(error: unknown): string | undefined {
	return error instanceof Error && error.message ? error.message : undefined;
}
