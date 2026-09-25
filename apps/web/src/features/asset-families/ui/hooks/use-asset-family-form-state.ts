import type {
	AssetFamilyCatalog,
	AssetFamilyRelationshipType,
} from "@sprite-anvil/api/asset-families";
import type { AssetRecordIdentityCriterion } from "@sprite-anvil/api/asset-records";
import { useState } from "react";

function selectId(
	items: { id: string }[],
	selectedId: string,
	excludedId?: string
) {
	return (
		items.find((item) => item.id === selectedId)?.id ??
		items.find((item) => item.id !== excludedId)?.id ??
		""
	);
}

export function useAssetFamilyFormState(
	catalog: AssetFamilyCatalog | undefined,
	visualWorlds: { id: string; name: string }[]
) {
	const subjectIdentities = catalog?.subjectIdentities ?? [];
	const assetFamilies = catalog?.assetFamilies ?? [];
	const assetRecords = catalog?.assetRecords ?? [];
	const [subjectIdentityName, setSubjectIdentityName] = useState("");
	const [familyName, setFamilyName] = useState("");
	const [familyUseContext, setFamilyUseContext] = useState("");
	const [assetRecordName, setAssetRecordName] = useState("");
	const [assetRecordIdentityCriteria, setAssetRecordIdentityCriteria] =
		useState<AssetRecordIdentityCriterion[]>([]);
	const [selectedSubjectIdentityIdState, setSelectedSubjectIdentityId] =
		useState("");
	const [selectedVisualWorldIdState, setSelectedVisualWorldId] = useState("");
	const [selectedAssetRecordFamilyIdState, setSelectedAssetRecordFamilyId] =
		useState("");
	const [selectedRelationshipFamilyIdState, setSelectedRelationshipFamilyId] =
		useState("");
	const [selectedRelationshipSourceIdState, setSelectedRelationshipSourceId] =
		useState("");
	const [selectedRelationshipTargetIdState, setSelectedRelationshipTargetId] =
		useState("");
	const [relationshipType, setRelationshipType] =
		useState<AssetFamilyRelationshipType>("direction");

	const selectedSubjectIdentityId = selectId(
		subjectIdentities,
		selectedSubjectIdentityIdState
	);
	const selectedVisualWorldId = selectId(
		visualWorlds,
		selectedVisualWorldIdState
	);
	const selectedAssetRecordFamilyId = selectId(
		assetFamilies,
		selectedAssetRecordFamilyIdState
	);
	const selectedRelationshipFamilyId = selectId(
		assetFamilies,
		selectedRelationshipFamilyIdState
	);
	const relationshipRecords = assetRecords.filter(
		(assetRecord) => assetRecord.assetFamilyId === selectedRelationshipFamilyId
	);
	const selectedRelationshipSourceId = selectId(
		relationshipRecords,
		selectedRelationshipSourceIdState
	);
	const selectedRelationshipTargetId = selectId(
		relationshipRecords,
		selectedRelationshipTargetIdState,
		selectedRelationshipSourceId
	);

	return {
		changeHandlers: {
			onAssetRecordFamilyChange: setSelectedAssetRecordFamilyId,
			onAssetRecordNameChange: setAssetRecordName,
			onAssetRecordIdentityCriterionToggle: (
				criterion: AssetRecordIdentityCriterion
			) => {
				setAssetRecordIdentityCriteria((current) =>
					current.includes(criterion)
						? current.filter((value) => value !== criterion)
						: [...current, criterion]
				);
			},
			onFamilyNameChange: setFamilyName,
			onFamilyUseContextChange: setFamilyUseContext,
			onRelationshipFamilyChange: (familyId: string) => {
				setSelectedRelationshipFamilyId(familyId);
				setSelectedRelationshipSourceId("");
				setSelectedRelationshipTargetId("");
			},
			onRelationshipSourceChange: setSelectedRelationshipSourceId,
			onRelationshipTargetChange: setSelectedRelationshipTargetId,
			onRelationshipTypeChange: setRelationshipType,
			onSubjectIdentityChange: setSelectedSubjectIdentityId,
			onSubjectIdentityNameChange: setSubjectIdentityName,
			onVisualWorldChange: setSelectedVisualWorldId,
		},
		created: {
			assetRecord: (id: string) => {
				setAssetRecordName("");
				setAssetRecordIdentityCriteria([]);
				setSelectedRelationshipFamilyId(selectedAssetRecordFamilyId);
				setSelectedRelationshipSourceId(id);
				setSelectedRelationshipTargetId("");
			},
			assetFamily: (id: string) => {
				setFamilyName("");
				setFamilyUseContext("");
				setSelectedAssetRecordFamilyId(id);
				setSelectedRelationshipFamilyId(id);
			},
			subjectIdentity: (id: string) => {
				setSubjectIdentityName("");
				setSelectedSubjectIdentityId(id);
			},
		},
		state: {
			assetRecordName,
			assetRecordIdentityCriteria,
			familyName,
			familyUseContext,
			relationshipType,
			selectedAssetRecordFamilyId,
			selectedRelationshipFamilyId,
			selectedRelationshipSourceId,
			selectedRelationshipTargetId,
			selectedSubjectIdentityId,
			selectedVisualWorldId,
			subjectIdentityName,
		},
	};
}
