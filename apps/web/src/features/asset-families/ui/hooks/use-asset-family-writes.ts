import { type SyntheticEvent, useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";

interface RefetchCatalogResult {
	error: unknown;
	isError: boolean;
}

export function useAssetFamilyWrites(
	refetchCatalog: () => Promise<RefetchCatalogResult>
) {
	const [savingOperation, setSavingOperation] = useState<string | null>(null);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingOutcome, setIsCheckingOutcome] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
		setErrorMessage(null);
		setStatusMessage(null);
		setSavingOperation(operation);
		try {
			const record = await action();
			onSuccess(record);
			const result = await refetchCatalog();
			setStatusMessage(successMessage);
			if (result.isError) {
				setErrorMessage(
					`Kayıt kaydedildi ancak liste yenilenemedi. ${getErrorMessage(
						result.error,
						"Listeyi yeniden yükleyin.",
						"query"
					)}`
				);
			}
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				setWriteOutcomeUncertain(true);
			}
			setErrorMessage(
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
				setErrorMessage(
					`Varlık Ailesi listesi yenilenemedi. ${getErrorMessage(
						result.error,
						"Yeniden deneyin.",
						"query"
					)}`
				);
				return;
			}
			setWriteOutcomeUncertain(false);
			setErrorMessage(null);
			setStatusMessage(
				"Varlık Ailesi listesi yenilendi. İşlem sonucunu kayıtlarınızda kontrol edin."
			);
		} finally {
			setIsCheckingOutcome(false);
		}
	}

	return {
		checkWriteOutcome,
		errorMessage,
		isCheckingOutcome,
		save,
		savingOperation,
		statusMessage,
		writeOutcomeUncertain,
		writesDisabled: savingOperation !== null || writeOutcomeUncertain,
	};
}
