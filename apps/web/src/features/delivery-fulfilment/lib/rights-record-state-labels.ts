import {
	type RightsRecordState,
	rightsRecordStateSchema,
} from "@sprite-anvil/api/rights-records";

const rightsRecordStateLabels: Record<RightsRecordState, string> = {
	assertion_only: "Assertion Only",
	documented: "Documented",
	restricted: "Restricted",
	unknown: "Unknown",
};

/** The English product label of a user-declared Rights Record state; a state pinned in a bundle manifest is a plain string and falls back to itself. */
export function rightsRecordStateLabel(state: string) {
	const parsed = rightsRecordStateSchema.safeParse(state);
	return parsed.success ? rightsRecordStateLabels[parsed.data] : state;
}
