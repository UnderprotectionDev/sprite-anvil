import { type SyntheticEvent, useState } from "react";
import { toast } from "sonner";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";

interface RefetchCatalogResult {
	isError: boolean;
}

export function useAssetFamilyWrites(
	refetchCatalog: () => Promise<RefetchCatalogResult>
) {
	const [savingOperation, setSavingOperation] = useState<string | null>(null);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingOutcome, setIsCheckingOutcome] = useState(false);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	async function save<T>(
		event: SyntheticEvent<HTMLFormElement>,
		operation: string,
		action: () => Promise<T>,
		onSuccess: (record: T) => void,
		successMessage: string
	) {
		event.preventDefault();
		if (writeOutcomeUncertain) {
			return;
		}
		setStatusMessage(null);
		setSavingOperation(operation);
		try {
			const record = await action();
			onSuccess(record);
			await refetchCatalog();
			setStatusMessage(successMessage);
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				setWriteOutcomeUncertain(true);
			}
			toast.error(
				getErrorMessage(
					error,
					"İşlemin sonucu doğrulanamadı. Varlık Ailesi listesini kontrol edin."
				)
			);
		} finally {
			setSavingOperation(null);
		}
	}

	async function checkWriteOutcome() {
		setIsCheckingOutcome(true);
		try {
			const result = await refetchCatalog();
			if (result.isError) {
				return;
			}
			setWriteOutcomeUncertain(false);
			setStatusMessage(
				"Varlık Ailesi listesi yenilendi. İşlem sonucunu kayıtlarınızda kontrol edin."
			);
		} finally {
			setIsCheckingOutcome(false);
		}
	}

	return {
		checkWriteOutcome,
		isCheckingOutcome,
		save,
		savingOperation,
		statusMessage,
		writeOutcomeUncertain,
		writesDisabled: savingOperation !== null || writeOutcomeUncertain,
	};
}
