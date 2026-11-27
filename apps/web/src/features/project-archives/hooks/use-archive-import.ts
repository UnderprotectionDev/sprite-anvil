import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import type { ArchiveImportAttempt } from "../lib/upload-project-archive";
import { uploadProjectArchive } from "../lib/upload-project-archive";

export function isZip(file: File) {
	return file.size > 0 && file.name.toLowerCase().endsWith(".zip");
}

export function useArchiveImport(
	projectId: string,
	onAccepted?: (operation: BackgroundOperation) => void
) {
	const pending = useRef<ArchiveImportAttempt | null>(null);
	const upload = useMutation({
		mutationFn: uploadProjectArchive,
		meta: { errorPresentation: "inline" },
		onSuccess: onAccepted,
	});
	const uncertain = isWriteOutcomeUncertain(upload.error);
	const locked = upload.isPending || uncertain || upload.isSuccess;
	function submit(value: { name: string; file: File }) {
		const previous = pending.current;
		const attempt =
			previous?.file === value.file &&
			previous.name === value.name &&
			previous.projectId === projectId
				? previous
				: { ...value, projectId, idempotencyKey: crypto.randomUUID() };
		pending.current = attempt;
		upload.mutate(attempt);
	}
	function retry() {
		if (pending.current) {
			upload.mutate(pending.current);
		}
	}
	return { upload, uncertain, locked, submit, retry };
}
