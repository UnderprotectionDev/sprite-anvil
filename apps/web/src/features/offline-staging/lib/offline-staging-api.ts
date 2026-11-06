import { pixelDraftSchema } from "@sprite-anvil/api/pixel-editor";
import { ENV } from "@/env";
import type { StagedFileUpload } from "./send-staged-files";

const trailingSlashPattern = /\/$/;

export function projectApiUrl(projectId: string) {
	const serverUrl = ENV.VITE_SERVER_URL.replace(trailingSlashPattern, "");
	return `${serverUrl}/api/projects/${encodeURIComponent(projectId)}`;
}

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
export async function fetchWorkingDraftForStaging(
	projectId: string,
	sourceAssetVersionId: string
) {
	// conventions-exception: raw-fetch Working Draft routes are authenticated Hono project routes that render and store PNG bytes through the verifying Asset Version storage; the oRPC context carries no object storage.
	const response = await fetch(
		`${projectApiUrl(projectId)}/pixel-editor/drafts`,
		{
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ sourceAssetVersionId }),
		}
	);
	if (!response.ok) {
		throw new Error(
			`The Working Draft could not be opened (status ${response.status}).`
		);
	}
	return pixelDraftSchema.parse(await response.json());
}
