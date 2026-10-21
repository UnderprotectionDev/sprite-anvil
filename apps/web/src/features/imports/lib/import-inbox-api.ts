import { supportReferenceSchema } from "@sprite-anvil/api/error-contract";
import { ENV } from "@/env";

const trailingSlashPattern = /\/$/;

function importInboxBaseUrl(projectId: string) {
	const serverUrl = ENV.VITE_SERVER_URL.replace(trailingSlashPattern, "");
	return `${serverUrl}/api/projects/${encodeURIComponent(projectId)}/import-inbox`;
}

export function importInboxUrl(projectId: string) {
	return importInboxBaseUrl(projectId);
}

export function importInboxFileUrl(projectId: string, entryId: string) {
	return `${importInboxBaseUrl(projectId)}/${encodeURIComponent(entryId)}/file`;
}

export function sourceMetadataMappingUrl(projectId: string, entryId: string) {
	return `${importInboxBaseUrl(projectId)}/${encodeURIComponent(entryId)}/source-metadata-mapping-proposals`;
}

export function sourceMetadataMappingFinalizationUrl(
	projectId: string,
	entryId: string,
	proposalId: string
) {
	return `${sourceMetadataMappingUrl(projectId, entryId)}/${encodeURIComponent(proposalId)}/finalization`;
}

export function readSupportReference(value: unknown) {
	if (typeof value !== "object" || value === null) {
		return;
	}
	const { supportReference } = value as { supportReference?: unknown };
	const result = supportReferenceSchema.safeParse(supportReference);
	return result.success ? result.data : undefined;
}
