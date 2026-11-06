import { createHash } from "node:crypto";
import {
	checkOfflineConflictContractVersion,
	type OfflineConflictContent,
	type OfflineConflictEntry,
	type OfflineConflictResolutionRow,
	type OfflineConflictView,
	offlineConflictViewSchema,
	parseOfflineConflictContent,
} from "@sprite-anvil/api/offline-conflict";
import type { PixelOperation } from "@sprite-anvil/api/pixel-editor";
import {
	type Failure,
	failure,
	type Outcome,
	success,
} from "./pixel-editor-context";

/**
 * Reading an Offline Conflict Record: its stored content, the digest of the
 * local draft and the public view. Nothing here writes.
 */

export interface OperationHistory {
	appliedOperationCount: number;
	operations: PixelOperation[];
}

export function appliedOperations(content: OperationHistory) {
	return content.operations.slice(0, content.appliedOperationCount);
}

export function localDigest(local: OperationHistory) {
	return createHash("sha256")
		.update(
			JSON.stringify({
				operations: local.operations,
				appliedOperationCount: local.appliedOperationCount,
			})
		)
		.digest("hex");
}

export function unsupported(message: string): Failure {
	return failure("Offline Conflict Record contract unsupported", 422, message);
}

/** Stops a request that declares no readable or an unknown-major contract version. */
export function checkRequestContractVersion(body: unknown): Failure | null {
	const declared =
		typeof body === "object" && body !== null
			? (body as { contractVersion?: unknown }).contractVersion
			: undefined;
	const version = checkOfflineConflictContractVersion(declared);
	if (version.ok) {
		return null;
	}
	return version.reason === "unsupported"
		? unsupported(version.message)
		: failure("Invalid Offline Conflict request", 400, version.message);
}

export interface ReadableEntry {
	content: OfflineConflictContent;
	entry: OfflineConflictEntry;
}

export function readEntry(entry: OfflineConflictEntry): Outcome<ReadableEntry> {
	const parsed = parseOfflineConflictContent(entry.record.content);
	if (!parsed.ok) {
		return parsed.reason === "unsupported"
			? unsupported(parsed.message)
			: failure("Invalid Offline Conflict request", 422, parsed.message);
	}
	return success({ content: parsed.content, entry });
}

/** A create-candidate claim whose Candidate Version is not stored yet is not a resolution. */
export function isPendingResolution(resolution: OfflineConflictResolutionRow) {
	return (
		resolution.choice === "create-candidate" &&
		resolution.resultAssetVersionId === null
	);
}

function resolutionView(resolution: OfflineConflictResolutionRow) {
	return {
		id: resolution.id,
		choice: resolution.choice,
		resolvedAt: resolution.resolvedAt.toISOString(),
		resolvedByUserId: resolution.resolvedByUserId,
		resultAssetVersionId: resolution.resultAssetVersionId,
		idempotencyKey: resolution.idempotencyKey,
	};
}

export function buildView({
	content,
	entry,
}: ReadableEntry): OfflineConflictView {
	const { record, resolution } = entry;
	return offlineConflictViewSchema.parse({
		id: record.id,
		projectId: record.projectId,
		draftId: record.draftId,
		contractVersion: content.contractVersion,
		createdAt: record.createdAt.toISOString(),
		base: content.base,
		cloud: content.cloud,
		local: content.local,
		localDigest: record.localDigest,
		resolution:
			resolution && !isPendingResolution(resolution)
				? resolutionView(resolution)
				: null,
	});
}
