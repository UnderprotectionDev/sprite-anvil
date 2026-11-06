// conventions-exception: raw-fetch Authenticated Hono project routes (Working Drafts, Offline Conflict Records) render and store PNG bytes through the verifying Asset Version storage; the oRPC context carries no object storage.
import { pixelEditorErrorSchema } from "@sprite-anvil/api/pixel-editor";
import { ENV } from "@/env";

const trailingSlashPattern = /\/$/;

/** Base URL of the API server without a trailing slash. */
export function serverUrl() {
	return ENV.VITE_SERVER_URL.replace(trailingSlashPattern, "");
}

/** Base URL of the authenticated Hono routes of one project. */
export function projectApiUrl(projectId: string) {
	return `${serverUrl()}/api/projects/${encodeURIComponent(projectId)}`;
}

/** A Hono route refused the request; `message` is the server's own error text when it sent one. */
export class HonoApiError extends Error {
	readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "HonoApiError";
		this.status = status;
	}
}

async function readJsonOrThrow(response: Response, fallback: string) {
	if (!response.ok) {
		const parsed = pixelEditorErrorSchema.safeParse(
			await response.json().catch(() => null)
		);
		throw new HonoApiError(
			parsed.success
				? [parsed.data.error, parsed.data.detail].filter(Boolean).join(": ")
				: `${fallback} (status ${response.status}).`,
			response.status
		);
	}
	return (await response.json()) as unknown;
}

export async function honoGetJson(url: string, fallback: string) {
	return readJsonOrThrow(
		await fetch(url, { credentials: "include" }),
		fallback
	);
}

export async function honoPostJson(
	url: string,
	body: unknown,
	fallback: string
) {
	return readJsonOrThrow(
		await fetch(url, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body ?? {}),
		}),
		fallback
	);
}
