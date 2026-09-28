import type {
	ManagedSnapshot,
	ManagedSnapshotCreateInput,
	ManagedSnapshotCreateResult,
	ManagedSnapshotFileRecord,
	ManagedSnapshotStore,
} from "@sprite-anvil/api/production-provenance";
import { managedSnapshotSummarySchema } from "@sprite-anvil/api/production-provenance";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { managedSnapshots } from "@sprite-anvil/db/schema/asset-production-history";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { and, asc, eq } from "drizzle-orm";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function toManagedSnapshot(
	record: typeof managedSnapshots.$inferSelect
): ManagedSnapshot {
	return managedSnapshotSummarySchema.parse({
		assetVersionId: record.assetVersionId,
		byteSize: record.byteSize,
		createdAt: toISOString(record.createdAt),
		downloadUrl: `/api/projects/${encodeURIComponent(record.projectId)}/managed-snapshots/${record.id}/content`,
		fileName: record.fileName,
		id: record.id,
		sha256: record.sha256,
	});
}

function toFileRecord(
	record: typeof managedSnapshots.$inferSelect
): ManagedSnapshotFileRecord {
	return {
		...toManagedSnapshot(record),
		assetRecordId: record.assetRecordId,
		objectKey: record.objectKey,
		projectId: record.projectId,
	};
}

function hasDatabaseErrorCode(error: unknown, code: string) {
	if (!error || typeof error !== "object") {
		return false;
	}
	const candidate = error as { code?: unknown; cause?: { code?: unknown } };
	return String(candidate.code ?? candidate.cause?.code ?? "") === code;
}

async function readIdempotentSnapshot(
	db: Database,
	userId: string,
	input: ManagedSnapshotCreateInput
): Promise<ManagedSnapshotCreateResult | null> {
	const [existing] = await db
		.select()
		.from(managedSnapshots)
		.where(
			and(
				eq(managedSnapshots.projectId, input.projectId),
				eq(managedSnapshots.assetVersionId, input.assetVersionId),
				eq(managedSnapshots.idempotencyKey, input.idempotencyKey)
			)
		)
		.limit(1);
	if (!existing) {
		return null;
	}
	if (
		existing.fileName !== input.fileName ||
		existing.byteSize !== input.byteSize ||
		existing.sha256 !== input.sha256 ||
		existing.createdByUserId !== userId
	) {
		return { kind: "idempotency-conflict" };
	}
	return { kind: "existing", snapshot: toManagedSnapshot(existing) };
}

export function createManagedSnapshotStore(db: Database): ManagedSnapshotStore {
	return {
		async getAssetVersionForUser(userId, projectId, assetVersionId) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}
			const [version] = await db
				.select({ assetRecordId: assetVersions.assetRecordId })
				.from(assetVersions)
				.where(
					and(
						eq(assetVersions.projectId, projectId),
						eq(assetVersions.id, assetVersionId)
					)
				)
				.limit(1);
			return version ?? null;
		},
		async create(userId, input) {
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return null;
			}
			const [version] = await db
				.select({ id: assetVersions.id })
				.from(assetVersions)
				.where(
					and(
						eq(assetVersions.projectId, input.projectId),
						eq(assetVersions.assetRecordId, input.assetRecordId),
						eq(assetVersions.id, input.assetVersionId)
					)
				)
				.limit(1);
			if (!version) {
				return null;
			}

			const existing = await readIdempotentSnapshot(db, userId, input);
			if (existing) {
				return existing;
			}

			try {
				const [snapshot] = await db
					.insert(managedSnapshots)
					.values({
						id: input.id,
						projectId: input.projectId,
						assetRecordId: input.assetRecordId,
						assetVersionId: input.assetVersionId,
						fileName: input.fileName,
						byteSize: input.byteSize,
						sha256: input.sha256,
						objectKey: input.objectKey,
						idempotencyKey: input.idempotencyKey,
						createdByUserId: userId,
					})
					.returning();
				return snapshot
					? { kind: "created", snapshot: toManagedSnapshot(snapshot) }
					: null;
			} catch (error) {
				if (!hasDatabaseErrorCode(error, "23505")) {
					throw error;
				}
				return readIdempotentSnapshot(db, userId, input);
			}
		},
		async list(userId, projectId, assetVersionId) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}
			const [version] = await db
				.select({ id: assetVersions.id })
				.from(assetVersions)
				.where(
					and(
						eq(assetVersions.projectId, projectId),
						eq(assetVersions.id, assetVersionId)
					)
				)
				.limit(1);
			if (!version) {
				return null;
			}
			const rows = await db
				.select()
				.from(managedSnapshots)
				.where(
					and(
						eq(managedSnapshots.projectId, projectId),
						eq(managedSnapshots.assetVersionId, assetVersionId)
					)
				)
				.orderBy(asc(managedSnapshots.createdAt), asc(managedSnapshots.id));
			return rows.map(toManagedSnapshot);
		},
		async getFileRecord(userId, projectId, snapshotId) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}
			const [snapshot] = await db
				.select()
				.from(managedSnapshots)
				.where(
					and(
						eq(managedSnapshots.projectId, projectId),
						eq(managedSnapshots.id, snapshotId)
					)
				)
				.limit(1);
			return snapshot ? toFileRecord(snapshot) : null;
		},
	};
}
