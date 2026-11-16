import type { FoundationRecords } from "@sprite-anvil/api/project-archives";
import type { Database } from "@sprite-anvil/db";
import { managedSnapshots } from "@sprite-anvil/db/schema/asset-production-history";
import { importInboxEntries } from "@sprite-anvil/db/schema/import-inbox";
import {
	referenceBoardImageHistory,
	referenceBoardImages,
} from "@sprite-anvil/db/schema/reference-production";
import type { StoredProjectArchiveRestoreRecord } from "./project-archive-restore-storage";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
function chunks<T>(records: T[]) {
	const result: T[][] = [];
	for (let index = 0; index < records.length; index += 500) {
		result.push(records.slice(index, index + 500));
	}
	return result;
}
export async function insertManagedFoundation(
	tx: Tx,
	record: StoredProjectArchiveRestoreRecord
) {
	const get = <K extends keyof FoundationRecords>(name: K) =>
		(record.sections.find(
			(section) => section.group === "foundation" && section.name === name
		)?.records ?? []) as FoundationRecords[K];
	const fileKey = (kind: string, id: string) => {
		const file = record.files.find(
			(entry) =>
				entry.kind === kind &&
				entry.restoredId === id &&
				entry.presence === "included"
		);
		if (!file?.objectKey) {
			throw new Error("Restored managed file is missing.");
		}
		return file.objectKey;
	};
	const identity = {
		projectId: record.restore.restoredProjectId,
		createdByUserId: record.restore.createdByUserId,
	};
	const snapshots = get("managedSnapshots").filter((snapshot) =>
		record.files.some(
			(file) =>
				file.kind === "working_file" &&
				file.restoredId === snapshot.id &&
				file.presence === "included"
		)
	);
	for (const rows of chunks(snapshots)) {
		// biome-ignore lint/performance/noAwaitInLoops: Batched transaction preserves FK order.
		await tx.insert(managedSnapshots).values(
			rows.map((row) => ({
				...row,
				...identity,
				idempotencyKey: `restore:${row.id}`,
				objectKey: fileKey("working_file", row.id),
				createdAt: new Date(row.createdAt),
			}))
		);
	}
	for (const rows of chunks(get("importInboxEntries"))) {
		// biome-ignore lint/performance/noAwaitInLoops: Batched transaction preserves FK order.
		await tx.insert(importInboxEntries).values(
			rows.map((row) => ({
				...row,
				...identity,
				objectKey: fileKey("import_inbox_file", row.id),
				createdAt: new Date(row.createdAt),
			}))
		);
	}
	for (const rows of chunks(get("referenceBoardImages"))) {
		// biome-ignore lint/performance/noAwaitInLoops: Batched transaction preserves FK order.
		await tx.insert(referenceBoardImages).values(
			rows.map((row) => ({
				...row,
				...identity,
				objectKey: fileKey("reference_board_file", row.id),
				createdAt: new Date(row.createdAt),
				updatedAt: new Date(row.updatedAt),
			}))
		);
	}
	for (const rows of chunks(get("referenceBoardImageHistory"))) {
		// biome-ignore lint/performance/noAwaitInLoops: History references its image rows.
		await tx.insert(referenceBoardImageHistory).values(
			rows.map((row) => ({
				...row,
				projectId: identity.projectId,
				recordedByUserId: identity.createdByUserId,
				recordedAt: new Date(row.recordedAt),
			}))
		);
	}
}
