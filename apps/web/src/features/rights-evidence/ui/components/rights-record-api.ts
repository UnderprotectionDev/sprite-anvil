import { ENV } from "@/env";

const trailingSlash = /\/$/;

function rightsRecordBaseUrl(projectId: string, assetRecordId: string) {
	const serverUrl = ENV.VITE_SERVER_URL.replace(trailingSlash, "");
	return `${serverUrl}/api/projects/${encodeURIComponent(projectId)}/asset-records/${encodeURIComponent(assetRecordId)}/rights-records`;
}

export function rightsRecordEvidenceFileUrl(
	projectId: string,
	assetRecordId: string,
	rightsRecordId: string
) {
	return `${rightsRecordBaseUrl(projectId, assetRecordId)}/${encodeURIComponent(rightsRecordId)}/evidence-file`;
}
