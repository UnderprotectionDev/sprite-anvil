import type {
	CollectionAssetRecord,
	CollectionCatalog,
	CollectionCreateInput,
	CollectionMembership,
	CollectionMembershipInput,
	CollectionRecord,
	CollectionStore,
} from "@sprite-anvil/api/collections";
import {
	collectionAssetRecordSchema,
	collectionCatalogSchema,
	collectionMembershipSchema,
	collectionRecordSchema,
} from "@sprite-anvil/api/collections";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import {
	collectionAssetRecords,
	collections,
} from "@sprite-anvil/db/schema/collections";
import { and, asc, eq } from "drizzle-orm";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function toCollectionRecord(
	record: typeof collections.$inferSelect
): CollectionRecord {
	return collectionRecordSchema.parse({
		id: record.id,
		projectId: record.projectId,
		name: record.name,
		createdAt: toISOString(record.createdAt),
	});
}

function toCollectionMembership(
	record: typeof collectionAssetRecords.$inferSelect
): CollectionMembership {
	return collectionMembershipSchema.parse({
		projectId: record.projectId,
		collectionId: record.collectionId,
		assetRecordId: record.assetRecordId,
		createdAt: toISOString(record.createdAt),
	});
}

function toCollectionAssetRecord(record: {
	assetFamilyId: string | null;
	assetFamilyName: string | null;
	availability: "active" | "archived" | "erased";
	id: string;
	name: string;
}): CollectionAssetRecord {
	return collectionAssetRecordSchema.parse({
		id: record.id,
		name: record.availability === "erased" ? null : record.name,
		assetFamilyId:
			record.availability === "erased" ? null : record.assetFamilyId,
		assetFamilyName:
			record.availability === "erased" ? null : record.assetFamilyName,
		availability: record.availability,
	});
}

export function createCollectionStore(db: Database): CollectionStore {
	return {
		async list(userId, projectId) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}

			const [collectionRows, membershipRows, assetRecordRows] =
				await Promise.all([
					db
						.select()
						.from(collections)
						.where(eq(collections.projectId, projectId))
						.orderBy(asc(collections.name), asc(collections.createdAt)),
					db
						.select()
						.from(collectionAssetRecords)
						.where(eq(collectionAssetRecords.projectId, projectId))
						.orderBy(asc(collectionAssetRecords.createdAt)),
					db
						.select({
							id: assetRecords.id,
							name: assetRecords.name,
							assetFamilyId: assetRecords.assetFamilyId,
							assetFamilyName: assetFamilies.name,
							availability: assetRecords.availability,
						})
						.from(assetRecords)
						.leftJoin(
							assetFamilies,
							and(
								eq(assetFamilies.projectId, assetRecords.projectId),
								eq(assetFamilies.id, assetRecords.assetFamilyId)
							)
						)
						.where(eq(assetRecords.projectId, projectId))
						.orderBy(asc(assetRecords.name)),
				]);

			return collectionCatalogSchema.parse({
				collections: collectionRows.map(toCollectionRecord),
				memberships: membershipRows.map(toCollectionMembership),
				assetRecords: assetRecordRows.map((record) =>
					toCollectionAssetRecord({
						...record,
						assetFamilyName: record.assetFamilyName ?? null,
						assetFamilyId: record.assetFamilyId ?? null,
					})
				),
			} satisfies CollectionCatalog);
		},

		async create(userId, input: CollectionCreateInput) {
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return null;
			}

			const [record] = await db
				.insert(collections)
				.values({
					id: crypto.randomUUID(),
					projectId: input.projectId,
					name: input.name,
					createdByUserId: userId,
				})
				.returning();
			return record ? toCollectionRecord(record) : null;
		},

		async addAssetRecord(userId, input: CollectionMembershipInput) {
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return null;
			}

			const [collection] = await db
				.select({ id: collections.id })
				.from(collections)
				.where(
					and(
						eq(collections.projectId, input.projectId),
						eq(collections.id, input.collectionId)
					)
				)
				.limit(1);
			const [assetRecord] = await db
				.select({
					id: assetRecords.id,
					availability: assetRecords.availability,
				})
				.from(assetRecords)
				.where(
					and(
						eq(assetRecords.projectId, input.projectId),
						eq(assetRecords.id, input.assetRecordId)
					)
				)
				.limit(1);
			if (
				!(collection && assetRecord) ||
				assetRecord.availability === "erased"
			) {
				return null;
			}

			const values = {
				projectId: input.projectId,
				collectionId: input.collectionId,
				assetRecordId: input.assetRecordId,
				createdByUserId: userId,
			};
			const [membership] = await db
				.insert(collectionAssetRecords)
				.values(values)
				.onConflictDoNothing()
				.returning();
			if (membership) {
				return toCollectionMembership(membership);
			}

			const [existingMembership] = await db
				.select()
				.from(collectionAssetRecords)
				.where(
					and(
						eq(collectionAssetRecords.projectId, input.projectId),
						eq(collectionAssetRecords.collectionId, input.collectionId),
						eq(collectionAssetRecords.assetRecordId, input.assetRecordId)
					)
				)
				.limit(1);
			return existingMembership
				? toCollectionMembership(existingMembership)
				: null;
		},

		async removeAssetRecord(userId, input: CollectionMembershipInput) {
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return null;
			}

			const [membership] = await db
				.delete(collectionAssetRecords)
				.where(
					and(
						eq(collectionAssetRecords.projectId, input.projectId),
						eq(collectionAssetRecords.collectionId, input.collectionId),
						eq(collectionAssetRecords.assetRecordId, input.assetRecordId)
					)
				)
				.returning();
			return membership ? toCollectionMembership(membership) : null;
		},
	};
}
