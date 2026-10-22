import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import {
	collectionMembershipFormSchema,
	collectionNameFormSchema,
} from "../schemas";

function useCollectionNameForm(onSubmit: (name: string) => void) {
	return useForm({
		defaultValues: { name: "" },
		onSubmit: ({ value }) => onSubmit(value.name),
		validators: { onSubmit: collectionNameFormSchema },
	});
}

function useCollectionMembershipForm(
	onSubmit: (assetRecordId: string) => void
) {
	return useForm({
		defaultValues: { assetRecordId: "" },
		onSubmit: ({ value }) => onSubmit(value.assetRecordId),
		validators: { onSubmit: collectionMembershipFormSchema },
	});
}

export type CollectionNameForm = ReturnType<typeof useCollectionNameForm>;
export type CollectionMembershipForm = ReturnType<
	typeof useCollectionMembershipForm
>;

export function useCollectionsManager(projectId: string) {
	const projectsQuery = useQuery({
		...orpc.projectContexts.list.queryOptions(),
	});
	const catalogQuery = useQuery({
		...orpc.collections.list.queryOptions({ input: { projectId } }),
	});
	const queryClient = useQueryClient();
	const catalogKey = orpc.collections.list.queryKey({ input: { projectId } });
	// save() reports failures itself (toast and uncertain-outcome handling), so
	// the global mutation error toast is suppressed to avoid a duplicate.
	const createCollectionMutation = useMutation(
		orpc.collections.create.mutationOptions(mutationMeta)
	);
	const addAssetRecordMutation = useMutation(
		orpc.collections.addAssetRecord.mutationOptions(mutationMeta)
	);
	const removeAssetRecordMutation = useMutation(
		orpc.collections.removeAssetRecord.mutationOptions(mutationMeta)
	);
	const collectionForm = useCollectionNameForm(createCollection);
	const membershipForm = useCollectionMembershipForm(addAssetRecord);
	const [selectedCollectionId, setSelectedCollectionId] = useState<
		string | null
	>(null);
	const [savingOperation, setSavingOperation] = useState<string | null>(null);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingOutcome, setIsCheckingOutcome] = useState(false);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const project = projectsQuery.data?.find((item) => item.id === projectId);
	const catalog = catalogQuery.data;
	const collections = catalog?.collections ?? [];
	const allMemberships = catalog?.memberships ?? [];
	const selectedCollection =
		collections.find((item) => item.id === selectedCollectionId) ??
		collections[0] ??
		null;
	const memberships = catalog?.memberships.filter(
		(membership) => membership.collectionId === selectedCollection?.id
	);
	const assetRecordsById = new Map(
		(catalog?.assetRecords ?? []).map((assetRecord) => [
			assetRecord.id,
			assetRecord,
		])
	);
	const selectedAssetRecordIds = new Set(
		(memberships ?? []).map((membership) => membership.assetRecordId)
	);
	const availableAssetRecords = (catalog?.assetRecords ?? []).filter(
		(assetRecord) =>
			assetRecord.availability !== "erased" &&
			!selectedAssetRecordIds.has(assetRecord.id)
	);
	const writesDisabled =
		savingOperation !== null || writeOutcomeUncertain || catalogQuery.isError;

	async function save(
		operation: string,
		action: () => Promise<unknown>,
		successMessage: string
	) {
		if (writesDisabled) {
			return;
		}
		setSavingOperation(operation);
		setStatusMessage(null);
		try {
			await action();
			await queryClient.invalidateQueries(
				{ queryKey: catalogKey },
				{ throwOnError: true }
			);
			setStatusMessage(successMessage);
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				setWriteOutcomeUncertain(true);
			}
			toast.error(
				getErrorMessage(
					error,
					"İşlemin sonucu doğrulanamadı. Koleksiyon listesini kontrol edin."
				)
			);
		} finally {
			setSavingOperation(null);
		}
	}

	function createCollection(collectionName: string) {
		const name = collectionName.trim();
		if (name.length === 0) {
			return;
		}
		void save(
			"create",
			async () => {
				const collection = await createCollectionMutation.mutateAsync({
					projectId,
					name,
				});
				collectionForm.reset();
				setSelectedCollectionId(collection.id);
			},
			"Koleksiyon oluşturuldu."
		);
	}

	function addAssetRecord(selectedAssetRecordId: string) {
		if (!(selectedCollection && selectedAssetRecordId)) {
			return;
		}
		void save(
			"add",
			async () => {
				await addAssetRecordMutation.mutateAsync({
					projectId,
					collectionId: selectedCollection.id,
					assetRecordId: selectedAssetRecordId,
				});
				membershipForm.reset();
			},
			"Varlık Kaydı Koleksiyona eklendi."
		);
	}

	function removeAssetRecord(assetRecordId: string) {
		if (!selectedCollection) {
			return;
		}
		void save(
			`remove-${assetRecordId}`,
			() =>
				removeAssetRecordMutation.mutateAsync({
					projectId,
					collectionId: selectedCollection.id,
					assetRecordId,
				}),
			"Varlık Kaydı Koleksiyondan kaldırıldı."
		);
	}

	async function checkWriteOutcome() {
		setIsCheckingOutcome(true);
		try {
			try {
				await queryClient.invalidateQueries(
					{ queryKey: catalogKey },
					{ throwOnError: true }
				);
			} catch {
				return;
			}
			setWriteOutcomeUncertain(false);
			setStatusMessage(
				"Koleksiyonlar yenilendi. İşlem sonucunu listedeki kayıtlarda kontrol edin."
			);
		} finally {
			setIsCheckingOutcome(false);
		}
	}

	function selectCollection(collectionId: string) {
		setSelectedCollectionId(collectionId);
		membershipForm.reset();
		setStatusMessage(null);
	}

	return {
		assetRecordsById,
		allMemberships,
		availableAssetRecords,
		catalog,
		catalogQuery,
		checkWriteOutcome,
		collectionForm,
		collections,
		isCheckingOutcome,
		membershipForm,
		memberships,
		project,
		projectsQuery,
		removeAssetRecord,
		savingOperation,
		selectedCollection,
		selectCollection,
		statusMessage,
		writeOutcomeUncertain,
		writesDisabled,
	};
}
