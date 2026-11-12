import type {
	FulfilmentBundleCheck,
	FulfilmentCandidate,
	FulfilmentRequirement,
} from "./delivery-fulfilment";
import type { DeliveryTargetRevision } from "./delivery-planning-outputs";
import type { ExportBundle } from "./export-bundles";
import type { RuntimeValidationRecord } from "./runtime-validation";
import { evaluateRuntimeValidationCriterion } from "./runtime-validation-readiness";

type MappingBundle = Pick<
	ExportBundle,
	"createdAt" | "deliveryTargetRevisionId" | "id" | "manifestDigest"
> & {
	manifest: {
		files: { assetFamilyId: string; assetVersionId: string; itemId: string }[];
		requiredSets: { assetFamilyId: string; revisionId: string }[];
	};
};

export interface FulfilmentMappingInput {
	bundles: MappingBundle[];
	/** Runtime Validation Records by bundle id, oldest first. */
	recordsByBundleId: Map<string, RuntimeValidationRecord[]>;
	revision: DeliveryTargetRevision;
}

function byEarliest(left: MappingBundle, right: MappingBundle) {
	return (
		left.createdAt.localeCompare(right.createdAt) ||
		left.id.localeCompare(right.id)
	);
}

function candidateFor(
	bundle: MappingBundle,
	family: { assetFamilyId: string; requiredSetRevisionId: string },
	itemId: string
): FulfilmentCandidate | null {
	const sameList = bundle.manifest.requiredSets.some(
		(set) =>
			set.assetFamilyId === family.assetFamilyId &&
			set.revisionId === family.requiredSetRevisionId
	);
	const assetVersionIds = [
		...new Set(
			bundle.manifest.files
				.filter(
					(file) =>
						file.assetFamilyId === family.assetFamilyId &&
						file.itemId === itemId
				)
				.map((file) => file.assetVersionId)
		),
	].sort();
	return sameList && assetVersionIds.length > 0
		? {
				assetVersionIds,
				bundleId: bundle.id,
				manifestDigest: bundle.manifestDigest,
			}
		: null;
}

function statusOf(met: FulfilmentCandidate[]): FulfilmentRequirement["status"] {
	if (met.length === 0) {
		return "missing";
	}
	if (met.length === 1) {
		return "mapped";
	}
	const distinctPins = new Set(
		met.map((entry) => JSON.stringify(entry.assetVersionIds))
	);
	return distinctPins.size === 1 ? "agreed" : "conflict";
}

/**
 * Proposes the mapping from each required item of the revision to the exact
 * bundles and Asset Versions that meet it. Only bundles started for this very
 * revision are candidates. Several bundles with different pinned Asset
 * Versions are a conflict that only the user resolves; identical pins agree.
 * Nothing here picks the newest bundle or creates a Delivery Fulfilment.
 */
export function buildFulfilmentMapping(input: FulfilmentMappingInput) {
	const candidates = input.bundles
		.filter((bundle) => bundle.deliveryTargetRevisionId === input.revision.id)
		.sort(byEarliest);

	const requirements: FulfilmentRequirement[] = [];
	for (const family of input.revision.families) {
		const items = [...family.requiredItems, ...family.usageTests].filter(
			(item) => item.disposition === "required"
		);
		for (const item of items) {
			const met = candidates.flatMap((bundle) => {
				const candidate = candidateFor(bundle, family, item.id);
				return candidate ? [candidate] : [];
			});
			const status = statusOf(met);
			requirements.push({
				assetFamilyId: family.assetFamilyId,
				assetFamilyName: family.assetFamilyName,
				candidates: met,
				itemId: item.id,
				itemKind: item.kind,
				itemName: item.name,
				proposedBundleId:
					status === "mapped" || status === "agreed"
						? (met[0]?.bundleId ?? null)
						: null,
				requiredSetRevisionId: family.requiredSetRevisionId,
				status,
			});
		}
	}

	const bundleChecks: FulfilmentBundleCheck[] = candidates.map((bundle) => ({
		bundleId: bundle.id,
		createdAt: bundle.createdAt,
		manifestDigest: bundle.manifestDigest,
		runtimeValidation: evaluateRuntimeValidationCriterion(
			input.revision.runtimeValidationCriterion,
			bundle.id,
			input.recordsByBundleId.get(bundle.id) ?? []
		),
	}));
	return { bundleChecks, requirements };
}
