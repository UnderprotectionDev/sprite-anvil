import type { DeliveryTargetDraftSaveInput } from "@sprite-anvil/api/delivery-planning-inputs";
import type { DeliveryTargetRevision } from "@sprite-anvil/api/delivery-planning-outputs";
import type { DeliveryTargetFormValues } from "../schemas";

export interface FamilyListChoice {
	id: string;
	name: string;
	/** Required Items List revisions of the family, newest first. */
	revisions: { id: string; isActive: boolean; revisionNumber: number }[];
}

function defaultRevisionId(family: FamilyListChoice) {
	return (
		family.revisions.find((revision) => revision.isActive)?.id ??
		family.revisions[0]?.id ??
		""
	);
}

/** Starts a new target with nothing pinned and no policy chosen, or a re-version from the revision it moves on from. */
export function defaultFormValues(
	families: FamilyListChoice[],
	base: {
		name: string;
		purpose: string;
		revision: DeliveryTargetRevision | null;
	}
): DeliveryTargetFormValues {
	const pinned = new Map(
		(base.revision?.families ?? []).map((family) => [
			family.assetFamilyId,
			family,
		])
	);
	const overrides = new Map(
		(base.revision?.productionEvidencePolicy.familyRequirements ?? []).map(
			(entry) => [entry.assetFamilyId, entry.requirement]
		)
	);
	return {
		acceptableStates:
			base.revision?.rightsEvidencePolicy.acceptableStates ?? [],
		defaultProductionRequirement:
			base.revision?.productionEvidencePolicy.defaultRequirement ?? "",
		families: families.map((family) => ({
			assetFamilyId: family.id,
			assetFamilyName: family.name,
			productionRequirement: overrides.get(family.id) ?? "default",
			requiredSetRevisionId:
				pinned.get(family.id)?.requiredSetRevisionId ??
				defaultRevisionId(family),
			selected: pinned.has(family.id),
		})),
		name: base.name,
		purpose: base.purpose as DeliveryTargetFormValues["purpose"],
		requireRecordFor:
			base.revision?.rightsEvidencePolicy.requireRecordFor ?? [],
	};
}

/** Builds the exact save input; per-family requirements are sent only for pinned families that differ from the default. */
export function toSaveInput(
	values: DeliveryTargetFormValues,
	ids: {
		contextRevisionId: string;
		deliveryTargetId: string;
		draftId: string;
		projectId: string;
	}
): DeliveryTargetDraftSaveInput {
	const { defaultProductionRequirement, purpose } = values;
	if (purpose === "" || defaultProductionRequirement === "") {
		throw new Error(
			"Choose a purpose and a default requirement before saving."
		);
	}
	const pinned = values.families.filter((family) => family.selected);
	return {
		contextRevisionId: ids.contextRevisionId,
		deliveryTargetId: ids.deliveryTargetId,
		families: pinned.map((family) => ({
			assetFamilyId: family.assetFamilyId,
			requiredSetRevisionId: family.requiredSetRevisionId,
		})),
		id: ids.draftId,
		name: values.name.trim(),
		productionEvidencePolicy: {
			defaultRequirement: defaultProductionRequirement,
			familyRequirements: pinned.flatMap((family) =>
				family.productionRequirement === "default"
					? []
					: [
							{
								assetFamilyId: family.assetFamilyId,
								requirement: family.productionRequirement,
							},
						]
			),
		},
		projectId: ids.projectId,
		purpose,
		rightsEvidencePolicy: {
			acceptableStates: values.acceptableStates,
			requireRecordFor: values.requireRecordFor,
		},
	};
}
