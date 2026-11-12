import { z } from "zod";
import {
	type DeliveryRecords,
	deliveryGroup,
	deliveryRelationFailures,
	deliverySectionSchemas,
	deriveDeliveryDiffs,
} from "./project-archive-delivery";
import {
	type HistoryRecords,
	historyGroup,
	historyRelationFailures,
} from "./project-archive-history";
import {
	archiveSha256Schema,
	type FoundationRecords,
	findSecretKeyPaths,
	foundationGroup,
	foundationRelationFailures,
	type ProjectArchive,
	type ProjectArchiveFileEntry,
	projectArchiveSectionRegistry,
	sectionDigest,
	verifyProjectArchive,
} from "./project-archives";
import { recordContentDigest } from "./record-content-digest";
import { idempotencyKeySchema, idempotentRecordId } from "./record-publication";

const idSchema = z.string().trim().min(1).max(128);
const uuidSchema = z.uuid();
const timestampSchema = z.iso.datetime();

// ---------------------------------------------------------------------------
// Request and result shapes
// ---------------------------------------------------------------------------

/**
 * Restores one archive into a new, independent project. The same
 * `idempotencyKey` replays the first restore and never makes a second
 * project. Restore has no target project: an existing project is never
 * overwritten or merged into.
 */
export const projectArchiveRestoreInputSchema = z
	.object({
		/** The archive to restore; it is only read. */
		archiveId: uuidSchema,
		idempotencyKey: idempotencyKeySchema,
		/** Name of the new project. */
		name: z.string().trim().min(1).max(120),
		/** The project the archive belongs to. */
		projectId: uuidSchema,
	})
	.strict();
export type ProjectArchiveRestoreInput = z.infer<
	typeof projectArchiveRestoreInputSchema
>;

export const projectArchiveRestoreGetInputSchema = z
	.object({ projectId: uuidSchema, restoreId: uuidSchema })
	.strict();

export const projectArchiveRestoreListInputSchema = z
	.object({ projectId: uuidSchema })
	.strict();

export const projectArchiveRestoreSummarySchema = z
	.object({
		archiveId: uuidSchema,
		createdAt: timestampSchema,
		id: uuidSchema,
		manifestDigest: archiveSha256Schema,
		restoredProjectId: uuidSchema,
		sourceProjectId: idSchema,
	})
	.strict();
export type ProjectArchiveRestoreSummary = z.infer<
	typeof projectArchiveRestoreSummarySchema
>;

const restoreIdEntrySchema = z
	.object({
		group: z.string(),
		name: z.string(),
		restoredId: idSchema,
		sourceId: idSchema,
	})
	.strict();

const restoreSectionSchema = z
	.object({
		digest: archiveSha256Schema,
		group: z.string(),
		name: z.string(),
		recordCount: z.number().int().nonnegative(),
		sourceDigest: archiveSha256Schema,
	})
	.strict();

const restoreFileSchema = z
	.object({
		byteSize: z.number().int().positive(),
		exclusionReason: z.string().nullable(),
		kind: z.string(),
		presence: z.enum(["included", "excluded"]),
		restoredId: idSchema,
		sha256: archiveSha256Schema,
		sourceId: idSchema,
	})
	.strict();

/** A restore as a reader sees it: the new project and the separate mapping of archived ids to new cloud ids. */
export const projectArchiveRestoreSchema = projectArchiveRestoreSummarySchema
	.extend({
		files: z.array(restoreFileSchema),
		ids: z.array(restoreIdEntrySchema),
		sections: z.array(restoreSectionSchema),
	})
	.strict();
export type ProjectArchiveRestore = z.infer<typeof projectArchiveRestoreSchema>;

export const projectArchiveRestoreCatalogSchema = z
	.object({ restores: z.array(projectArchiveRestoreSummarySchema) })
	.strict();
export type ProjectArchiveRestoreCatalog = z.infer<
	typeof projectArchiveRestoreCatalogSchema
>;

export type ProjectArchiveRestoreRejection =
	| { failures: string[]; reason: "archive_invalid" }
	| { failures: string[]; reason: "restore_inconsistent" }
	| { keys: string[]; reason: "duplicate_key" }
	| { paths: string[]; reason: "secret_detected" }
	| { reason: "file_unverifiable"; sourceIds: string[] };

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export interface RestoredSection {
	digest: string;
	group: string;
	name: string;
	recordCount: number;
	records: unknown[];
	sourceDigest: string;
}

export interface RestoredFile extends ProjectArchiveFileEntry {
	/** The new cloud id of the file's record; `sourceId` keeps the archived id. */
	restoredId: string;
}

