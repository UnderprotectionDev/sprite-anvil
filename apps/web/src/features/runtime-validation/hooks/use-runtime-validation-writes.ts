import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import { uploadRuntimeValidationEvidenceFile } from "../lib/runtime-validation-api";

/** The list is the source of truth: a write only invalidates it so the screen shows the re-read record. */
function useRefreshRecords() {
	const queryClient = useQueryClient();
	return () =>
		queryClient.invalidateQueries({
			queryKey: orpc.runtimeValidation.list.key(),
		});
}

export function useCreateRuntimeValidationRecord() {
	return useMutation({
		...orpc.runtimeValidation.create.mutationOptions(mutationMeta),
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
