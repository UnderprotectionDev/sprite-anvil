import {
	type RuntimeValidationEvidence,
	type RuntimeValidationEvidenceKind,
	type RuntimeValidationEvidenceSource,
	runtimeValidationEvidenceSchema,
} from "@sprite-anvil/api/runtime-validation";
import { z } from "zod";
import { ENV } from "@/env";

const trailingSlash = /\/$/;
const uploadResultSchema = z.object({
	evidence: runtimeValidationEvidenceSchema,
	status: z.enum(["created", "replayed"]),
});

function recordUrl(projectId: string, recordId: string) {
	const serverUrl = ENV.VITE_SERVER_URL.replace(trailingSlash, "");
	return `${serverUrl}/api/projects/${encodeURIComponent(projectId)}/runtime-validation-records/${encodeURIComponent(recordId)}`;
}

export function runtimeValidationEvidenceDownloadUrl(
	projectId: string,
	recordId: string,
	evidenceId: string
) {
	return `${recordUrl(projectId, recordId)}/evidence/${encodeURIComponent(evidenceId)}/file`;
}

/** The server could not confirm the upload; the same idempotency key is safe to send again. */
export class RuntimeValidationUploadError extends Error {
	readonly outcomeUncertain: boolean;

	constructor(
		message: string,
		options: { cause?: unknown; outcomeUncertain: boolean }
	) {
		super(message, { cause: options.cause });
		this.name = "RuntimeValidationUploadError";
		this.outcomeUncertain = options.outcomeUncertain;
	}
}

function uploadErrorMessage(status: number) {
	switch (status) {
		case 400:
			return "The evidence file was not accepted. Check the kind and the file.";
		case 401:
			return "Sign in again to upload evidence.";
		case 404:
			return "This Runtime Validation Record was not found.";
		case 409:
			return "This upload key was already used for different evidence. Add the evidence again.";
		case 413:
			return "The file is larger than 5 MiB.";
		default:
			return "The upload could not be confirmed. Try again.";
	}
}

export async function uploadRuntimeValidationEvidenceFile(input: {
	file: File;
	idempotencyKey: string;
	kind: RuntimeValidationEvidenceKind;
	projectId: string;
	recordId: string;
	source: RuntimeValidationEvidenceSource;
}): Promise<{ evidence: RuntimeValidationEvidence; status: string }> {
	const formData = new FormData();
	formData.set("idempotencyKey", input.idempotencyKey);
	formData.set("kind", input.kind);
	formData.set("source", input.source);
	formData.set("file", input.file);
	let response: Response;
	try {
		// conventions-exception: raw-fetch The evidence upload is capped at 5 MiB by hono/body-limit before multipart parsing; the shared RPC handler has no per-procedure body limit.
		response = await fetch(
			`${recordUrl(input.projectId, input.recordId)}/evidence-file`,
			{ body: formData, credentials: "include", method: "POST" }
		);
	} catch (error) {
		throw new RuntimeValidationUploadError(
			"The upload could not be confirmed. Try again.",
			{ cause: error, outcomeUncertain: true }
		);
	}
	if (!response.ok) {
		throw new RuntimeValidationUploadError(
			uploadErrorMessage(response.status),
			{
				outcomeUncertain: response.status >= 500,
			}
		);
	}
	return uploadResultSchema.parse(await response.json());
}
