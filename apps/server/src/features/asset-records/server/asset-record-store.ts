import type {
	AssetRecord,
	AssetRecordMeasurementsUpdateInput,
	AssetRecordStore,
} from "@sprite-anvil/api/asset-records";
import { assetRecordSchema } from "@sprite-anvil/api/asset-records";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { assetRecordMeasurements } from "@sprite-anvil/db/schema/asset-record-measurements";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { project } from "@sprite-anvil/db/schema/project";
import { and, asc, desc, eq } from "drizzle-orm";

function toAssetRecord(
	row: typeof assetRecords.$inferSelect,
	measurements?: unknown
): AssetRecord {
	return assetRecordSchema.parse({
		availability: row.availability,
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		identityCriteria: row.identityCriteria ?? [],
		measurements: measurements ?? undefined,
		name: row.name,
		projectId: row.projectId,
		supportLevel: row.supportLevel,
	});
}

export function createAssetRecordStore(db: Database): AssetRecordStore {
	return {
		async create(userId, input) {
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return null;
			}

			const [record] = await db
				.insert(assetRecords)
				.values({
					id: input.id,
					createdByUserId: userId,
					identityCriteria: input.identityCriteria,
					name: input.name,
					projectId: input.projectId,
					supportLevel: "general",
					availability: "active",
				})
				.onConflictDoNothing()
				.returning();

			if (record) {
				return toAssetRecord(record);
			}
			return this.get(userId, input.projectId, input.id);
		},
		async get(userId, projectId, assetRecordId) {
			const [row] = await db
				.select({
					measurements: assetRecordMeasurements.measurements,
					record: assetRecords,
				})
				.from(assetRecords)
				.leftJoin(
					assetRecordMeasurements,
					and(
						eq(assetRecordMeasurements.projectId, assetRecords.projectId),
						eq(assetRecordMeasurements.assetRecordId, assetRecords.id)
					)
				)
				.innerJoin(project, eq(project.id, assetRecords.projectId))
				.where(
					and(
						eq(assetRecords.id, assetRecordId),
						eq(assetRecords.projectId, projectId),
						eq(project.ownerUserId, userId)
					)
				)
				.limit(1);
			return row ? toAssetRecord(row.record, row.measurements) : null;
		},
		async list(userId, projectId) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}

			const rows = await db
				.select({
					measurements: assetRecordMeasurements.measurements,
					record: assetRecords,
				})
				.from(assetRecords)
				.leftJoin(
					assetRecordMeasurements,
					and(
						eq(assetRecordMeasurements.projectId, assetRecords.projectId),
						eq(assetRecordMeasurements.assetRecordId, assetRecords.id)
					)
				)
				.innerJoin(project, eq(project.id, assetRecords.projectId))
				.where(
					and(
						eq(assetRecords.projectId, projectId),
						eq(project.ownerUserId, userId)
					)
				)
				.orderBy(desc(assetRecords.createdAt), asc(assetRecords.name));
			return rows.map((row) => toAssetRecord(row.record, row.measurements));
		},
		async updateMeasurements(
			userId,
			input: AssetRecordMeasurementsUpdateInput
		) {
			const record = await this.get(
				userId,
				input.projectId,
				input.assetRecordId
			);
			if (!record) {
				return null;
			}

			await db
				.insert(assetRecordMeasurements)
				.values({
					assetRecordId: input.assetRecordId,
					measurements: input.measurements,
					projectId: input.projectId,
				})
				.onConflictDoUpdate({
					target: [
						assetRecordMeasurements.projectId,
						assetRecordMeasurements.assetRecordId,
					],
					set: { measurements: input.measurements },
				});

			return this.get(userId, input.projectId, input.assetRecordId);
		},
	};
}
