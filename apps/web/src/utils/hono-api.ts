// conventions-exception: raw-fetch Authenticated files are streamed to and from the Hono byte endpoints, outside the oRPC JSON transport.
import { pixelEditorErrorSchema } from "@sprite-anvil/api/pixel-editor";
import { ENV } from "@/env";

const trailingSlashPattern = /\/$/u;

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

async function readJsonOrThrow(
	response: Response,
	fallback: string,
	uncertainWrite = false
) {
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
	try {
		return (await response.json()) as unknown;
	} catch (cause) {
		if (!uncertainWrite) {
			throw cause;
		}
		throw Object.assign(
			new Error("The successful response could not be read."),
			{ status: 500, cause }
		);
	}
}

/** Uploads a File directly; the browser streams it without a second in-memory byte copy. */
export async function honoPostFileJson(
	url: string,
	file: File,
	headers: Record<string, string>,
	fallback: string
) {
	return readJsonOrThrow(
		await fetch(url, {
			method: "POST",
			credentials: "include",
			headers,
			body: file,
		}),
		fallback,
		true
	);
}

/** The bytes of a verified file served by an authenticated Hono route. */
export async function honoGetBytes(
	url: string,
	fallback: string
): Promise<Uint8Array> {
	const response = await fetch(url, { credentials: "include" });
	if (!response.ok) {
		throw new HonoApiError(
			`${fallback} (status ${response.status}).`,
			response.status
		);
	}
	return new Uint8Array(await response.arrayBuffer());
}
