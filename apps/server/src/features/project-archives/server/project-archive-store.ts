import type {
	ProjectArchiveCreateResult,
	ProjectArchiveSourceReader,
	ProjectArchiveStore,
} from "@sprite-anvil/api/project-archive-store";
import {
	type BuiltProjectArchive,
	buildProjectArchive,
	type ProjectArchive,
	projectArchiveCatalogSchema,
	projectArchiveRequestDigest,
	projectArchiveSchema,
	projectArchiveSchemaVersion,
	projectArchiveSummarySchema,
	verifyProjectArchive,
} from "@sprite-anvil/api/project-archives";
import {
	idempotentRecordId,
	RecordIntegrityError,
	RetryablePublicationError,
	replayPublishedRecord,
	verifyPublishedRecord,
} from "@sprite-anvil/api/record-publication";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import type {
	ProjectArchiveStorage,
	StoredProjectArchive,
	StoredProjectArchiveRecord,
} from "./project-archive-storage";

export interface ProjectArchiveStoreOptions {
	/** Resolves a project the user owns; defaults to the shared project access lookup. */
	getProjectForUser?: (userId: string, projectId: string) => Promise<unknown>;
	now?: () => Date;
	/** Exact secret values (keys, tokens) that must never appear in an archive. */
	secretValues?: () => readonly string[];
	sourceReader: ProjectArchiveSourceReader;
	storage: ProjectArchiveStorage;
	/**
	 * Confirms an included file still exists in storage under its recorded
	 * digest and size. Without it the recorded digests are trusted.
	 */
	verifyFile?: (file: {
		byteSize: number;
		objectKey: string;
		sha256: string;
	}) => Promise<boolean>;
}

function toSummary(archive: StoredProjectArchive) {
	return projectArchiveSummarySchema.parse({
		createdAt: archive.createdAt.toISOString(),
		id: archive.id,
		manifestDigest: archive.manifestDigest,
		projectId: archive.projectId,
		schemaVersion: archive.schemaVersion,
	});
}

/** The archive as a reader sees it: the manifest is rebuilt from the stored section and file rows. */
function toArchive(stored: StoredProjectArchiveRecord): ProjectArchive {
	const sections = [...stored.sections].sort(
		(left, right) =>
			Number(left.group > right.group) - Number(left.group < right.group) ||
			Number(left.name > right.name) - Number(left.name < right.name)
	);
	return projectArchiveSchema.parse({
		...toSummary(stored.archive),
		manifest: {
			contents: sections.map((section) => ({
				digest: section.digest,
				group: section.group,
				name: section.name,
				recordCount: section.recordCount,
			})),
			files: [...stored.files]
				.map(({ sourceObjectKey: _location, ...entry }) => entry)
				.sort(
					(left, right) =>
						Number(left.kind > right.kind) - Number(left.kind < right.kind) ||
						Number(left.sourceId > right.sourceId) -
							Number(left.sourceId < right.sourceId)
				),
			schemaVersion: stored.archive.schemaVersion,
			source: { projectId: stored.archive.projectId },
		},
		sections: sections.map(({ group, name, records }) => ({
			group,
			name,
			records,
		})),
	});
}

/** Failure text when the stored archive no longer matches its own manifest, else null. */
async function integrityFailure(
	stored: StoredProjectArchiveRecord
): Promise<string | null> {
	if (stored.archive.schemaVersion !== projectArchiveSchemaVersion) {
		return "The Project Archive uses a schema version this build does not read.";
	}
	let archive: ProjectArchive;
	try {
		archive = toArchive(stored);
	} catch {
		return "The Project Archive failed verification: a stored row breaks its schema.";
	}
	const failures = await verifyProjectArchive({
		manifest: archive.manifest,
		manifestDigest: stored.archive.manifestDigest,
		sections: archive.sections,
	});
	return failures.length > 0
		? `The Project Archive failed verification: ${failures.join(" ")}`
		: null;
}

