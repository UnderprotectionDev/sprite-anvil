import type {
	GenerationPackage,
	GenerationPackageSnapshot,
	GenerationPackageStore,
} from "@sprite-anvil/api/generation-packages";
import {
	generationPackageSchema,
	generationPackageSnapshotSchema,
} from "@sprite-anvil/api/generation-packages";
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
import {
	RecordIntegrityError,
	RetryablePublicationError,
	replayPublishedRecord,
	resolveRecordId,
	verifyPublishedRecord,
} from "@sprite-anvil/api/record-publication";
import type { Database } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { generationPackages } from "@sprite-anvil/db/schema/generation-packages";
import { project } from "@sprite-anvil/db/schema/project";
import { and, desc, eq } from "drizzle-orm";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function mapGenerationPackage(
	row: typeof generationPackages.$inferSelect
): GenerationPackage {
	return generationPackageSchema.parse({
		...row.snapshot,
		assetRecordId: row.assetRecordId,
		createdAt: toISOString(row.createdAt),
		id: row.id,
		projectId: row.projectId,
	});
}

async function getOwnedAssetRecord(
	db: Database,
	userId: string,
	projectId: string,
	assetRecordId: string
) {
	const [record] = await db
		.select({ availability: assetRecords.availability, id: assetRecords.id })
		.from(assetRecords)
		.innerJoin(project, eq(project.id, assetRecords.projectId))
		.where(
			and(
				eq(assetRecords.projectId, projectId),
				eq(assetRecords.id, assetRecordId),
				eq(project.ownerUserId, userId)
			)
		)
		.limit(1);
	return record ?? null;
}

/**
 * The part of a snapshot the requester supplied. Project context, canonical
 * design and reference roles are read from the project when the package is
 * built, so they may legitimately differ on a repeat and are not compared.
 */
function requestDigest(snapshot: Record<string, unknown>) {
	const {
		assetRecord: _assetRecord,
		canonicalDesign: _canonicalDesign,
		productionContextSnapshot: _context,
		referenceRoles: _roles,
		...requested
	} = snapshot;
	return recordContentDigest(requested);
}

type PackageRow = typeof generationPackages.$inferSelect;

async function readPackage(db: Database, projectId: string, id: string) {
	const [row] = await db
		.select()
		.from(generationPackages)
		.where(
			and(
				eq(generationPackages.projectId, projectId),
				eq(generationPackages.id, id)
			)
		)
		.limit(1);
	return row ?? null;
}

/** What a package is published for: the member, project and Asset Record that own it, and its snapshot. */
interface PackageRequest {
	assetRecordId: string;
	projectId: string;
	snapshot: GenerationPackageSnapshot;
	userId: string;
}

/**
 * The stored row must describe the project and Asset Record it is filed under,
 * and its snapshot must still be a valid Generation Package snapshot of that
 * Asset Record. Server-rebuilt parts (context, canonical design, reference
 * roles) have no stored digest to compare, so they are checked against the
 * snapshot schema and their relations instead.
 */
function integrityFailure(row: PackageRow, request: PackageRequest) {
	const snapshot = generationPackageSnapshotSchema.safeParse(row.snapshot);
	if (
		row.projectId !== request.projectId ||
		row.assetRecordId !== request.assetRecordId ||
		!snapshot.success ||
		snapshot.data.assetRecord.id !== request.assetRecordId ||
		snapshot.data.assetRecord.projectId !== request.projectId ||
		(snapshot.data.canonicalDesign &&
			snapshot.data.canonicalDesign.assetRecordId !== request.assetRecordId)
	) {
		return "Generation Package relation check failed: the persisted record is not a valid snapshot of this project and Asset Record.";
	}
	return null;
}

function withdrawPackage(db: Database, projectId: string, id: string) {
	return db
		.delete(generationPackages)
		.where(
			and(
				eq(generationPackages.projectId, projectId),
				eq(generationPackages.id, id)
			)
		);
}

/**
 * The package an earlier request with this key published, or a conflict when
 * its content differs. The stored record is re-verified, so a package left
 * behind by a failed publication or withdrawal is repaired (withdrawn, then
 * published again) and never replayed as success.
 */
