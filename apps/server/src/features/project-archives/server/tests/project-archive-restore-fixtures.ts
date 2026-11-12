import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type { ProjectArchive } from "@sprite-anvil/api/project-archives";
import {
	projectArchiveSchemaVersion,
	sectionDigest,
} from "@sprite-anvil/api/project-archives";
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
import { appRouter } from "@sprite-anvil/api/routers/index";
import type { Database } from "@sprite-anvil/db";
import { createProjectArchiveRestoreStore } from "../project-archive-restore-store";
import type {
	ProjectArchiveStorage,
	StoredProjectArchiveRecord,
} from "../project-archive-storage";
import { createProjectArchiveStore } from "../project-archive-store";
import { createMemoryProjectArchiveRestoreStorage } from "./memory-project-archive-restore-storage";
import { createMemoryProjectArchiveStorage } from "./memory-project-archive-storage";
import { deliverySource } from "./project-archive-delivery-fixtures";
import { otherProjectId, projectId, userId } from "./project-archive-fixtures";

/** Rewrites one stored archive and keeps its section digests, manifest and manifest digest honest, as a clever forger would. */
export async function forge(
	stored: StoredProjectArchiveRecord,
	change: (sections: StoredProjectArchiveRecord["sections"]) => void
): Promise<StoredProjectArchiveRecord> {
	const forged = structuredClone(stored);
	change(forged.sections);
	await Promise.all(
		forged.sections.map(async (section) => {
			section.recordCount = section.records.length;
			section.digest = await sectionDigest(section.records as { id: string }[]);
		})
	);
	const manifest = {
		contents: forged.sections.map((section) => ({
			digest: section.digest,
			group: section.group,
			name: section.name,
			recordCount: section.recordCount,
		})),
		files: forged.files
			.map(({ sourceObjectKey: _key, ...entry }) => entry)
			.sort(
				(left, right) =>
					Number(left.kind > right.kind) - Number(left.kind < right.kind) ||
					Number(left.sourceId > right.sourceId) -
						Number(left.sourceId < right.sourceId)
			),
		schemaVersion: projectArchiveSchemaVersion,
		source: { projectId: forged.archive.projectId },
	};
	forged.archive.manifestDigest = await recordContentDigest(manifest);
	return forged;
}

export function restoreSetup(
	options: {
		copyFile?: (file: { from: string; to: string }) => Promise<void>;
		hasAccess?: boolean;
		removeFile?: (key: string) => Promise<void>;
		verifyFile?: (file: { objectKey: string }) => Promise<boolean>;
		wrapRestoreStorage?: (
			storage: ReturnType<
				typeof createMemoryProjectArchiveRestoreStorage
			>["storage"]
		) => ReturnType<typeof createMemoryProjectArchiveRestoreStorage>["storage"];
	} = {}
) {
	let tick = 0;
	const now = () => {
		tick += 1;
		return new Date(Date.UTC(2026, 10, 10, 10, 0, tick));
	};
	const archives = createMemoryProjectArchiveStorage();
	const forged = new Map<string, StoredProjectArchiveRecord>();
	const archiveStorage: ProjectArchiveStorage = {
		find: async (project, id) =>
			forged.get(id) ?? (await archives.find(project, id)),
		insert: (record) => archives.insert(record),
		list: (project) => archives.list(project),
	};
	const getProjectForUser = (_user: string, requested: string) =>
		Promise.resolve(
			(options.hasAccess ?? true) &&
				[projectId, otherProjectId].includes(requested)
				? { id: requested }
				: null
		);
	const archiveStore = createProjectArchiveStore({} as Database, {
		getProjectForUser,
		now,
		sourceReader: { read: () => Promise.resolve(deliverySource()) },
		storage: archiveStorage,
	});
	const memory = createMemoryProjectArchiveRestoreStorage();
	const copies: { from: string; to: string }[] = [];
	const removed: string[] = [];
	const projectArchiveRestoreStore = createProjectArchiveRestoreStore(
		{} as Database,
		{
			archives: archiveStorage,
			files: {
				copy: async (file) => {
					await options.copyFile?.(file);
					copies.push({ from: file.from, to: file.to });
				},
				remove: async (key) => {
					await options.removeFile?.(key);
					removed.push(key);
				},
				verify: (file) => options.verifyFile?.(file) ?? Promise.resolve(true),
			},
			getProjectForUser,
			now,
			storage: options.wrapRestoreStorage
				? options.wrapRestoreStorage(memory.storage)
				: memory.storage,
		}
	);
	const context = {
		projectArchiveRestoreStore,
		projectArchiveStore: archiveStore,
		session: { user: { id: userId } },
	} as unknown as Context;
	return {
		archiveStore,
		archives,
		copies,
		removed,
		context,
		createArchive: (key = "archive-key") =>
			call(
				appRouter.projectArchives.create,
				{ idempotencyKey: key, projectId, workingFileIds: [] } as never,
				{ context }
			),
		/** Changes a stored archive without keeping its digests honest: a record that rotted after it was made. */
		corruptArchive: async (
			archive: ProjectArchive,
			change: (sections: StoredProjectArchiveRecord["sections"]) => void
		) => {
			const stored = await archiveStorage.find(projectId, archive.id);
			if (!stored) {
				throw new Error("archive missing");
			}
			const corrupted = structuredClone(stored);
			change(corrupted.sections);
			forged.set(archive.id, corrupted);
		},
		forgeArchive: async (
			archive: ProjectArchive,
			change: (sections: StoredProjectArchiveRecord["sections"]) => void
		) => {
			const stored = await archiveStorage.find(projectId, archive.id);
			if (!stored) {
				throw new Error("archive missing");
			}
			forged.set(archive.id, await forge(stored, change));
		},
		memory,
		restore: (input: Record<string, unknown>) =>
			call(appRouter.projectArchives.restore, input as never, { context }),
		getRestore: (restoreId: string) =>
			call(
				appRouter.projectArchives.getRestore,
				{ projectId, restoreId },
				{ context }
			),
		listRestores: () =>
			call(appRouter.projectArchives.listRestores, { projectId }, { context }),
		projectArchiveRestoreStore,
	};
}
