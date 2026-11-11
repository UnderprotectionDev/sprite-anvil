import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import { uploadRuntimeValidationEvidenceFile } from "../lib/runtime-validation-api";

/** The list is the source of truth: a write only invalidates it so the screen shows the re-read record. */
function useRefreshRecords() {
	const queryClient = useQueryClient();
	return () =>
		Promise.all([
			queryClient.invalidateQueries({
				queryKey: orpc.runtimeValidation.list.key(),
			}),
			queryClient.invalidateQueries({
				queryKey: orpc.runtimeValidation.deliveryTargetReadiness.key(),
			}),
		]);
}

export function useCreateRuntimeValidationRecord() {
	return useMutation({
		...orpc.runtimeValidation.create.mutationOptions(mutationMeta),
		onSuccess: useRefreshRecords(),
	});
}

export function useFinalizeRuntimeValidationOutcome() {
	return useMutation({
		...orpc.runtimeValidation.finalizeOutcome.mutationOptions(mutationMeta),
		onSuccess: useRefreshRecords(),
	});
}

export function useConfirmRuntimeValidationFailureSource() {
	return useMutation({
		...orpc.runtimeValidation.confirmFailureSource.mutationOptions(
			mutationMeta
		),
		onSuccess: useRefreshRecords(),
	});
}

export function useAddRuntimeValidationTextEvidence() {
	return useMutation({
		...orpc.runtimeValidation.addTextEvidence.mutationOptions(mutationMeta),
		onSuccess: useRefreshRecords(),
	});
}

export function useUploadRuntimeValidationEvidenceFile() {
	return useMutation({
		mutationFn: uploadRuntimeValidationEvidenceFile,
		onSuccess: useRefreshRecords(),
		...mutationMeta,
	});
}
