import type {
	DeliveryTargetPurpose,
	ProductionEvidenceRequirement,
} from "@sprite-anvil/api/delivery-planning-inputs";
import type { RightsRecordState } from "@sprite-anvil/api/rights-records";

export const purposeLabels: Record<DeliveryTargetPurpose, string> = {
	chapter: "Chapter",
	demo: "Demo",
	other: "Other",
	update: "Update",
};

export const productionRequirementLabels: Record<
	ProductionEvidenceRequirement,
	string
> = {
	advisory: "Missing history is advisory",
	full_generation_package_history: "Full Generation Package history",
	legacy_asset_attestation_acceptable: "Legacy Asset Attestation acceptable",
};

export const rightsStateLabels: Record<RightsRecordState, string> = {
	assertion_only: "Assertion only",
	documented: "Documented",
	restricted: "Restricted",
	unknown: "Unknown",
};

export const rightsSubjectLabels = {
	references: "References",
	results: "Results",
} as const;

export const itemKindLabels: Record<string, string> = {
	animation: "Animation",
	direction: "Direction",
	state: "State",
	usage_test: "Usage test",
	variant: "Variant",
};

export function errorCodeOf(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined;
	}
	const code = Reflect.get(error, "code");
	return typeof code === "string" ? code : undefined;
}

export function errorMessageOf(error: unknown): string | undefined {
	return error instanceof Error && error.message ? error.message : undefined;
}
