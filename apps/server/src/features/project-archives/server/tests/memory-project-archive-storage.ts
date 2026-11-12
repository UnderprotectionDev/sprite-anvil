import type {
	ProjectArchiveStorage,
	StoredProjectArchiveRecord,
} from "../project-archive-storage";

/** An in-memory ProjectArchiveStorage with the same all-or-nothing insert as the database store. */
export function createMemoryProjectArchiveStorage(): ProjectArchiveStorage {
	const archives = new Map<string, StoredProjectArchiveRecord>();
	return {
		find: (projectId, archiveId) => {
			const found = archives.get(archiveId);
			return Promise.resolve(
				found?.archive.projectId === projectId ? structuredClone(found) : null
			);
		},
		insert: (record) => {
			if (archives.has(record.archive.id)) {
				return Promise.resolve({ status: "conflict" });
			}
			archives.set(record.archive.id, structuredClone(record));
			return Promise.resolve({ status: "inserted" });
		},
		list: (projectId) =>
			Promise.resolve(
				[...archives.values()]
					.map((entry) => entry.archive)
					.filter((archive) => archive.projectId === projectId)
			),
	};
}
