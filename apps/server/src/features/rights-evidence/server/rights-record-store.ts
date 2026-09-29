import type {
	RightsRecord,
	RightsRecordCreateInput,
	RightsRecordCreateResult,
	RightsRecordStore,
} from "@sprite-anvil/api/rights-records";
import { rightsRecordSchema } from "@sprite-anvil/api/rights-records";
import type { Database } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { project } from "@sprite-anvil/db/schema/project";
import { rightsRecords } from "@sprite-anvil/db/schema/rights-records";
import { and, desc, eq } from "drizzle-orm";

function toRightsRecord(
	record: typeof rightsRecords.$inferSelect
): RightsRecord {
	return rightsRecordSchema.parse({
		assetRecordId: record.assetRecordId,
		assertedScope: record.assertedScope,
		createdAt: record.createdAt.toISOString(),
		evidence: record.evidence,
		id: record.id,
		projectId: record.projectId,
		restrictions: record.restrictions,
		rightsHolderOrProvider: record.rightsHolderOrProvider,
		source: record.source,
		state: record.state,
		uncertainty: record.uncertainty,
		versionNumber: record.versionNumber,
	});
}

function matchesInput(
	record: typeof rightsRecords.$inferSelect,
	input: RightsRecordCreateInput
) {
	return (
		record.projectId === input.projectId &&
		record.assetRecordId === input.assetRecordId &&
		record.source === input.source &&
		record.rightsHolderOrProvider === input.rightsHolderOrProvider &&
		record.assertedScope === input.assertedScope &&
		record.evidence === input.evidence &&
		record.restrictions === input.restrictions &&
		record.uncertainty === input.uncertainty &&
		record.state === input.state
	);
}

async function createNextRevision(
	db: Database,
	userId: string,
	input: RightsRecordCreateInput,
	attempt = 0
): Promise<RightsRecordCreateResult> {
	const [existing] = await db
		.select()
		.from(rightsRecords)
		.where(eq(rightsRecords.id, input.id))
		.limit(1);
	if (existing) {
		return matchesInput(existing, input)
			? { ok: true, record: toRightsRecord(existing) }
			: { ok: false, reason: "conflict" };
	}

	const [latest] = await db
		.select({ versionNumber: rightsRecords.versionNumber })
		.from(rightsRecords)
		.where(
			and(
				eq(rightsRecords.projectId, input.projectId),
				eq(rightsRecords.assetRecordId, input.assetRecordId)
			)
		)
		.orderBy(desc(rightsRecords.versionNumber))
		.limit(1);

	const [created] = await db
		.insert(rightsRecords)
		.values({
			...input,
			createdByUserId: userId,
			versionNumber: (latest?.versionNumber ?? 0) + 1,
		})
		.onConflictDoNothing()
		.returning();
	if (created) {
		return { ok: true, record: toRightsRecord(created) };
	}
	if (attempt < 4) {
		return createNextRevision(db, userId, input, attempt + 1);
	}
	return { ok: false, reason: "conflict" };
}

export function createRightsRecordStore(db: Database): RightsRecordStore {
	return {
		async createRevision(userId, input) {
			const [ownedAssetRecord] = await db
				.select({
					availability: assetRecords.availability,
					id: assetRecords.id,
				})
				.from(assetRecords)
				.innerJoin(project, eq(project.id, assetRecords.projectId))
				.where(
					and(
						eq(assetRecords.projectId, input.projectId),
						eq(assetRecords.id, input.assetRecordId),
						eq(project.ownerUserId, userId)
					)
				)
				.limit(1);
			if (!ownedAssetRecord || ownedAssetRecord.availability === "erased") {
				return { ok: false, reason: "not_found" };
			}

			return createNextRevision(db, userId, input);
		},
		async list(userId, projectId, assetRecordId) {
			const [ownedAssetRecord] = await db
				.select({
					availability: assetRecords.availability,
					id: assetRecords.id,
				})
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
			if (!ownedAssetRecord || ownedAssetRecord.availability === "erased") {
				return null;
			}

			const records = await db
				.select()
				.from(rightsRecords)
				.where(
					and(
						eq(rightsRecords.projectId, projectId),
						eq(rightsRecords.assetRecordId, assetRecordId)
					)
				)
				.orderBy(desc(rightsRecords.versionNumber));
			return records.map(toRightsRecord);
		},
	};
}
