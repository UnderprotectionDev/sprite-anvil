import {
	type OfflineConflictChoice,
	type OfflineReconcileInput,
	offlineConflictListSchema,
	offlineConflictResolveResponseSchema,
	offlineReconcileResponseSchema,
} from "@sprite-anvil/api/offline-conflict";
import { pixelDraftCommitResponseSchema } from "@sprite-anvil/api/pixel-editor";
import { projectApiUrl } from "./offline-staging-api";

function conflictsUrl(projectId: string) {
	return `${projectApiUrl(projectId)}/pixel-editor/offline-conflicts`;
}

async function readError(response: Response, fallback: string) {
	try {
		const body = (await response.json()) as {
			detail?: string;
			error?: string;
		};
		if (body.error) {
			return body.detail ? `${body.error}: ${body.detail}` : body.error;
		}
	} catch {
		// The body is not the server's error shape; use the status text.
	}
	return `${fallback} (status ${response.status}).`;
}

// conventions-exception: raw-fetch Offline Conflict routes are authenticated Hono Working Draft routes that render PNG versions through the verifying Asset Version storage; the oRPC context carries no object storage.
async function sendJson(url: string, method: "GET" | "POST", body?: unknown) {
	return await fetch(url, {
		method,
		credentials: "include",
		headers: body === undefined ? {} : { "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

/** Reconnect check of one staged Working Draft: finalize normally or open a record. */
export function reconcileStagedDraft(projectId: string) {
	return async (request: OfflineReconcileInput) => {
		const response = await sendJson(
			`${conflictsUrl(projectId)}/reconcile`,
			"POST",
			request
		);
		if (!response.ok) {
			throw new Error(
				await readError(response, "The reconnect check could not run")
			);
		}
		return offlineReconcileResponseSchema.parse(await response.json());
	};
}

export async function listOfflineConflicts(projectId: string) {
	const response = await sendJson(conflictsUrl(projectId), "GET");
	if (!response.ok) {
		throw new Error(
			await readError(response, "The conflict records could not be read")
		);
	}
	return offlineConflictListSchema.parse(await response.json());
}

export async function resolveOfflineConflict(
	projectId: string,
	conflictId: string,
	input: {
		choice: OfflineConflictChoice;
		confirmAbandon?: boolean;
		idempotencyKey: string;
		shownLocalDigest?: string;
	}
) {
	const response = await sendJson(
		`${conflictsUrl(projectId)}/${encodeURIComponent(conflictId)}/resolve`,
		"POST",
		input
	);
	if (!response.ok) {
		throw new Error(await readError(response, "The resolution failed"));
	}
	return offlineConflictResolveResponseSchema.parse(await response.json());
}

/** The existing Working Draft commit path, used when the pinned base is still current. */
export async function finalizeStagedDraft(
	projectId: string,
	draftId: string,
	expectedRevision: number
) {
	const response = await sendJson(
		`${projectApiUrl(projectId)}/pixel-editor/drafts/${encodeURIComponent(draftId)}/commit`,
		"POST",
		{ expectedRevision }
	);
	if (!response.ok) {
		throw new Error(await readError(response, "The commit failed"));
	}
	return pixelDraftCommitResponseSchema.parse(await response.json());
}

export function conflictPreviewUrl(
	projectId: string,
	conflictId: string,
	side: "base" | "cloud" | "local"
) {
	return `${conflictsUrl(projectId)}/${encodeURIComponent(conflictId)}/preview/${side}`;
}
