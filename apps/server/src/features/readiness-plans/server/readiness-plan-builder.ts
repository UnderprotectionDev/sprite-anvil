import type { DeliveryTargetRevision } from "@sprite-anvil/api/delivery-planning-outputs";
import type { DependencyCatalog } from "@sprite-anvil/api/dependency-revalidation";
import type {
	ReadinessBlocker as FamilyBlockerCode,
	FamilyReadiness,
} from "@sprite-anvil/api/family-readiness";
import type {
	ReadinessBlocker,
	ReadinessPlan,
	ReadinessWorkItem,
} from "@sprite-anvil/api/readiness-plans";

type FamilyScope = DeliveryTargetRevision["families"][number];
type PinnedItem = FamilyScope["requiredItems"][number];
type TargetRequirement = ReadinessWorkItem["rationales"]["targetRequirement"];

/** What the plan reads from the other features; each family is null when its readiness could not be read. */
export interface ReadinessPlanSources {
	deliveryTargetId: string;
	dependencies: Pick<
		DependencyCatalog,
		"dependencyLinks" | "revalidationRequiredVersionIds"
	>;
	familyReadiness: Map<string, FamilyReadiness | null>;
	/** Whether a Delivery Fulfilment exists for this revision; Readiness never decides it. */
	hasFulfilment: boolean;
	revision: DeliveryTargetRevision;
	/** The user's saved order, if any. */
	savedOrder: string[] | null;
}

interface DraftWork {
	/** Asset Records the work's item is linked to; used to find work that depends on another item. */
	assetRecordIds: string[];
	blocker: ReadinessBlocker;
	dependsOn: string[];
	id: string;
	isUsageTest: boolean;
	itemId: string | null;
	requirement: TargetRequirement;
	title: string;
	versionIds: string[];
}

/**
 * Within one item a later step cannot finish before an earlier one: a version
 * has to exist before it can be approved, and quality evidence has to be in
 * before profile or usage tests can pass. Codes of the same tier are parallel.
 */
const blockerTier: Record<FamilyBlockerCode, number> = {
	applicability: 1,
	approval: 1,
	asset_version: 0,
	integrity: 1,
	profile_contract_usage_test: 3,
	quality: 2,
	quality_contract: 1,
	usage_test: 3,
};
const defaultTier = 1;

function tierOf(code: string) {
	return blockerTier[code as FamilyBlockerCode] ?? defaultTier;
}

function blockerOf(
	fields: Partial<ReadinessBlocker> & Pick<ReadinessBlocker, "id" | "kind">
): ReadinessBlocker {
	return {
		assetFamilyId: null,
		assetFamilyName: null,
		blockerCodes: [],
		itemId: null,
		itemName: null,
		unmetRequirements: [],
		...fields,
	};
}

function listRequirement(
	family: FamilyScope,
	itemId: string | null
): TargetRequirement {
	return {
		itemId,
		requiredSetRevisionId: family.requiredSetRevisionId,
		requiredSetRevisionNumber: family.requiredSetRevisionNumber,
		source: "required_items_list",
	};
}

function standaloneWork(
	blocker: ReadinessBlocker,
	title: string,
	requirement: TargetRequirement
): DraftWork {
	return {
		assetRecordIds: [],
		blocker,
		dependsOn: [],
		id: blocker.id,
		isUsageTest: false,
		itemId: blocker.itemId,
		requirement,
		title,
		versionIds: [],
	};
}

function unmetRequirementsOf(
	readinessItem: FamilyReadiness["items"][number]
): ReadinessBlocker["unmetRequirements"] {
	const toUnmet = (
		kind: "quality" | "human_review" | "usage_test",
		requirements: {
			id: string;
			isCurrent: boolean;
			name: string;
			required?: boolean;
			result: string;
		}[]
	) =>
		requirements
			.filter(
				(requirement) =>
					requirement.required !== false &&
					!(
						requirement.isCurrent &&
						["passed", "waived"].includes(requirement.result)
					)
			)
			.map((requirement) => ({
				id: requirement.id,
				isCurrent: requirement.isCurrent,
				kind,
				name: requirement.name,
				result: requirement.result,
			}));
	return [
		...toUnmet("quality", readinessItem.qualityRequirements),
		...toUnmet("human_review", readinessItem.humanReviewRequirements),
		...toUnmet("usage_test", readinessItem.usageRequirements),
	];
}