export interface RestoreIdEntry {
	group: string;
	name: string;
	restoredId: string;
	sourceId: string;
}

export interface ProjectArchiveRestorePlan {
	files: RestoredFile[];
	ids: RestoreIdEntry[];
	sections: RestoredSection[];
	sourceManifestDigest: string;
}

/** Group name under which working-file ids, which no section holds, are mapped. */
export const restoredFilesGroup = "files";

/**
 * Fields that point at a record the archive does not carry (the visual world
 * a family belongs to, the proposal a revision came from, the mapping draft a
 * Fulfilment was finalized from). Their ids are still re-issued, so a restored
 * record never points at an id of the source project.
 */
function foreignIds(
	group: string,
	name: string,
	record: Record<string, unknown>
): string[] {
	const text = (value: unknown) => (typeof value === "string" ? [value] : []);
	const listed = (value: unknown, field: string) =>
		((value as Record<string, unknown>[] | undefined) ?? []).flatMap((entry) =>
			text(entry[field])
		);
	switch (`${group}/${name}`) {
		case "foundation/contextRevisions":
			return text(record.sourceProposalId);
		case "foundation/assetFamilies":
			return text(record.visualWorldId);
		case "foundation/assetRecords":
			return [...text(record.visualWorldId), ...text(record.themeId)];
		case "history/metadataProposals":
			return text(record.sourceEntryId);
		case "delivery/deliveryFulfilments":
			return [
				...text(record.draftId),
				...listed(record.requirements, "requiredSetRevisionId"),
			];
		case "delivery/deliveryTargetDrafts":
			return listed(record.families, "requiredSetRevisionId");
		default:
			return [];
	}
}

const diffsSection = { group: deliveryGroup, name: "deliveryDiffs" };

/** The new cloud id of an archived id within one restore; the same restore always yields the same id. */
export function restoredRecordId(restoreId: string, sourceId: string) {
	return idempotentRecordId(
		{
			kind: "project-archive-restored-record",
			projectId: restoreId,
			userId: "restore",
		},
		sourceId
	);
}

function rewrite(value: unknown, map: ReadonlyMap<string, string>): unknown {
	if (typeof value === "string") {
		return map.get(value) ?? value;
	}
	if (Array.isArray(value)) {
		return value.map((member) => rewrite(member, map));
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([key, member]) => [
				map.get(key) ?? key,
				rewrite(member, map),
			])
		);
	}
	return value;
}

const byKind = (left: { kind: string }, right: { kind: string }) =>
	Number(left.kind > right.kind) - Number(left.kind < right.kind);

const fileKey = (file: { kind: string; sourceId: string }) =>
	`${file.kind}:${file.sourceId}`;

function sectionRecords(archive: Pick<ProjectArchive, "sections">) {
	return archive.sections.map((section) => ({
		group: section.group,
		name: section.name,
		records: section.records as Record<string, unknown>[],
	}));
}

/** Nested records of a section that carry their own id and are referenced from elsewhere. */
function nestedIds(
	group: string,
	name: string,
	record: Record<string, unknown>
) {
	if (group === deliveryGroup && name === "runtimeValidations") {
		return [
			...((record.evidence as { id: string }[] | undefined) ?? []),
			...((record.decisions as { id: string }[] | undefined) ?? []),
		].map((entry) => entry.id);
	}
	return [];
}

function recordsOfGroup(
	sections: { group: string; name: string; records: unknown[] }[],
	group: string
) {
	return Object.fromEntries(
		sections
			.filter((section) => section.group === group)
			.map((section) => [section.name, section.records])
	);
}

/**
 * Relation failures of restored sections and files: every link of the
 * foundation, history and delivery groups points at a restored record, and the
 * digests copied between records still agree. `files` carry the restored ids.
 */
export async function restoredRelationFailures(
	sections: { group: string; name: string; records: unknown[] }[],
	files: Pick<
		RestoredFile,
		| "assetRecordId"
		| "assetVersionId"
		| "byteSize"
		| "kind"
		| "restoredId"
		| "sha256"
	>[]
): Promise<string[]> {
	const asEntries = files.map((file) => ({
		...file,
		sourceId: file.restoredId,
	}));
	const foundation = recordsOfGroup(
		sections,
		foundationGroup
	) as unknown as FoundationRecords;
	const history = recordsOfGroup(
		sections,
		historyGroup
	) as unknown as HistoryRecords;
	const delivery = recordsOfGroup(
		sections,
		deliveryGroup
	) as unknown as DeliveryRecords;
	return [
		...foundationRelationFailures(foundation, asEntries),
		...historyRelationFailures(history, foundation, asEntries),
		...(await deliveryRelationFailures(
			delivery,
			foundation,
			history,
			asEntries
		)),
	];
}

