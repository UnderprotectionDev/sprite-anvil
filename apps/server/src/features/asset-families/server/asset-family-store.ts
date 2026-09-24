import type {
	AssetFamilyCreateInput,
	AssetFamilyRecord,
	AssetFamilyRelationship,
	AssetFamilyRelationshipCreateInput,
	AssetFamilyStore,
	AssetRecord,
	AssetRecordCreateInput,
	SubjectIdentityCreateInput,
	SubjectIdentityRecord,
} from "@sprite-anvil/api/asset-families";
import {
	assetFamilyCatalogSchema,
	assetFamilyRecordSchema,
	assetFamilyRelationshipSchema,
	assetRecordSchema,
	subjectIdentityRecordSchema,
} from "@sprite-anvil/api/asset-families";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetFamilyRelationships,
	assetRecords,
	subjectIdentities,
} from "@sprite-anvil/db/schema/asset-families";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { and, asc, eq, inArray } from "drizzle-orm";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function toSubjectIdentityRecord(
	record: typeof subjectIdentities.$inferSelect
): SubjectIdentityRecord {
	return subjectIdentityRecordSchema.parse({
		id: record.id,
		projectId: record.projectId,
		name: record.name,
		createdAt: toISOString(record.createdAt),
	});
}

function toAssetFamilyRecord(
	record: typeof assetFamilies.$inferSelect
): AssetFamilyRecord {
	return assetFamilyRecordSchema.parse({
		id: record.id,
		projectId: record.projectId,
		subjectIdentityId: record.subjectIdentityId,
		name: record.name,
		visualWorldId: record.visualWorldId,
		useContext: record.useContext,
		createdAt: toISOString(record.createdAt),
	});
}

function toAssetRecord(record: typeof assetRecords.$inferSelect): AssetRecord {
	return assetRecordSchema.parse({
		id: record.id,
		projectId: record.projectId,
		assetFamilyId: record.assetFamilyId,
		name: record.name,
		createdAt: toISOString(record.createdAt),
	});
}

function toRelationship(
	record: typeof assetFamilyRelationships.$inferSelect
): AssetFamilyRelationship {
	return assetFamilyRelationshipSchema.parse({
		id: record.id,
		projectId: record.projectId,
		assetFamilyId: record.assetFamilyId,
		sourceAssetRecordId: record.sourceAssetRecordId,
		targetAssetRecordId: record.targetAssetRecordId,
		type: record.type,
		createdAt: toISOString(record.createdAt),
	});
}

export function createAssetFamilyStore(db: Database): AssetFamilyStore {
	return {
		async list(userId, projectId) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}

			const [identityRows, familyRows, assetRows, relationshipRows] =
				await Promise.all([
					db
						.select()
						.from(subjectIdentities)
						.where(eq(subjectIdentities.projectId, projectId))
						.orderBy(asc(subjectIdentities.name)),
					db
						.select()
						.from(assetFamilies)
						.where(eq(assetFamilies.projectId, projectId))
						.orderBy(asc(assetFamilies.createdAt)),
					db
						.select()
						.from(assetRecords)
						.where(eq(assetRecords.projectId, projectId))
						.orderBy(asc(assetRecords.name)),
					db
						.select()
						.from(assetFamilyRelationships)
						.where(eq(assetFamilyRelationships.projectId, projectId))
						.orderBy(asc(assetFamilyRelationships.type)),
				]);

			return assetFamilyCatalogSchema.parse({
				subjectIdentities: identityRows.map(toSubjectIdentityRecord),
				assetFamilies: familyRows.map(toAssetFamilyRecord),
				assetRecords: assetRows.map(toAssetRecord),
				relationships: relationshipRows.map(toRelationship),
			});
		},

		async createSubjectIdentity(userId, input: SubjectIdentityCreateInput) {
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return null;
			}

			const [record] = await db
				.insert(subjectIdentities)
				.values({
					id: crypto.randomUUID(),
					projectId: input.projectId,
					name: input.name,
					createdByUserId: userId,
				})
				.onConflictDoNothing()
				.returning();
			return record ? toSubjectIdentityRecord(record) : null;
		},

		async createAssetFamily(userId, input: AssetFamilyCreateInput) {
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return null;
			}

			const [identity] = await db
				.select({ id: subjectIdentities.id })
				.from(subjectIdentities)
				.where(
					and(
						eq(subjectIdentities.projectId, input.projectId),
						eq(subjectIdentities.id, input.subjectIdentityId)
					)
				)
				.limit(1);
			const [visualWorld] = await db
				.select({ id: visualWorlds.id })
				.from(visualWorlds)
				.where(
					and(
						eq(visualWorlds.id, input.visualWorldId),
						eq(visualWorlds.projectId, input.projectId)
					)
				)
				.limit(1);
			if (!(identity && visualWorld)) {
				return null;
			}

			const [record] = await db
				.insert(assetFamilies)
				.values({
					id: crypto.randomUUID(),
					projectId: input.projectId,
					subjectIdentityId: input.subjectIdentityId,
					name: input.name,
					visualWorldId: input.visualWorldId,
					useContext: input.useContext,
					createdByUserId: userId,
				})
				.onConflictDoNothing()
				.returning();
			return record ? toAssetFamilyRecord(record) : null;
		},

		async createAssetRecord(userId, input: AssetRecordCreateInput) {
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return null;
			}

			const [family] = await db
				.select({ id: assetFamilies.id })
				.from(assetFamilies)
				.where(
					and(
						eq(assetFamilies.id, input.assetFamilyId),
						eq(assetFamilies.projectId, input.projectId)
					)
				)
				.limit(1);
			if (!family) {
				return null;
			}

			const [record] = await db
				.insert(assetRecords)
				.values({
					id: crypto.randomUUID(),
					projectId: input.projectId,
					assetFamilyId: input.assetFamilyId,
					name: input.name,
					createdByUserId: userId,
				})
				.onConflictDoNothing()
				.returning();
			return record ? toAssetRecord(record) : null;
		},

		async createRelationship(
			userId,
			input: AssetFamilyRelationshipCreateInput
		) {
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (
				!ownedProject ||
				input.sourceAssetRecordId === input.targetAssetRecordId
			) {
				return null;
			}

			const matchingRecords = await db
				.select({ id: assetRecords.id })
				.from(assetRecords)
				.where(
					and(
						eq(assetRecords.projectId, input.projectId),
						eq(assetRecords.assetFamilyId, input.assetFamilyId),
						inArray(assetRecords.id, [
							input.sourceAssetRecordId,
							input.targetAssetRecordId,
						])
					)
				);
			const recordIds = new Set(
				matchingRecords.map((assetRecord) => assetRecord.id)
			);
			if (
				!(
					recordIds.has(input.sourceAssetRecordId) &&
					recordIds.has(input.targetAssetRecordId)
				)
			) {
				return null;
			}

			const [record] = await db
				.insert(assetFamilyRelationships)
				.values({
					id: crypto.randomUUID(),
					projectId: input.projectId,
					assetFamilyId: input.assetFamilyId,
					sourceAssetRecordId: input.sourceAssetRecordId,
					targetAssetRecordId: input.targetAssetRecordId,
					type: input.type,
					createdByUserId: userId,
				})
				.onConflictDoNothing()
				.returning();
			return record ? toRelationship(record) : null;
		},
	};
}
