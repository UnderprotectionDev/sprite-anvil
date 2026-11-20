import { projectApiUrl } from "@/utils/hono-api";
import { client } from "@/utils/orpc";
import type { StagedFileUpload } from "./send-staged-files";

/** Sends a staged PNG through the existing Import Inbox upload route. */
export const uploadStagedFileToImportInbox =
	(projectId: string): StagedFileUpload =>
	async (file, idempotencyKey) => {
		// conventions-exception: raw-fetch Import Inbox files stream the raw file body with size, name and idempotency headers to the verifying Hono upload route; the RPC link sends buffered JSON or multipart.
		const response = await fetch(`${projectApiUrl(projectId)}/import-inbox`, {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/octet-stream",
				"Idempotency-Key": idempotencyKey,
				"X-Import-Inbox-File-Name": encodeURIComponent(file.name),
				"X-Import-Inbox-Size": String(file.size),
				"X-Import-Inbox-Source-Type": file.type,
			},
			body: file.data,
		});
		return response.ok
			? { ok: true }
			: {
					ok: false,
					message: `The Import Inbox refused the file (status ${response.status}).`,
				};
	};

/** Opens (or recovers) the Working Draft of a source Asset Version for staging. */
export function fetchWorkingDraftForStaging(
	projectId: string,
	sourceAssetVersionId: string
) {
	return client.workingDrafts.open({ projectId, sourceAssetVersionId });
}
