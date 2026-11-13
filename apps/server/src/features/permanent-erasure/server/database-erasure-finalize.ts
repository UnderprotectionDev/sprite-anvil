import type { ErasureContainerRef } from "@sprite-anvil/api/permanent-erasure";
import type { Database } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import {
	exportBundleFiles,
	exportBundles,
} from "@sprite-anvil/db/schema/export-bundles";
import {
	deletionReceipts,
	erasureTombstones,
} from "@sprite-anvil/db/schema/permanent-erasure";
import {
	projectArchiveFiles,
	projectArchives,
} from "@sprite-anvil/db/schema/project-archives";
import { and, eq, inArray } from "drizzle-orm";
import {
	ErasureScopeChangedError,
	type FinalizeErasureInput,
} from "./erasure-deletion-storage";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function sameIds(left: readonly string[], right: readonly string[]) {
	return (
		left.length === right.length &&
		[...left].sort().join("\n") === [...right].sort().join("\n")
	);
}

const idsOfKind = (
	containers: readonly ErasureContainerRef[],
	kind: ErasureContainerRef["kind"]
) =>
	containers
		.filter((container) => container.kind === kind)
		.map((container) => container.id);

/** Locks the Asset Record's row, so a second delivery of the same job waits for the first one's write. */
async function lockAssetRecord(tx: Transaction, input: FinalizeErasureInput) {
	const [record] = await tx
		.select({ availability: assetRecords.availability })
		.from(assetRecords)
		.where(
			and(
				eq(assetRecords.projectId, input.projectId),
				eq(assetRecords.id, input.assetRecordId)
			)
		)
		.for("update");
	return record;
}

async function receiptExists(tx: Transaction, input: FinalizeErasureInput) {
	const [found] = await tx
		.select({ id: deletionReceipts.id })
		.from(deletionReceipts)
		.where(
			and(
				eq(deletionReceipts.projectId, input.projectId),
				eq(deletionReceipts.id, input.receipt.id)
			)
		);
	return found !== undefined;
}

/**
 * The proof the removal rests on was made earlier; the live rows are checked
 * against it again inside the write. Throws when the Asset Record is gone or
 * already erased, or its versions or embedding containers are not the ones the
 * proof named.
 */
async function assertScopeStillHolds(
	tx: Transaction,
	input: FinalizeErasureInput,
	record: { availability: string } | undefined
) {
	if (!record || record.availability === "erased") {
		throw new ErasureScopeChangedError(
			"The Asset Record is gone or already erased."
		);
	}
	const versionIds = input.expected.assetVersionIds;
	const liveVersions = await tx
		.select({ id: assetVersions.id })
		.from(assetVersions)
		.where(
			and(
				eq(assetVersions.projectId, input.projectId),
				eq(assetVersions.assetRecordId, input.assetRecordId)
			)
		);
	const liveBundles = await tx
		.selectDistinct({ id: exportBundleFiles.bundleId })
		.from(exportBundleFiles)
		.innerJoin(exportBundles, eq(exportBundles.id, exportBundleFiles.bundleId))
		.where(
			and(
				eq(exportBundles.projectId, input.projectId),
				inArray(exportBundleFiles.assetVersionId, versionIds)
			)
		);
	const liveArchives = await tx
		.selectDistinct({ id: projectArchiveFiles.archiveId })
		.from(projectArchiveFiles)
		.innerJoin(
			projectArchives,
			eq(projectArchives.id, projectArchiveFiles.archiveId)
		)
		.where(
			and(
				eq(projectArchives.projectId, input.projectId),
				inArray(projectArchiveFiles.assetVersionId, versionIds),
				eq(projectArchiveFiles.presence, "included")
			)
		);
	const holds =
		sameIds(
			liveVersions.map((row) => row.id),
			versionIds
		) &&
		sameIds(
			liveBundles.map((row) => row.id),
			idsOfKind(input.expected.containers, "export_bundle")
		) &&
		sameIds(
			liveArchives.map((row) => row.id),
			idsOfKind(input.expected.containers, "project_archive")
		);
	if (!holds) {
		throw new ErasureScopeChangedError(
			"The versions or containers differ from the proven scope."
		);
	}
}

/** Writes the receipt, the tombstones, the erased availability, the redacted names and the container removals. */
async function writeErasure(tx: Transaction, input: FinalizeErasureInput) {
	await tx.insert(deletionReceipts).values({
		backgroundOperationId: input.receipt.receipt.operationId,
		contractVersion: input.receipt.receipt.contractVersion,
		id: input.receipt.id,
		projectId: input.projectId,
		receipt: input.receipt.receipt,
		receiptDigest: input.receipt.receiptDigest,
	});
	if (input.tombstones.length > 0) {
		await tx.insert(erasureTombstones).values(
			input.tombstones.map((row) => ({
				assetRecordId: row.assetRecordId,
				erasedAt: row.erasedAt,
				id: row.assetVersionId,
				projectId: row.projectId,
				receiptId: row.receiptId,
			}))
		);
	}
	const erased = await tx
		.update(assetRecords)
		.set({ availability: "erased" })
		.where(
			and(
				eq(assetRecords.projectId, input.projectId),
				eq(assetRecords.id, input.assetRecordId)
			)
		)
		.returning({ id: assetRecords.id });
	if (erased.length !== 1) {
		throw new ErasureScopeChangedError(
			"The Asset Record could not be marked erased."
		);
	}
	// The version rows stay as Erasure Tombstone anchors; the name of the erased file does not.
	await tx
		.update(assetVersions)
		.set({ fileName: null })
		.where(
			and(
				eq(assetVersions.projectId, input.projectId),
				eq(assetVersions.assetRecordId, input.assetRecordId),
				inArray(assetVersions.id, input.expected.assetVersionIds)
			)
		);
	// Whole containers go with their file rows (cascade); none is rewritten.
	const bundleIds = idsOfKind(input.removeContainers, "export_bundle");
	if (bundleIds.length > 0) {
		await tx
			.delete(exportBundles)
			.where(
				and(
					eq(exportBundles.projectId, input.projectId),
					inArray(exportBundles.id, bundleIds)
				)
			);
	}
	const archiveIds = idsOfKind(input.removeContainers, "project_archive");
	if (archiveIds.length > 0) {
		await tx
			.delete(projectArchives)
			.where(
				and(
					eq(projectArchives.projectId, input.projectId),
					inArray(projectArchives.id, archiveIds)
				)
			);
	}
}

/**
 * The atomic finalize of a Deletion Job. `existing` means the approval's receipt
 * was already there and nothing was written; a scope that no longer matches the
 * proof throws `ErasureScopeChangedError` and nothing was written either.
 */
export async function finalizeErasure(
	db: Database,
	input: FinalizeErasureInput
): Promise<{ status: "existing" } | { status: "finalized" }> {
	let alreadyFinalized = false;
	await db.transaction(async (tx) => {
		const record = await lockAssetRecord(tx, input);
		// A delivery that waited for the lock finds the first one's receipt: nothing more to write.
		if (await receiptExists(tx, input)) {
			alreadyFinalized = true;
			return;
		}
		await assertScopeStillHolds(tx, input, record);
		await writeErasure(tx, input);
	});
	return { status: alreadyFinalized ? "existing" : "finalized" };
}
