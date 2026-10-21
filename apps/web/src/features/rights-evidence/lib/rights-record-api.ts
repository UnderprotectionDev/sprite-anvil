import { ENV } from "@/env";

const trailingSlash = /\/$/;

function rightsRecordBaseUrl(projectId: string, assetRecordId: string) {
	const serverUrl = ENV.VITE_SERVER_URL.replace(trailingSlash, "");
	return `${serverUrl}/api/projects/${encodeURIComponent(projectId)}/asset-records/${encodeURIComponent(assetRecordId)}/rights-records`;
}

function referenceRightsRecordBaseUrl(
	projectId: string,
	assetRecordId: string,
	referenceId: string
) {
	const serverUrl = ENV.VITE_SERVER_URL.replace(trailingSlash, "");
	return `${serverUrl}/api/projects/${encodeURIComponent(projectId)}/asset-records/${encodeURIComponent(assetRecordId)}/references/${encodeURIComponent(referenceId)}/rights-records`;
}

export function rightsRecordEvidenceFileUrl(
	projectId: string,
	assetRecordId: string,
	rightsRecordId: string,
	referenceId?: string | null
) {
	if (referenceId) {
		return `${referenceRightsRecordBaseUrl(projectId, assetRecordId, referenceId)}/${encodeURIComponent(rightsRecordId)}/evidence-file`;
	}
	return `${rightsRecordBaseUrl(projectId, assetRecordId)}/${encodeURIComponent(rightsRecordId)}/evidence-file`;
}
