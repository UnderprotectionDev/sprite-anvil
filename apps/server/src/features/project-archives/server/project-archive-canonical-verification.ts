import { deliverySectionSchemas } from "@sprite-anvil/api/project-archive-delivery";
import type { ProjectArchiveSourceReader } from "@sprite-anvil/api/project-archive-store";
import type { ProjectArchiveSource } from "@sprite-anvil/api/project-archives";
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
import type { StoredProjectArchiveRestoreRecord } from "./project-archive-restore-storage";

function comparableRecord(group: string, name: string, value: unknown) {
	if (group !== "delivery" || name !== "exportBundles") {
		return value;
	}
	const bundle = deliverySectionSchemas.exportBundles.parse(value);
	return {
		...bundle,
		files: [...bundle.files].sort((left, right) => {
			if (left.path < right.path) {
				return -1;
			}
			if (left.path > right.path) {
				return 1;
			}
			return 0;
		}),
	};
}

async function sectionFailures(
	record: StoredProjectArchiveRestoreRecord,
	source: ProjectArchiveSource
) {
	const groups: Record<string, Record<string, unknown[]>> = {
		foundation: source.records,
		history: source.history,
		delivery: source.delivery,
	};
	const included = new Set(
		record.files
			.filter(
				(file) => file.kind === "working_file" && file.presence === "included"
			)
			.map((file) => file.restoredId)
	);
	const failures: string[] = [];
	for (const section of record.sections) {
		const actual = groups[section.group]?.[section.name];
		if (!actual) {
			failures.push(
				`${section.group}/${section.name}: canonical section unavailable`
			);
			continue;
		}
		const byId = new Map(
			actual.map((item) => [(item as { id: string }).id, item])
		);
		for (const value of section.records) {
			const row = value as { id: string };
			if (
				section.group === "foundation" &&
				section.name === "managedSnapshots" &&
				!included.has(row.id)
			) {
				continue;
			}
			const found = byId.get(row.id);
			if (!found) {
				failures.push(
					`${section.group}/${section.name}: missing or changed record`
				);
				break;
			}
			// biome-ignore lint/performance/noAwaitInLoops: Hash records one at a time to bound work.
			const foundDigest = await recordContentDigest(
				comparableRecord(section.group, section.name, found)
			);
			const expectedDigest = await recordContentDigest(
				comparableRecord(section.group, section.name, row)
			);
			if (foundDigest !== expectedDigest) {
				failures.push(
					`${section.group}/${section.name}: missing or changed record`
				);
				break;
			}
		}
	}
	return failures;
}

function fileFailures(
	record: StoredProjectArchiveRestoreRecord,
	source: ProjectArchiveSource
) {
	const byKindAndId = new Map(
		source.files.map((file) => [`${file.kind}\0${file.sourceId}`, file])
	);
	return record.files.flatMap((file) => {
		if (file.kind === "working_file" && file.presence === "excluded") {
			return [];
		}
		const found = byKindAndId.get(`${file.kind}\0${file.restoredId}`);
		if (
			!found ||
			found.sha256 !== file.sha256 ||
			found.byteSize !== file.byteSize ||
			found.assetRecordId !== file.assetRecordId ||
			found.assetVersionId !== file.assetVersionId ||
			found.fileName !== file.fileName ||
			found.contentType !== file.contentType ||
			(file.presence === "included" && found.objectKey !== file.objectKey)
		) {
			return [`${file.kind}: missing or changed file metadata`];
		}
		return [];
	});
}

/** Re-read canonical owning stores and compare restored records and file metadata with the verified restore inventory. */
export function createProjectArchiveCanonicalVerifier(
	sourceReader: Pick<ProjectArchiveSourceReader, "read">
) {
	return async (
		record: StoredProjectArchiveRestoreRecord
	): Promise<string[]> => {
		const source = await sourceReader.read(
			record.restore.createdByUserId,
			record.restore.restoredProjectId
		);
		if (!source) {
			return ["Restored project could not be read."];
		}
		return [
			...(await sectionFailures(record, source)),
			...fileFailures(record, source),
		];
	};
}