function readReplay(db: Database, request: PackageRequest, id: string) {
	return replayPublishedRecord({
		differs: async (row) =>
			row.createdByUserId !== request.userId ||
			(await requestDigest(request.snapshot)) !==
				(await requestDigest(row.snapshot)),
		integrityFailure: (row) => integrityFailure(row, request),
		label: "Generation Package",
		read: () => readPackage(db, request.projectId, id),
		repair: () => withdrawPackage(db, request.projectId, id),
		toResult: mapGenerationPackage,
	});
}

/**
 * Re-reads the published package and checks its relations and full snapshot
 * digest against what was submitted. A mismatch withdraws the package and
 * fails, so an unexplained difference is never shown as a successful publish.
 * The insert and this check are separate statements: the package is briefly
 * readable before it is verified, and a failed withdrawal leaves a residue
 * that the next request with the same key repairs.
 */
function verifyPublishedPackage(
	db: Database,
	request: PackageRequest,
	id: string
) {
	return verifyPublishedRecord({
		integrityFailure: async (row) =>
			integrityFailure(row, request) ??
			((await recordContentDigest(row.snapshot)) ===
			(await recordContentDigest(request.snapshot))
				? null
				: "Generation Package content digest check failed: the persisted snapshot differs from the submitted one."),
		label: "Generation Package",
		read: () => readPackage(db, request.projectId, id),
		toResult: mapGenerationPackage,
		withdraw: () => withdrawPackage(db, request.projectId, id),
	});
}

export function createGenerationPackageStore(
	db: Database
): GenerationPackageStore {
	return {
		async create(userId, input) {
			const record = await getOwnedAssetRecord(
				db,
				userId,
				input.projectId,
				input.assetRecordId
			);
			if (record?.availability !== "active") {
				return null;
			}

			// The snapshot must describe the Asset Record it is published against.
			if (
				input.snapshot.assetRecord.id !== input.assetRecordId ||
				input.snapshot.assetRecord.projectId !== input.projectId
			) {
				throw new RecordIntegrityError(
					"Generation Package relation check failed: the snapshot describes another Asset Record."
				);
			}

			const request: PackageRequest = {
				assetRecordId: input.assetRecordId,
				projectId: input.projectId,
				snapshot: input.snapshot,
				userId,
			};
			// No column holds the key, so a keyed request derives the package id from
			// it: the same key always addresses the same record.
			const id = await resolveRecordId(
				{
					assetRecordId: input.assetRecordId,
					kind: "generation-package",
					projectId: input.projectId,
					userId,
				},
				input.idempotencyKey
			);
			if (input.idempotencyKey) {
				const replayed = await readReplay(db, request, id);
				if (replayed) {
					return replayed;
				}
			}

			const insert = db.insert(generationPackages).values({
				id,
				projectId: input.projectId,
				assetRecordId: input.assetRecordId,
				createdByUserId: userId,
				snapshot: { ...input.snapshot },
			});
			const [written] = await (input.idempotencyKey
				? insert.onConflictDoNothing()
				: insert
			).returning();
			if (written) {
				return verifyPublishedPackage(db, request, written.id);
			}
			// A concurrent request with the same key won the insert.
			const winner = input.idempotencyKey
				? await readReplay(db, request, id)
				: null;
			if (!winner) {
				throw new RetryablePublicationError("Generation Package");
			}
			return winner;
		},
		async list(userId, projectId, assetRecordId) {
			const record = await getOwnedAssetRecord(
				db,
				userId,
				projectId,
				assetRecordId
			);
			if (!record || record.availability === "erased") {
				return null;
			}

			const rows = await db
				.select()
				.from(generationPackages)
				.where(
					and(
						eq(generationPackages.projectId, projectId),
						eq(generationPackages.assetRecordId, assetRecordId)
					)
				)
				.orderBy(
					desc(generationPackages.createdAt),
					desc(generationPackages.id)
				);
			return rows.map(mapGenerationPackage);
		},
	};
}