function completenessFailures(archive: Pick<ProjectArchive, "sections">) {
	const present = new Set(
		archive.sections.map((section) => `${section.group}/${section.name}`)
	);
	return Object.entries(projectArchiveSectionRegistry).flatMap(
		([group, schemas]) =>
			Object.keys(schemas)
				.filter((name) => !present.has(`${group}/${name}`))
				.map(
					(name) =>
						`Section ${group}/${name} is missing, so the archive cannot be restored whole.`
				)
	);
}

type Sections = ReturnType<typeof sectionRecords>;

function isDiffs(section: { group: string; name: string }) {
	return (
		section.group === diffsSection.group && section.name === diffsSection.name
	);
}

/** Keys that repeat inside one section or one file kind; an archive with one is not a faithful copy. */
function repeatedKeys(
	sections: Sections,
	files: Pick<ProjectArchiveFileEntry, "kind" | "sourceId">[]
) {
	const repeated = new Set<string>();
	const note = (scope: string, keys: string[]) => {
		const seen = new Set<string>();
		for (const key of keys) {
			if (seen.has(key)) {
				repeated.add(`${scope}:${key}`);
			}
			seen.add(key);
		}
	};
	for (const { group, name, records } of sections) {
		note(
			`${group}/${name}`,
			records.map((record) => String(record.id))
		);
	}
	note("file", files.map(fileKey));
	return [...repeated].sort();
}

/** Every archived id a restore re-issues, in a fixed order, with the section it was found in. */
function sourceIdsOf(
	sections: Sections,
	files: Pick<ProjectArchiveFileEntry, "kind" | "sourceId">[]
) {
	const found: { group: string; name: string; sourceId: string }[] = [];
	for (const { group, name, records } of sections) {
		// Delivery Diffs are derived and carry composite ids, so they are re-derived instead of mapped.
		if (group === diffsSection.group && name === diffsSection.name) {
			continue;
		}
		for (const record of records) {
			const own = [
				String(record.id),
				...nestedIds(group, name, record),
				...foreignIds(group, name, record),
			];
			for (const sourceId of own) {
				found.push({ group, name, sourceId });
			}
		}
	}
	const known = new Set(found.map((entry) => entry.sourceId));
	for (const file of files) {
		if (!known.has(file.sourceId)) {
			found.push({
				group: restoredFilesGroup,
				name: file.kind,
				sourceId: file.sourceId,
			});
		}
	}
	return found;
}

async function issueIds(
	restoreId: string,
	sections: Sections,
	files: ProjectArchiveFileEntry[]
) {
	const found = sourceIdsOf(sections, files);
	const distinct = [...new Set(found.map((entry) => entry.sourceId))];
	const issued = await Promise.all(
		distinct.map((sourceId) => restoredRecordId(restoreId, sourceId))
	);
	const idMap = new Map(
		distinct.map((sourceId, index) => [sourceId, issued[index] as string])
	);
	const ids: RestoreIdEntry[] = found.map(({ group, name, sourceId }) => ({
		group,
		name,
		restoredId: idMap.get(sourceId) as string,
		sourceId,
	}));
	return { idMap, ids };
}

/** The sections with every id rewritten; Delivery Diffs are re-derived from the restored Fulfilments. */
async function restoreSections(
	archive: Pick<ProjectArchive, "manifest">,
	sections: Sections,
	idMap: ReadonlyMap<string, string>
): Promise<RestoredSection[] | { failures: string[] }> {
	const restored: RestoredSection[] = [];
	for (const entry of archive.manifest.contents) {
		const section = sections.find(
			(candidate) =>
				candidate.group === entry.group && candidate.name === entry.name
		);
		const schema = projectArchiveSectionRegistry[entry.group]?.[entry.name];
		if (!(section && schema)) {
			return {
				failures: [`Section ${entry.group}/${entry.name} cannot be restored.`],
			};
		}
		const records = isDiffs(entry)
			? []
			: (z.array(schema).parse(rewrite(section.records, idMap)) as unknown[]);
		restored.push({
			digest: "",
			group: entry.group,
			name: entry.name,
			recordCount: records.length,
			records,
			sourceDigest: entry.digest,
		});
	}
	const diffs = restored.find(isDiffs);
	if (diffs) {
		diffs.records = z
			.array(deliverySectionSchemas.deliveryDiffs)
			.parse(
				deriveDeliveryDiffs(
					recordsOfGroup(restored, deliveryGroup) as unknown as DeliveryRecords
				)
			);
		diffs.recordCount = diffs.records.length;
	}
	await Promise.all(
		restored.map(async (section) => {
			section.digest = await sectionDigest(section.records as { id: string }[]);
		})
	);
	return restored;
}