function itemWork(
	family: FamilyScope,
	pinned: PinnedItem,
	readinessItem: FamilyReadiness["items"][number] | undefined
): DraftWork[] {
	if (readinessItem?.status === "complete") {
		return [];
	}
	const codes = readinessItem?.blockers.length
		? readinessItem.blockers
		: ["not_assessed"];
	const blocker = blockerOf({
		assetFamilyId: family.assetFamilyId,
		assetFamilyName: family.assetFamilyName,
		blockerCodes: codes,
		id: `${family.assetFamilyId}:${pinned.id}`,
		itemId: pinned.id,
		itemName: pinned.name,
		kind: "required_item_incomplete",
		unmetRequirements: readinessItem ? unmetRequirementsOf(readinessItem) : [],
	});
	const ordered = [...codes].sort(
		(left, right) => tierOf(left) - tierOf(right)
	);
	return ordered.map((code) => {
		const tier = tierOf(code);
		const lowerTier = Math.max(
			-1,
			...ordered.map(tierOf).filter((other) => other < tier)
		);
		return {
			assetRecordIds: pinned.assetRecordIds,
			blocker,
			dependsOn: ordered
				.filter((other) => tierOf(other) === lowerTier)
				.map((other) => `${blocker.id}:${other}`),
			id: `${blocker.id}:${code}`,
			isUsageTest: pinned.kind === "usage_test",
			itemId: pinned.id,
			requirement: listRequirement(family, pinned.id),
			title: `Resolve ${code.replaceAll("_", " ")} for ${pinned.name} (${family.assetFamilyName})`,
			versionIds: readinessItem?.currentAssetVersionIds ?? [],
		};
	});
}

function familyWork(
	family: FamilyScope,
	readiness: FamilyReadiness | null | undefined
): DraftWork[] {
	const base = {
		assetFamilyId: family.assetFamilyId,
		assetFamilyName: family.assetFamilyName,
	};
	if (!readiness) {
		return [
			standaloneWork(
				blockerOf({
					...base,
					id: `${family.assetFamilyId}:family_readiness_unavailable`,
					kind: "family_readiness_unavailable",
				}),
				`Family readiness for ${family.assetFamilyName} could not be read`,
				listRequirement(family, null)
			),
		];
	}
	if (readiness.activeRevision?.id !== family.requiredSetRevisionId) {
		return [
			standaloneWork(
				blockerOf({
					...base,
					id: `${family.assetFamilyId}:pinned_required_list_not_active`,
					kind: "pinned_required_list_not_active",
				}),
				`Reactivate Required Items List revision ${family.requiredSetRevisionNumber} for ${family.assetFamilyName}, or move the target to a new revision`,
				listRequirement(family, null)
			),
		];
	}
	const work = [...family.requiredItems, ...family.usageTests].flatMap(
		(pinned) =>
			itemWork(
				family,
				pinned,
				readiness.items.find((entry) => entry.item.id === pinned.id)
			)
	);
	return work.map((entry) =>
		entry.isUsageTest
			? {
					...entry,
					dependsOn: [
						...entry.dependsOn,
						...work
							.filter(
								(other) =>
									!other.isUsageTest &&
									other.assetRecordIds.some((recordId) =>
										entry.assetRecordIds.includes(recordId)
									)
							)
							.map((other) => other.id),
					],
				}
			: entry
	);
}

function policyRequirement(
	source: "production_evidence_policy" | "rights_evidence_policy"
): TargetRequirement {
	return {
		itemId: null,
		requiredSetRevisionId: null,
		requiredSetRevisionNumber: null,
		source,
	};
}

/** Policies the plan cannot judge yet are blockers: a target is never Ready on evidence nobody checked. */
function policyWork(revision: DeliveryTargetRevision): DraftWork[] {
	const production = revision.families.flatMap((family) => {
		const requirement =
			revision.productionEvidencePolicy.familyRequirements.find(
				(entry) => entry.assetFamilyId === family.assetFamilyId
			)?.requirement ?? revision.productionEvidencePolicy.defaultRequirement;
		return requirement === "advisory"
			? []
			: [
					standaloneWork(
						blockerOf({
							assetFamilyId: family.assetFamilyId,
							assetFamilyName: family.assetFamilyName,
							id: `production_evidence_policy:${family.assetFamilyId}`,
							kind: "production_evidence_policy_not_evaluated",
						}),
						`Production Evidence Policy (${requirement.replaceAll("_", " ")}) for ${family.assetFamilyName} is not evaluated yet`,
						policyRequirement("production_evidence_policy")
					),
				];
	});
	const rights =
		revision.rightsEvidencePolicy.requireRecordFor.length > 0
			? [
					standaloneWork(
						blockerOf({
							id: "rights_evidence_policy",
							kind: "rights_evidence_policy_not_evaluated",
						}),
						`Rights Evidence Policy (records for ${revision.rightsEvidencePolicy.requireRecordFor.join(" and ")}) is not evaluated yet`,
						policyRequirement("rights_evidence_policy")
					),
				]
			: [];
	return [...production, ...rights];
}

function revalidationOf(work: DraftWork, sources: ReadinessPlanSources) {
	const required = new Set(sources.dependencies.revalidationRequiredVersionIds);
	const requiredNowVersionIds = work.versionIds.filter((id) =>
		required.has(id)
	);
	const derivativeVersionIds = [
		...new Set(
			sources.dependencies.dependencyLinks
				.filter(
					(link) =>
						link.source.kind === "asset_version" &&
						work.versionIds.includes(link.source.id)
				)
				.map((link) => link.targetAssetVersionId)
				.filter((id) => !requiredNowVersionIds.includes(id))
		),
	];
	return { derivativeVersionIds, requiredNowVersionIds };
}

