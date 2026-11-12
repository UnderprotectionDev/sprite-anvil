import type {
	ReadinessBlockerKind,
	ReadinessPlan,
	ReadinessWorkItem,
} from "@sprite-anvil/api/readiness-plans";

export const blockerKindLabels: Record<ReadinessBlockerKind, string> = {
	family_readiness_unavailable: "Family readiness unavailable",
	pinned_required_list_not_active:
		"Pinned Required Set revision is not the active one",
	production_evidence_policy_not_evaluated:
		"Production Evidence Policy not evaluated",
	required_item_incomplete: "Required item incomplete",
	rights_evidence_policy_not_evaluated: "Rights Evidence Policy not evaluated",
};

export const targetReadinessLabels: Record<
	ReadinessPlan["targetReadiness"],
	string
> = {
	blocked: "Blocked",
	ready: "Ready",
};

export const deliveryStatusLabels: Record<
	ReadinessPlan["deliveryStatus"],
	string
> = {
	delivered: "Delivered",
	not_delivered: "Not delivered",
};

export const requirementKindLabels = {
	human_review: "Human review",
	quality: "Quality",
	usage_test: "Usage test",
} as const;

export const targetRequirementSourceLabels: Record<
	ReadinessWorkItem["rationales"]["targetRequirement"]["source"],
	string
> = {
	production_evidence_policy: "Production Evidence Policy",
	required_items_list: "Required Set",
	rights_evidence_policy: "Rights Evidence Policy",
};

export function plural(count: number, singular: string, pluralForm?: string) {
	return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

/** The complete work order after moving one step by `offset`; null when it cannot move there. */
export function moveWorkId(
	workIds: string[],
	index: number,
	offset: -1 | 1
): string[] | null {
	const target = index + offset;
	if (target < 0 || target >= workIds.length) {
		return null;
	}
	const next = [...workIds];
	const [moved] = next.splice(index, 1);
	if (moved === undefined) {
		return null;
	}
	next.splice(target, 0, moved);
	return next;
}
