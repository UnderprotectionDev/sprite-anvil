import {
	type OfflineConflictContent,
	type OfflineConflictList,
	type OfflineConflictView,
	offlineConflictListSchema,
	offlineConflictSides,
} from "@sprite-anvil/api/offline-conflict";
import type { PixelOperation } from "@sprite-anvil/api/pixel-editor";
import {
	appliedOperations,
	buildView,
	type ReadableEntry,
	readEntry,
} from "./offline-conflict-content";
import { renderVersion } from "./offline-conflict-render";
import {
	draftIdSchema,
	failure,
	type Outcome,
	type Scope,
	success,
} from "./pixel-editor-context";

/** Read side of Offline Conflict Records: one record, the list and the version previews. */

export async function loadEntry(
	scope: Scope,
	conflictId: string
): Promise<Outcome<ReadableEntry>> {
	const { access, dependencies } = scope;
	const id = draftIdSchema.safeParse(conflictId);
	if (!id.success) {
		return failure("Not found", 404);
	}
	const entry = await dependencies.offlineConflictStore.getEntry(
		access.userId,
		access.projectId,
		id.data
	);
	return entry ? readEntry(entry) : failure("Not found", 404);
}

export async function readOfflineConflict(
	scope: Scope,
	conflictId: string
): Promise<Outcome<OfflineConflictView>> {
	const loaded = await loadEntry(scope, conflictId);
	return loaded.ok ? success(buildView(loaded.value)) : loaded;
}

export async function listOfflineConflicts(
	scope: Scope
): Promise<Outcome<OfflineConflictList>> {
	const { access, dependencies } = scope;
	const entries = await dependencies.offlineConflictStore.listEntries(
		access.userId,
		access.projectId
	);
	const conflicts: OfflineConflictView[] = [];
	const unreadable: OfflineConflictList["unreadable"] = [];
	for (const entry of entries) {
		const readable = readEntry(entry);
		if (readable.ok) {
			conflicts.push(buildView(readable.value));
		} else {
			unreadable.push({
				id: entry.record.id,
				contractVersion: entry.record.contractVersion,
				message: readable.detail ?? readable.error,
			});
		}
	}
	return success(offlineConflictListSchema.parse({ conflicts, unreadable }));
}

function previewTarget(
	content: OfflineConflictContent,
	side: string
): { operations: PixelOperation[]; sourceId: string } {
	if (side === "cloud") {
		return {
			sourceId: content.cloud.sourceAssetVersionId,
			operations: appliedOperations(content.cloud),
		};
	}
	return {
		sourceId: content.base.sourceAssetVersionId,
		operations: side === "base" ? [] : appliedOperations(content.local),
	};
}

/** PNG of one of the three versions: base, cloud as recorded, or the local draft. */
export async function readOfflineConflictPreview(
	scope: Scope,
	conflictId: string,
	side: string
): Promise<Outcome<Uint8Array<ArrayBuffer>>> {
	if (!(offlineConflictSides as readonly string[]).includes(side)) {
		return failure("Not found", 404);
	}
	const loaded = await loadEntry(scope, conflictId);
	if (!loaded.ok) {
		return loaded;
	}
	const target = previewTarget(loaded.value.content, side);
	const rendered = await renderVersion(
		scope,
		target.sourceId,
		target.operations
	);
	return rendered.ok ? success(rendered.value.png) : rendered;
}
