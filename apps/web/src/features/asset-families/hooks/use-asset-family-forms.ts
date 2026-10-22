import type {
	AssetFamilyCatalog,
	AssetFamilyRelationshipType,
} from "@sprite-anvil/api/asset-families";
import type { AssetRecordIdentityCriterion } from "@sprite-anvil/api/asset-records";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import {
	assetFamilyFormSchema,
	assetRecordFormSchema,
	subjectIdentityFormSchema,
} from "../schemas";
import type { useAssetFamilyWrites } from "./use-asset-family-writes";

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

type SaveWrite = ReturnType<typeof useAssetFamilyWrites>["save"];

export function useAssetFamilyForms({
	assetVersionCatalog,
	catalog,
	projectId,
	save,
	visualWorlds,
}: {
	assetVersionCatalog: Pick<AssetVersionCatalog, "canonicalDesigns">;
	catalog: AssetFamilyCatalog | undefined;
	projectId: string;
	save: SaveWrite;
	visualWorlds: { id: string; name: string }[];
}) {
	const subjectIdentities = catalog?.subjectIdentities ?? [];
	const assetFamilies = catalog?.assetFamilies ?? [];
	const assetRecords = catalog?.assetRecords ?? [];

	// save() reports failures itself (toast and uncertain-outcome handling), so
	// the global mutation error toast is suppressed to avoid a duplicate.
	const createSubjectIdentity = useMutation(
		orpc.assetFamilies.createSubjectIdentity.mutationOptions(mutationMeta)
	);
	const createAssetFamily = useMutation(
		orpc.assetFamilies.createAssetFamily.mutationOptions(mutationMeta)
	);
	const createAssetRecord = useMutation(
		orpc.assetFamilies.createAssetRecord.mutationOptions(mutationMeta)
	);
	const createRelationship = useMutation(
		orpc.assetFamilies.createRelationship.mutationOptions(mutationMeta)
	);

	const subjectIdentityForm = useForm({
		defaultValues: { name: "" },
		onSubmit: ({ value }) =>
			save(
				"subject-identity",
				() =>
					createSubjectIdentity.mutateAsync({
						projectId,
						name: value.name,
					}),
				(record) => {
					subjectIdentityForm.setFieldValue("name", "");
					assetFamilyForm.setFieldValue("subjectIdentityId", record.id);
				},
				"Varlık Kimliği kaydedildi."
			),
		validators: { onSubmit: subjectIdentityFormSchema },
	});

	const assetFamilyForm = useForm({
		defaultValues: {
			name: "",
			subjectIdentityId: "",
			useContext: "",
			visualWorldId: "",
		},
		onSubmit: ({ value }) =>
			save(
				"asset-family",
				() =>
					createAssetFamily.mutateAsync({
						projectId,
						subjectIdentityId: selectId(
							subjectIdentities,
							value.subjectIdentityId
						),
						name: value.name,
						visualWorldId: selectId(visualWorlds, value.visualWorldId),
						useContext: value.useContext,
					}),
				(record) => {
					assetFamilyForm.setFieldValue("name", "");
					assetFamilyForm.setFieldValue("useContext", "");
					assetRecordForm.setFieldValue("assetFamilyId", record.id);
					relationshipForm.setFieldValue("assetFamilyId", record.id);
				},
				"Varlık Ailesi kaydedildi."
			),
		validators: { onSubmit: assetFamilyFormSchema },
	});

	const assetRecordForm = useForm({
		defaultValues: {
			assetFamilyId: "",
			identityCriteria: [] as AssetRecordIdentityCriterion[],
			name: "",
		},
		onSubmit: ({ value }) =>
			save(
				"asset-record",
				() =>
					createAssetRecord.mutateAsync({
						projectId,
						assetFamilyId: selectId(assetFamilies, value.assetFamilyId),
						name: value.name,
						identityCriteria: value.identityCriteria,
					}),
				(record) => {
					assetRecordForm.setFieldValue("name", "");
					assetRecordForm.setFieldValue("identityCriteria", []);
					relationshipForm.setFieldValue(
						"assetFamilyId",
						selectId(assetFamilies, value.assetFamilyId)
					);
					relationshipForm.setFieldValue("sourceAssetRecordId", record.id);
					relationshipForm.setFieldValue("targetAssetRecordId", "");
				},
				"Varlık Kaydı kaydedildi."
			),
		validators: { onSubmit: assetRecordFormSchema },
	});

	const relationshipForm = useForm({
		defaultValues: {
			assetFamilyId: "",
			sourceAssetRecordId: "",
			targetAssetRecordId: "",
			type: "direction" as AssetFamilyRelationshipType,
		},
		onSubmit: ({ value }) => {
			const relationshipFamilyId = selectId(assetFamilies, value.assetFamilyId);
			const familyRecords = assetRecords.filter(
				(record) => record.assetFamilyId === relationshipFamilyId
			);
			const selectedSourceId = selectId(
				familyRecords,
				value.sourceAssetRecordId
			);
			const selectedTargetId = selectId(
				familyRecords,
				value.targetAssetRecordId,
				selectedSourceId
			);
			const canonicalDesign = assetVersionCatalog.canonicalDesigns
				.filter((design) => design.assetFamilyId === relationshipFamilyId)
				.at(-1);
			const sourceAssetVersionId =
				value.type === "derivative"
					? canonicalDesign?.assetVersionId
					: undefined;
			const sourceAssetRecordId =
				value.type === "derivative"
					? (canonicalDesign?.assetRecordId ?? "")
					: selectedSourceId;
			const targetAssetRecordId =
				selectedTargetId === sourceAssetRecordId
					? (assetRecords.find(
							(record) =>
								record.assetFamilyId === relationshipFamilyId &&
								record.id !== sourceAssetRecordId
						)?.id ?? "")
					: selectedTargetId;
			return save(
				"relationship",
				() =>
					createRelationship.mutateAsync({
						projectId,
						assetFamilyId: relationshipFamilyId,
						sourceAssetRecordId,
						targetAssetRecordId,
						type: value.type,
						...(sourceAssetVersionId ? { sourceAssetVersionId } : {}),
					}),
				() => undefined,
				"İlişki kaydedildi."
			);
		},
	});

	const familyDraft = useStore(assetFamilyForm.store, (state) => state.values);
	const recordDraft = useStore(assetRecordForm.store, (state) => state.values);
	const relationshipDraft = useStore(
		relationshipForm.store,
		(state) => state.values
	);

	const selectedRelationshipFamilyId = selectId(
		assetFamilies,
		relationshipDraft.assetFamilyId
	);
	const relationshipRecords = assetRecords.filter(
		(record) => record.assetFamilyId === selectedRelationshipFamilyId
	);
	const selectedRelationshipSourceId = selectId(
		relationshipRecords,
		relationshipDraft.sourceAssetRecordId
	);

	return {
		assetFamilyForm,
		assetRecordForm,
		relationshipForm,
		selection: {
			assetRecordFamilyId: selectId(assetFamilies, recordDraft.assetFamilyId),
			relationshipFamilyId: selectedRelationshipFamilyId,
			relationshipSourceId: selectedRelationshipSourceId,
			relationshipTargetId: selectId(
				relationshipRecords,
				relationshipDraft.targetAssetRecordId,
				selectedRelationshipSourceId
			),
			subjectIdentityId: selectId(
				subjectIdentities,
				familyDraft.subjectIdentityId
			),
			visualWorldId: selectId(visualWorlds, familyDraft.visualWorldId),
		},
		subjectIdentityForm,
	};
}

export type AssetFamilyForms = ReturnType<typeof useAssetFamilyForms>;
