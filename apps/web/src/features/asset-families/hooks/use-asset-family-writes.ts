import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";

interface RefreshCatalogResult {
	isError: boolean;
}

export function useAssetFamilyWrites(
	refreshCatalog: () => Promise<RefreshCatalogResult>
) {
	const write = useMutation({
		...mutationMeta,
		mutationFn: async ({
			execute,
		}: {
			operation: string;
			execute: () => Promise<void>;
			successMessage: string;
		}) => {
			await execute();
			return refreshCatalog();
		},
	});
	const verify = useMutation({
		...mutationMeta,
		mutationFn: refreshCatalog,
	});
	const savingOperation = write.isPending ? write.variables.operation : null;
	const writeOutcomeUncertain =
		write.data?.isError === true ||
		(write.isError && isWriteOutcomeUncertain(write.error));
	let statusMessage: string | null = null;
	if (verify.isSuccess && !verify.data.isError) {
		statusMessage =
			"Asset Family list refreshed. Check your records for the result.";
	} else if (write.isSuccess) {
		statusMessage = write.data.isError
			? "The write completed. Check the Asset Family list before continuing."
			: write.variables.successMessage;
	}

	async function save<T>(
		operation: string,
		action: () => Promise<T>,
		onSuccess: (record: T) => void,
		successMessage: string
	) {
		if (writeOutcomeUncertain) {
			return;
		}
		verify.reset();
		try {
			await write.mutateAsync({
				operation,
				execute: async () => onSuccess(await action()),
				successMessage,
			});
		} catch (error) {
			toast.error(
				getErrorMessage(
					error,
					"Could not verify the result. Check the Asset Family list."
				)
			);
		}
	}

	async function checkWriteOutcome() {
		const result = await verify.mutateAsync().catch(() => undefined);
		if (!result || result.isError) {
			return;
		}
		write.reset();
	}

	return {
		checkWriteOutcome,
		isCheckingOutcome: verify.isPending,
		save,
		savingOperation,
		statusMessage,
		writeOutcomeUncertain,
		writesDisabled: savingOperation !== null || writeOutcomeUncertain,
	};
}
