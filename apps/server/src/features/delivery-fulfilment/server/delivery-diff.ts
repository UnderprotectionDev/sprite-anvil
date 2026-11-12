import type {
	DeliveryDiff,
	NotRecordedSectionKey,
} from "@sprite-anvil/api/delivery-diff";
import type { FulfilmentRequirementRecord } from "@sprite-anvil/api/delivery-fulfilment-records";
import type { DeliveryTargetStore } from "@sprite-anvil/api/delivery-planning-store";
import type { StoredDeliveryFulfilment } from "./delivery-fulfilment-storage";
import { requirementKey } from "./fulfilment-support";

/** The delivery-target catalog of one project, as the store lists it. */
type Catalog = NonNullable<Awaited<ReturnType<DeliveryTargetStore["list"]>>>;

interface NotRecordedSection {
	reason: string;
	status: "not_recorded";
}

const notRecorded = (reason: string): NotRecordedSection => ({
	reason,
	status: "not_recorded",
});

const notRecordedReasons: Record<NotRecordedSectionKey, string> = {
	qualityEvidence:
		"A Delivery Fulfilment does not record the QA evidence of its Asset Versions, so no difference can be shown.",
	qualityWaiver:
		"A Delivery Fulfilment does not record Quality Waivers, so no difference can be shown.",
	rights:
		"A Delivery Fulfilment does not record Rights Record revisions, so no difference can be shown.",
	runtimeEvidence:
		"A Delivery Fulfilment does not record runtime validation evidence, so no difference can be shown.",
};

const uniqueSorted = (ids: string[]) => [...new Set(ids)].sort();

const sameVersions = (left: string[], right: string[]) =>
	uniqueSorted(left).join("\n") === uniqueSorted(right).join("\n");

/** Which requirement a diff entry is about: its family and required item, with their names. */
const requirementIdentityOf = (requirement: FulfilmentRequirementRecord) => ({
	assetFamilyId: requirement.assetFamilyId,
	assetFamilyName: requirement.assetFamilyName,
	itemId: requirement.itemId,
	itemKind: requirement.itemKind,
	itemName: requirement.itemName,
});

/** A requirement with the Asset Versions it was fulfilled with: an "added" or "removed" entry. */
const versionedEntryOf = (requirement: FulfilmentRequirementRecord) => ({
	...requirementIdentityOf(requirement),
	assetVersionIds: requirement.assetVersionIds,
});

const mappingOf = (requirement: FulfilmentRequirementRecord) => ({
	bundleId: requirement.bundleId,
	manifestDigest: requirement.manifestDigest,
	resolution: requirement.resolution,
});

const sameMapping = (
	left: FulfilmentRequirementRecord,
	right: FulfilmentRequirementRecord
) =>
	left.bundleId === right.bundleId &&
	left.manifestDigest === right.manifestDigest &&
	left.resolution === right.resolution;

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

/** The context the Fulfilment's revision pinned, or null when that revision is not in the catalog. */
function contextOf(catalog: Catalog, fulfilment: StoredDeliveryFulfilment) {
	for (const target of catalog.deliveryTargets) {
		const revision = target.revisions.find(
			(entry) => entry.id === fulfilment.revisionId
		);
		if (revision) {
			return {
				contextRevisionId: revision.contextRevisionId,
				contextRevisionNumber: revision.contextRevisionNumber,
			};
		}
	}
	return null;
}

function diffContext(
	catalog: Catalog,
	from: StoredDeliveryFulfilment,
	to: StoredDeliveryFulfilment
): DeliveryDiff["context"] {
	const before = contextOf(catalog, from);
	const after = contextOf(catalog, to);
	if (!(before && after)) {
		return notRecorded(
			"A Fulfilment records only its revision; that revision is no longer listed on its Delivery Target, so its context cannot be read."
		);
	}
	return {
		changed: before.contextRevisionId !== after.contextRevisionId,
		from: before,
		status: "recorded",
		to: after,
	};
}

/**
 * Pure comparison of two stored Fulfilments, `from` against `to`, with the
 * project's catalog to read their revisions' contexts. Requirements pair up by
 * family and required item. Only what a Fulfilment records is compared; the
 * other sections say they are not recorded.
 */
export function diffFulfilments(
	from: StoredDeliveryFulfilment,
	to: StoredDeliveryFulfilment,
	catalog: Catalog
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
			assetVersions.removed.push(versionedEntryOf(before));
			changes.push({
				...requirementIdentityOf(before),
				from: mappingOf(before),
				to: null,
			});
			continue;
		}
		if (sameVersions(before.assetVersionIds, after.assetVersionIds)) {
			assetVersions.unchangedCount += 1;
		} else {
			assetVersions.changed.push({
				...requirementIdentityOf(after),
				fromAssetVersionIds: before.assetVersionIds,
				toAssetVersionIds: after.assetVersionIds,
			});
		}
		if (!sameMapping(before, after)) {
			changes.push({
				...requirementIdentityOf(after),
				from: mappingOf(before),
				to: mappingOf(after),
			});
		}
	}
	for (const [key, after] of toIndex) {
		if (!fromIndex.has(key)) {
			assetVersions.added.push(versionedEntryOf(after));
			changes.push({
				...requirementIdentityOf(after),
				from: null,
				to: mappingOf(after),
			});
		}
	}

	return {
		assetVersions,
		bundleMappings: { changes },
		context: diffContext(catalog, from, to),
		from: summaryOf(from),
		...(Object.fromEntries(
			Object.entries(notRecordedReasons).map(([key, reason]) => [
				key,
				notRecorded(reason),
			])
		) as Record<NotRecordedSectionKey, NotRecordedSection>),
		to: summaryOf(to),
	};
}
