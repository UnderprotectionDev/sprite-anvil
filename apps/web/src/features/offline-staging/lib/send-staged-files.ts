import type {
	OfflineStagingStore,
	StagedFileRow,
} from "./offline-staging-store";

export type StagedFileUpload = (
	file: StagedFileRow,
	idempotencyKey: string
) => Promise<{ ok: true } | { message: string; ok: false }>;

export interface SendStagedFilesResult {
	failed: { id: string; message: string }[];
	sent: string[];
}

/**
 * Hands staged files to the existing Import Inbox. The staged id is the
 * idempotency key, so a retry after an uncertain network failure cannot create
 * a second entry. A staged file leaves the stage only after the upload succeeds.
 * Entering the Import Inbox approves nothing.
 */
export async function sendStagedFiles({
	projectId,
	store,
	upload,
}: {
	projectId: string;
	store: Pick<OfflineStagingStore, "listStagedFiles" | "removeStagedFile">;
	upload: StagedFileUpload;
}): Promise<SendStagedFilesResult> {
	const result: SendStagedFilesResult = { sent: [], failed: [] };
	// Files are sent one at a time, in staging order, so a failure never reorders them.
	for (const file of await store.listStagedFiles(projectId)) {
		try {
			// biome-ignore lint/performance/noAwaitInLoops: Staged files are sent sequentially.
			const outcome = await upload(file, file.id);
			if (outcome.ok) {
				await store.removeStagedFile(file.id);
				result.sent.push(file.id);
			} else {
				result.failed.push({ id: file.id, message: outcome.message });
			}
		} catch (error) {
			result.failed.push({
				id: file.id,
				message: error instanceof Error ? error.message : "Upload failed",
			});
		}
	}
	return result;
}
