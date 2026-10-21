import { useQuery } from "@tanstack/react-query";
import { type SyntheticEvent, useState } from "react";
import { toast } from "sonner";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";

export function useCollectionsManager(projectId: string) {
	const projectsQuery = useQuery({
		...orpc.projectContexts.list.queryOptions(),
	});
	const catalogQuery = useQuery({
		...orpc.collections.list.queryOptions({ input: { projectId } }),
	});
	const [collectionName, setCollectionName] = useState("");
	const [selectedCollectionId, setSelectedCollectionId] = useState<
		string | null
	>(null);
	const [selectedAssetRecordId, setSelectedAssetRecordId] = useState("");
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
			const result = await catalogQuery.refetch();
			if (result.isError) {
				throw result.error;
			}
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

	function createCollection(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		const name = collectionName.trim();
		if (name.length === 0) {
			return;
		}
		void save(
			"create",
			async () => {
				const collection = await client.collections.create({ projectId, name });
				setCollectionName("");
				setSelectedCollectionId(collection.id);
			},
			"Koleksiyon oluşturuldu."
		);
	}

	function addAssetRecord(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!(selectedCollection && selectedAssetRecordId)) {
			return;
		}
		void save(
			"add",
			async () => {
				await client.collections.addAssetRecord({
					projectId,
					collectionId: selectedCollection.id,
					assetRecordId: selectedAssetRecordId,
				});
				setSelectedAssetRecordId("");
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
				client.collections.removeAssetRecord({
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
			const result = await catalogQuery.refetch();
			if (result.isError) {
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
		setSelectedAssetRecordId("");
		setStatusMessage(null);
	}

	return {
		addAssetRecord,
		assetRecordsById,
		allMemberships,
		availableAssetRecords,
		catalog,
		catalogQuery,
		checkWriteOutcome,
		collectionName,
		collections,
		createCollection,
		isCheckingOutcome,
		memberships,
		project,
		projectsQuery,
		removeAssetRecord,
		savingOperation,
		selectedAssetRecordId,
		selectedCollection,
		selectCollection,
		setCollectionName,
		setSelectedAssetRecordId,
		statusMessage,
		writeOutcomeUncertain,
		writesDisabled,
	};
}
