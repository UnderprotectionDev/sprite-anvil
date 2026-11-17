import type { FoundationRecords } from "@sprite-anvil/api/project-archives";
import type { Database } from "@sprite-anvil/db";
import {
	assetFamilyCanonicalDesigns,
	assetFamilyRelationships,
} from "@sprite-anvil/db/schema/asset-families";
import {
	assetRecordReferenceHistory,
	assetRecordReferences,
} from "@sprite-anvil/db/schema/asset-record-references";
import {
	compositeVersions,
	compositionMemberships,
	unitVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import type { StoredProjectArchiveRestoreRecord } from "./project-archive-restore-storage";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

function chunks<T>(records: T[]): T[][] {
	const result: T[][] = [];
	for (let index = 0; index < records.length; index += 500) {
		result.push(records.slice(index, index + 500));
	}
	return result;
}

export async function insertFoundationRelations(
	tx: Tx,
	record: StoredProjectArchiveRestoreRecord
) {
	const { restore } = record;
	const get = <K extends keyof FoundationRecords>(name: K) =>
		(record.sections.find(
			(section) => section.group === "foundation" && section.name === name
		)?.records ?? []) as FoundationRecords[K];
	const identity = {
		projectId: restore.restoredProjectId,
		createdByUserId: restore.createdByUserId,
	};
	const designs = get("canonicalDesigns");
	const units = get("unitVersions");
	const composites = get("compositeVersions");
	const members = get("compositionMemberships");
	const references = get("references");
	const history = get("referenceHistory");
	const relationships = get("relationships");
	for (const rows of chunks(designs)) {
		// biome-ignore lint/performance/noAwaitInLoops: Transaction batches preserve FK order.
		await tx.insert(assetFamilyCanonicalDesigns).values(
			rows.map((row) => ({
				...row,
				...identity,
				createdAt: new Date(row.createdAt),
			}))
		);
	}
	for (const rows of chunks(units)) {
		// biome-ignore lint/performance/noAwaitInLoops: Transaction batches preserve FK order.
		await tx.insert(unitVersions).values(
			rows.map((row) => ({
				...row,
				...identity,
				createdAt: new Date(row.createdAt),
			}))
		);
	}
	for (const rows of chunks(composites)) {
		// biome-ignore lint/performance/noAwaitInLoops: Transaction batches preserve FK order.
		await tx.insert(compositeVersions).values(
			rows.map((row) => ({
				...row,
				...identity,
				idempotencyKey: `restore:${row.id}`,
				createdAt: new Date(row.createdAt),
			}))
		);
	}
	for (const rows of chunks(members)) {
		// biome-ignore lint/performance/noAwaitInLoops: Transaction batches preserve FK order.
		await tx.insert(compositionMemberships).values(
			rows.map((row) => ({
				...row,
				projectId: identity.projectId,
				createdAt: new Date(row.createdAt),
			}))
		);
	}
	for (const rows of chunks(references)) {
		// biome-ignore lint/performance/noAwaitInLoops: Transaction batches preserve FK order.
		await tx.insert(assetRecordReferences).values(
			rows.map((row) => ({
				...row,
				...identity,
				createdAt: new Date(row.createdAt),
				updatedAt: new Date(row.updatedAt),
			}))
		);
	}
	for (const rows of chunks(history)) {
		// biome-ignore lint/performance/noAwaitInLoops: Transaction batches preserve FK order.
		await tx.insert(assetRecordReferenceHistory).values(
			rows.map((row) => ({
				...row,
				projectId: identity.projectId,
				recordedByUserId: identity.createdByUserId,
				recordedAt: new Date(row.recordedAt),
			}))
		);
	}
	for (const rows of chunks(relationships)) {
		// biome-ignore lint/performance/noAwaitInLoops: Transaction batches preserve FK order.
		await tx.insert(assetFamilyRelationships).values(
			rows.map((row) => ({
				...row,
				...identity,
				legacyUnversioned:
					row.type === "derivative" && row.sourceAssetVersionId === null,
				createdAt: new Date(row.createdAt),
			}))
		);
	}
}
