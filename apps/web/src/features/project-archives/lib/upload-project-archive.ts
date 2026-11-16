import { backgroundOperationSchema } from "@sprite-anvil/api/background-operations";
import { honoPostFileJson, projectApiUrl } from "@/utils/hono-api";

export interface ArchiveImportAttempt {
	file: File;
	idempotencyKey: string;
	name: string;
	projectId: string;
}

/** The server computes the streamed ZIP digest and verifies every archived file before restoring. */
export async function uploadProjectArchive(input: ArchiveImportAttempt) {
	return backgroundOperationSchema.parse(
		await honoPostFileJson(
			`${projectApiUrl(input.projectId)}/project-archives/import`,
			input.file,
			{
				"Content-Type": "application/zip",
				"Idempotency-Key": input.idempotencyKey,
				"X-Project-Archive-Size": String(input.file.size),
				"X-Project-Archive-Name": encodeURIComponent(input.name),
			},
			"The Project Archive could not be imported"
		)
	);
}
