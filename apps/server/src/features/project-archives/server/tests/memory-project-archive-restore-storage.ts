import type {
	ProjectArchiveRestoreStorage,
	StoredProjectArchiveRestoreRecord,
} from "../project-archive-restore-storage";

/** An in-memory ProjectArchiveRestoreStorage with the same all-or-nothing insert as the database store. */
export function createMemoryProjectArchiveRestoreStorage() {
	const restores = new Map<string, StoredProjectArchiveRestoreRecord>();
	const projects = new Map<string, { name: string; ownerUserId: string }>();
	const storage: ProjectArchiveRestoreStorage = {
		find: (sourceProjectId, restoreId) => {
			const found = restores.get(restoreId);
			return Promise.resolve(
				found?.restore.sourceProjectId === sourceProjectId
					? structuredClone(found)
					: null
			);
		},
		insert: (record) => {
			if (
				restores.has(record.restore.id) ||
				projects.has(record.restore.restoredProjectId)
			) {
				return Promise.resolve({ status: "conflict" });
			}
			projects.set(record.restore.restoredProjectId, {
				name: record.projectName,
				ownerUserId: record.restore.createdByUserId,
			});
			restores.set(record.restore.id, structuredClone(record));
			return Promise.resolve({ status: "inserted" });
		},
		list: (sourceProjectId) =>
			Promise.resolve(
				[...restores.values()]
					.map((entry) => entry.restore)
					.filter((restore) => restore.sourceProjectId === sourceProjectId)
			),
		withdraw: (restoreId) => {
			const found = restores.get(restoreId);
			if (found) {
				projects.delete(found.restore.restoredProjectId);
				restores.delete(restoreId);
			}
			return Promise.resolve();
		},
	};
	return { projects, restores, storage };
}