function restoredFiles(
	files: ProjectArchiveFileEntry[],
	idMap: ReadonlyMap<string, string>
): RestoredFile[] {
	const mapped = (id: string | null) => (id ? (idMap.get(id) ?? id) : null);
	return files
		.map((file) => ({
			...file,
			assetRecordId: mapped(file.assetRecordId),
			assetVersionId: mapped(file.assetVersionId),
			restoredId: idMap.get(file.sourceId) ?? file.sourceId,
		}))
		.sort(
			(left, right) =>
				byKind(left, right) ||
				Number(left.sourceId > right.sourceId) -
					Number(left.sourceId < right.sourceId)
		);
}

/**
 * Plans the restore of a verified archive: checks digests and internal
 * relations first, maps every archived record to a new cloud id, rewrites
 * every relation to those ids and proves the rewritten records still hold
 * together. Pure: it writes nothing, and the archive is never changed.
 */
export async function planProjectArchiveRestore(
	archive: Pick<ProjectArchive, "manifest" | "manifestDigest" | "sections">,
	options: { restoreId: string }
): Promise<
	| { ok: true; plan: ProjectArchiveRestorePlan }
	| ({ ok: false } & ProjectArchiveRestoreRejection)
> {
	const verification = [
		...(await verifyProjectArchive(archive)),
		...completenessFailures(archive),
	];
	if (verification.length > 0) {
		return { failures: verification, ok: false, reason: "archive_invalid" };
	}
	const sections = sectionRecords(archive);
	const keys = repeatedKeys(sections, archive.manifest.files);
	if (keys.length > 0) {
		return { keys, ok: false, reason: "duplicate_key" };
	}
	// An archive altered after it was made must not smuggle a secret into a new project.
	const secretPaths = findSecretKeyPaths(
		Object.fromEntries(
			sections.map((section) => [
				`${section.group}.${section.name}`,
				section.records,
			])
		)
	);
	if (secretPaths.length > 0) {
		return { ok: false, paths: secretPaths, reason: "secret_detected" };
	}

	const { idMap, ids } = await issueIds(
		options.restoreId,
		sections,
		archive.manifest.files
	);
	const restored = await restoreSections(archive, sections, idMap);
	if ("failures" in restored) {
		return {
			failures: restored.failures,
			ok: false,
			reason: "archive_invalid",
		};
	}
	const files = restoredFiles(archive.manifest.files, idMap);
	const failures = await restoredRelationFailures(restored, files);
	for (const section of restored) {
		const pinned = archive.manifest.contents.find(
			(entry) => entry.group === section.group && entry.name === section.name
		);
		if (pinned && pinned.recordCount !== section.recordCount) {
			failures.push(
				`Section ${section.group}/${section.name} restored a different record count than the archive pinned.`
			);
		}
	}
	if (failures.length > 0) {
		return { failures, ok: false, reason: "restore_inconsistent" };
	}
	return {
		ok: true,
		plan: {
			files,
			ids,
			sections: restored,
			sourceManifestDigest: archive.manifestDigest,
		},
	};
}

/** Failure texts when stored restored records no longer match their own digests and relations; empty when sound. */
export async function verifyRestoredRecords(restored: {
	files: RestoredFile[];
	sections: RestoredSection[];
}): Promise<string[]> {
	const digests = await Promise.all(
		restored.sections.map((section) =>
			sectionDigest(section.records as { id: string }[])
		)
	);
	const failures = restored.sections.flatMap((section, index) => {
		const key = `${section.group}/${section.name}`;
		if (!projectArchiveSectionRegistry[section.group]?.[section.name]) {
			return [`Restored section ${key} belongs to an unknown record group.`];
		}
		return [
			...(section.recordCount === section.records.length
				? []
				: [`Restored section ${key} holds another record count.`]),
			...(digests[index] === section.digest
				? []
				: [`Restored section ${key} does not match its digest.`]),
		];
	});
	return [
		...failures,
		...(await restoredRelationFailures(restored.sections, restored.files)),
	];
}

/** Digest of the restore request, so a repeated key with other content is a conflict. */
export function projectArchiveRestoreRequestDigest(
	input: Pick<ProjectArchiveRestoreInput, "archiveId" | "name" | "projectId">
) {
	return recordContentDigest({
		archiveId: input.archiveId,
		name: input.name,
		projectId: input.projectId,
	});
}
