import { projectRecordResponseSchema } from "@sprite-anvil/api/project-access-store";
import type { ProjectContextCreateInput } from "@sprite-anvil/api/project-context";
import { honoGetBytes, honoPostFileJson, serverUrl } from "@/utils/hono-api";
import type { ProjectCoverRecord } from "@/utils/project-cover";
import { projectCoverUrl } from "@/utils/project-cover";

export type ProjectLook = { project: ProjectCoverRecord } | { file: File };

export async function createProjectWithLook(
	input: ProjectContextCreateInput & { requestId: string },
	look: ProjectLook
) {
	let file: File;
	if ("file" in look) {
		({ file } = look);
	} else {
		const url = projectCoverUrl(look.project);
		if (!url) {
			throw new Error("Selected project look is unavailable.");
		}
		const bytes = await honoGetBytes(url, "Could not load the selected look");
		// Both PNG and WebP are served by the verified private preview endpoints.
		const type = bytes[0] === 0x89 ? "image/png" : "image/webp";
		file = new File([new Uint8Array(bytes)], "project-look", { type });
	}
	const response = await honoPostFileJson(
		`${serverUrl()}/api/projects/with-look`,
		file,
		{
			"Content-Type": file.type,
			"X-Project-Name": encodeURIComponent(input.name),
			"X-Project-Id": input.requestId,
			"X-Project-Art-Direction": encodeURIComponent(input.generalArtDirection),
		},
		"Could not create project with its selected look"
	);
	return projectRecordResponseSchema.parse(response);
}
