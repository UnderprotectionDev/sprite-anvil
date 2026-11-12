import type { DeliveryDiff } from "@sprite-anvil/api/delivery-diff";
import type { FulfilmentRequirementRecord } from "@sprite-anvil/api/delivery-fulfilment-records";
import type { StoredDeliveryFulfilment } from "./delivery-fulfilment-storage";
import { requirementKey } from "./fulfilment-support";

/** The context a Fulfilment's revision pinned, or null when that revision is not in the catalog. */
export interface RevisionContext {
	contextRevisionId: string;
	contextRevisionNumber: number;
}

const notRecorded = (reason: string) =>
	({ reason, status: "not_recorded" }) as const;

const sameVersions = (left: string[], right: string[]) =>
	left.length === right.length &&
	[...left].sort().join("\n") === [...right].sort().join("\n");

const refOf = (requirement: FulfilmentRequirementRecord) => ({
	assetFamilyId: requirement.assetFamilyId,
	assetFamilyName: requirement.assetFamilyName,
	itemId: requirement.itemId,
	itemKind: requirement.itemKind,
	itemName: requirement.itemName,
});

const mappingOf = (requirement: FulfilmentRequirementRecord) => ({
	bundleId: requirement.bundleId,
	manifestDigest: requirement.manifestDigest,
	resolution: requirement.resolution,
});

const summaryOf = (fulfilment: StoredDeliveryFulfilment) => ({
	createdAt: fulfilment.createdAt.toISOString(),
	deliveryTargetId: fulfilment.deliveryTargetId,
	id: fulfilment.id,
	revisionId: fulfilment.revisionId,
	revisionNumber: fulfilment.revisionNumber,
});

function indexByRequirement(fulfilment: StoredDeliveryFulfilment) {
	return new Map(
		fulfilment.requirements.map((requirement) => [
			requirementKey(requirement.assetFamilyId, requirement.itemId),
			requirement,
		])
	);
}

function diffContext(
	from: RevisionContext | null,
	to: RevisionContext | null
): DeliveryDiff["context"] {
	if (!(from && to)) {
		return notRecorded(
			"A Fulfilment records only its revision; that revision is no longer listed on its Delivery Target, so its context cannot be read."
		);
	}
	return {
		changed: from.contextRevisionId !== to.contextRevisionId,
		from,
		status: "recorded",
		to,
	};
}

/**
 * Pure comparison of two stored Fulfilments, `from` against `to`. Requirements
 * pair up by family and required item. Only what a Fulfilment records is
 * compared; the other sections say they are not recorded.
 */
export function diffFulfilments(
	from: StoredDeliveryFulfilment,
	to: StoredDeliveryFulfilment,
	contexts: { from: RevisionContext | null; to: RevisionContext | null }
): DeliveryDiff {
	const fromIndex = indexByRequirement(from);
	const toIndex = indexByRequirement(to);
	const assetVersions: DeliveryDiff["assetVersions"] = {
		added: [],
		changed: [],
		removed: [],
		unchangedCount: 0,
	};
	const changes: DeliveryDiff["bundleMappings"]["changes"] = [];

	for (const [key, before] of fromIndex) {
		const after = toIndex.get(key);
		if (!after) {
			assetVersions.removed.push({
				...refOf(before),
				assetVersionIds: before.assetVersionIds,
			});
			changes.push({ ...refOf(before), from: mappingOf(before), to: null });
			continue;
		}
		if (sameVersions(before.assetVersionIds, after.assetVersionIds)) {
			assetVersions.unchangedCount += 1;
		} else {
			assetVersions.changed.push({
				...refOf(after),
				fromAssetVersionIds: before.assetVersionIds,
				toAssetVersionIds: after.assetVersionIds,
			});
		}
		if (
			before.bundleId !== after.bundleId ||
			before.manifestDigest !== after.manifestDigest ||
			before.resolution !== after.resolution
		) {
			changes.push({
				...refOf(after),
				from: mappingOf(before),
				to: mappingOf(after),
			});
		}
	}
	for (const [key, after] of toIndex) {
		if (!fromIndex.has(key)) {
			assetVersions.added.push({
				...refOf(after),
				assetVersionIds: after.assetVersionIds,
			});
			changes.push({ ...refOf(after), from: null, to: mappingOf(after) });
		}
	}

	return {
		assetVersions,
		bundleMappings: { changes },
		context: diffContext(contexts.from, contexts.to),
		from: summaryOf(from),
		qualityEvidence: notRecorded(
			"A Delivery Fulfilment does not record the QA evidence of its Asset Versions, so no difference can be shown."
		),
		qualityException: notRecorded(
			"A Delivery Fulfilment does not record Quality Exceptions (waivers), so no difference can be shown."
		),
		rights: notRecorded(
			"A Delivery Fulfilment does not record Rights Record revisions, so no difference can be shown."
		),
		runtimeEvidence: notRecorded(
			"A Delivery Fulfilment does not record runtime validation evidence, so no difference can be shown."
		),
		to: summaryOf(to),
	};
}