/**
 * The system's suggestion: prerequisites first; among startable work, the one
 * that opens the most other work, then the one with the least revalidation.
 * These stay two visible tie-breaks, not one combined number.
 */
function suggestedOrder(
	work: DraftWork[],
	opensByWork: Map<string, string[]>,
	revalidationCostByWork: Map<string, number>
) {
	const done = new Set<string>();
	const remaining = [...work];
	const order: string[] = [];
	while (remaining.length > 0) {
		const startable = remaining.filter((entry) =>
			entry.dependsOn.every((id) => done.has(id))
		);
		const [next] = (startable.length > 0 ? startable : remaining).sort(
			(left, right) =>
				(opensByWork.get(right.id)?.length ?? 0) -
					(opensByWork.get(left.id)?.length ?? 0) ||
				(revalidationCostByWork.get(left.id) ?? 0) -
					(revalidationCostByWork.get(right.id) ?? 0) ||
				left.id.localeCompare(right.id)
		);
		if (!next) {
			break;
		}
		order.push(next.id);
		done.add(next.id);
		remaining.splice(remaining.indexOf(next), 1);
	}
	return order;
}

/** The user's saved order first, minus work that is gone, then the suggestion for everything they have not ordered. */
function mergeOrder(
	work: DraftWork[],
	savedOrder: string[] | null,
	suggested: string[]
) {
	const known = new Set(work.map((entry) => entry.id));
	const userOrder = (savedOrder ?? []).filter((id) => known.has(id));
	const userOrdered = new Set(userOrder);
	return {
		effective: [
			...userOrder,
			...suggested.filter((id) => !userOrdered.has(id)),
		],
		userCount: userOrder.length,
	};
}

function toWorkItems(
	work: DraftWork[],
	order: ReturnType<typeof mergeOrder>,
	opensByWork: Map<string, string[]>,
	revalidation: Map<string, ReturnType<typeof revalidationOf>>
): ReadinessWorkItem[] {
	const byId = new Map(work.map((entry) => [entry.id, entry]));
	return order.effective.flatMap((id, index) => {
		const entry = byId.get(id);
		if (!entry) {
			return [];
		}
		const isUser = index < order.userCount;
		const opened = opensByWork.get(id) ?? [];
		return [
			{
				blockerId: entry.blocker.id,
				dependsOnWorkIds: entry.dependsOn,
				id,
				opensWorkIds: opened,
				orderSource: isUser ? "user" : "suggested",
				position: index + 1,
				rationales: {
					revalidationImpact: revalidation.get(id) ?? {
						derivativeVersionIds: [],
						requiredNowVersionIds: [],
					},
					targetRequirement: entry.requirement,
					unlocksDependentWork: { count: opened.length },
					userPriority: { position: isUser ? index + 1 : null },
				},
				title: entry.title,
			},
		];
	});
}

/** Derives the Readiness Plan of one active Delivery Target revision; pure, so reading it can change nothing. */
export function buildReadinessPlan(
	sources: ReadinessPlanSources
): ReadinessPlan {
	const { revision } = sources;
	const work = [
		...revision.families.flatMap((family) =>
			familyWork(family, sources.familyReadiness.get(family.assetFamilyId))
		),
		...policyWork(revision),
	];
	const opensByWork = new Map<string, string[]>(
		work.map((entry) => [
			entry.id,
			work
				.filter((other) => other.dependsOn.includes(entry.id))
				.map((other) => other.id),
		])
	);
	const revalidation = new Map(
		work.map((entry) => [entry.id, revalidationOf(entry, sources)])
	);
	const revalidationCostByWork = new Map(
		[...revalidation].map(([id, value]) => [
			id,
			value.requiredNowVersionIds.length + value.derivativeVersionIds.length,
		])
	);
	const order = mergeOrder(
		work,
		sources.savedOrder,
		suggestedOrder(work, opensByWork, revalidationCostByWork)
	);
	const indexOf = new Map(order.effective.map((id, index) => [id, index]));
	const workItems = toWorkItems(work, order, opensByWork, revalidation);
	const blockers = [
		...new Map(work.map((entry) => [entry.blocker.id, entry.blocker])).values(),
	];
	const next = workItems.find((entry) => entry.dependsOnWorkIds.length === 0);
	return {
		blockers,
		deliveryStatus: sources.hasFulfilment ? "delivered" : "not_delivered",
		deliveryTargetId: sources.deliveryTargetId,
		orderWarnings: workItems.flatMap((entry) =>
			entry.dependsOnWorkIds
				.filter(
					(prerequisite) =>
						(indexOf.get(prerequisite) ?? 0) > (indexOf.get(entry.id) ?? 0)
				)
				.map((prerequisiteWorkId) => ({ prerequisiteWorkId, workId: entry.id }))
		),
		recommendedNext: next
			? {
					basis: next.orderSource === "user" ? "user_order" : "suggested_order",
					workId: next.id,
				}
			: null,
		revisionId: revision.id,
		revisionNumber: revision.revisionNumber,
		targetReadiness: blockers.length === 0 ? "ready" : "blocked",
		workItems,
	};
}