/** Source ids of included files that fail the storage check; none when no check is configured. */
async function unverifiableFiles(
	archive: BuiltProjectArchive,
	verifyFile: ProjectArchiveStoreOptions["verifyFile"]
): Promise<string[]> {
	if (!verifyFile) {
		return [];
	}
	const unverifiable: string[] = [];
	for (const location of archive.fileLocations) {
		const entry = archive.manifest.files.find(
			(file) =>
				file.kind === location.kind && file.sourceId === location.sourceId
		);
		const verified =
			entry &&
			// biome-ignore lint/performance/noAwaitInLoops: Files are read one at a time to bound memory.
			(await verifyFile({
				byteSize: entry.byteSize,
				objectKey: location.objectKey,
				sha256: entry.sha256,
			}));
		if (!verified) {
			unverifiable.push(location.sourceId);
		}
	}
	return unverifiable;
}

export function createProjectArchiveStore(
	db: Database,
	options: ProjectArchiveStoreOptions
): ProjectArchiveStore {
	const { sourceReader, storage } = options;
	const lookupProject =
		options.getProjectForUser ??
		((userId: string, projectId: string) =>
			getProjectForUser(db, userId, projectId));
	const now = options.now ?? (() => new Date());

	return {
		async create(userId, input) {
			if ((await lookupProject(userId, input.projectId)) === null) {
				return null;
			}
			const archiveId = await idempotentRecordId(
				{ kind: "project-archive", projectId: input.projectId, userId },
				input.idempotencyKey
			);
			const requestDigest = await projectArchiveRequestDigest(input);
			const replay = () =>
				replayPublishedRecord({
					differs: (row) => row.archive.requestDigest !== requestDigest,
					integrityFailure,
					label: "Project Archive",
					read: () => storage.find(input.projectId, archiveId),
					toResult: (row) => row,
				});
			const replayed = await replay();
			if (replayed) {
				return { archive: toArchive(replayed), status: "replayed" };
			}

			const source = await sourceReader.read(userId, input.projectId);
			if (!source) {
				return null;
			}
			const built = await buildProjectArchive(source, {
				projectId: input.projectId,
				secretValues: options.secretValues?.() ?? [],
				workingFileIds: input.workingFileIds,
			});
			if (!built.ok) {
				const { ok: _ok, ...rejection } = built;
				return {
					...rejection,
					status: "rejected",
				} as ProjectArchiveCreateResult;
			}
			const { archive } = built;

			const unverifiable = await unverifiableFiles(archive, options.verifyFile);
			if (unverifiable.length > 0) {
				return {
					reason: "file_unverifiable",
					sourceIds: unverifiable,
					status: "rejected",
				};
			}

			const locations = new Map(
				archive.fileLocations.map((location) => [
					`${location.kind}:${location.sourceId}`,
					location.objectKey,
				])
			);
			const inserted = await storage.insert({
				archive: {
					createdAt: now(),
					createdByUserId: userId,
					id: archiveId,
					manifestDigest: archive.manifestDigest,
					projectId: input.projectId,
					requestDigest,
					schemaVersion: projectArchiveSchemaVersion,
				},
				files: archive.manifest.files.map((file) => ({
					...file,
					sourceObjectKey:
						locations.get(`${file.kind}:${file.sourceId}`) ?? null,
				})),
				sections: archive.sections.map((section) => {
					const content = archive.manifest.contents.find(
						(entry) =>
							entry.group === section.group && entry.name === section.name
					);
					return {
						digest: content?.digest ?? "",
						group: section.group,
						name: section.name,
						recordCount: section.records.length,
						records: section.records,
					};
				}),
			});
			if (inserted.status === "conflict") {
				// A concurrent request with the same key won; its record is the answer.
				const winner = await replay();
				if (!winner) {
					throw new RetryablePublicationError("Project Archive");
				}
				return { archive: toArchive(winner), status: "replayed" };
			}
			const stored = await verifyPublishedRecord({
				integrityFailure,
				label: "Project Archive",
				read: () => storage.find(input.projectId, archiveId),
				toResult: (row) => row,
			});
			return { archive: toArchive(stored), status: "created" };
		},

		async get(userId, projectId, archiveId) {
			if ((await lookupProject(userId, projectId)) === null) {
				return null;
			}
			const stored = await storage.find(projectId, archiveId);
			if (!stored) {
				return null;
			}
			const failure = await integrityFailure(stored);
			if (failure) {
				throw new RecordIntegrityError(failure);
			}
			return toArchive(stored);
		},

		async list(userId, projectId) {
			if ((await lookupProject(userId, projectId)) === null) {
				return null;
			}
			return projectArchiveCatalogSchema.parse({
				archives: (await storage.list(projectId)).map(toSummary),
			});
		},
	};
}
