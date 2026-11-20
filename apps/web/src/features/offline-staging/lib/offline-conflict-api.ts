import { projectApiUrl } from "@/utils/hono-api";

export function conflictPreviewUrl(
	projectId: string,
	conflictId: string,
	side: "base" | "cloud" | "local"
) {
	return `${projectApiUrl(projectId)}/pixel-editor/offline-conflicts/${encodeURIComponent(conflictId)}/preview/${side}`;
}
