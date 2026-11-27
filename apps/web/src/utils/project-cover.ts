import { projectApiUrl } from "@/utils/hono-api";

export interface ProjectCoverRecord {
	hasPreview?: boolean;
	id: string;
	name: string;
	previewAssetVersionId?: string | null;
}
export function projectCoverUrl(project: ProjectCoverRecord) {
	if (project.hasPreview) {
		return `${projectApiUrl(project.id)}/preview`;
	}
	return project.previewAssetVersionId
		? `${projectApiUrl(project.id)}/asset-versions/${encodeURIComponent(project.previewAssetVersionId)}/preview`
		: undefined;
}
