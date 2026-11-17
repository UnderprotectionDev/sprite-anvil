import { downloadZip } from "@/utils/download-zip";
import { honoGetBytes, projectApiUrl } from "@/utils/hono-api";

/** Downloads the authorized, integrity-checked portable archive with its included file bytes. */
export async function downloadProjectArchive(
	projectId: string,
	archiveId: string
) {
	const bytes = await honoGetBytes(
		`${projectApiUrl(projectId)}/project-archives/${encodeURIComponent(archiveId)}/content`,
		"The Project Archive could not be downloaded"
	);
	downloadZip(bytes, `project-archive-${archiveId}.zip`);
}
