import type {
	AssetFamilyCanonicalDesign,
	AssetFamilyCanonicalDesignInput,
	AssetVersion,
	AssetVersionFileRecord,
	AssetVersionReviewEvent,
	AssetVersionReviewInput,
	AssetVersionStore,
} from "@sprite-anvil/api/asset-versions";
import {
	assetFamilyCanonicalDesignSchema,
	assetVersionReviewEventSchema,
	assetVersionSchema,
} from "@sprite-anvil/api/asset-versions";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import {
	assetFamilyCanonicalDesigns,
	assetRecords,
	assetVersionReviewEvents,
	assetVersions,
} from "@sprite-anvil/db/schema/asset-families";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function toReviewEvent(
	record: typeof assetVersionReviewEvents.$inferSelect
): AssetVersionReviewEvent {
	return assetVersionReviewEventSchema.parse({
		id: record.id,
		assetVersionId: record.assetVersionId,
		type: record.type,
		rationale: record.rationale,
		createdAt: toISOString(record.createdAt),
	});
}

function toCanonicalDesign(
	record: typeof assetFamilyCanonicalDesigns.$inferSelect
): AssetFamilyCanonicalDesign {
	return assetFamilyCanonicalDesignSchema.parse({
		id: record.id,
		projectId: record.projectId,
		assetFamilyId: record.assetFamilyId,
		assetRecordId: record.assetRecordId,
		assetVersionId: record.assetVersionId,
		createdAt: toISOString(record.createdAt),
	});
}

function toAssetVersion(
	record: typeof assetVersions.$inferSelect,
	reviewEvents: AssetVersionReviewEvent[]
): AssetVersion {
	return assetVersionSchema.parse({
		id: record.id,
		projectId: record.projectId,
		assetFamilyId: record.assetFamilyId,
		assetRecordId: record.assetRecordId,
		versionNumber: record.versionNumber,
		contentType: record.contentType,
		contentLength: record.contentLength,
		contentDigest: record.contentDigest,
		integrityVerified: record.integrityVerified,
		previewUrl: `/api/projects/${encodeURIComponent(record.projectId)}/asset-versions/${record.id}/preview`,
		reviewDisposition: reviewEvents.at(-1)?.type ?? "candidate",
		reviewEvents,
		createdAt: toISOString(record.createdAt),
	});
}

function toFileRecord(
	record: typeof assetVersions.$inferSelect
): AssetVersionFileRecord {
	return {
		id: record.id,
		projectId: record.projectId,
		assetFamilyId: record.assetFamilyId,
		assetRecordId: record.assetRecordId,
		objectKey: record.objectKey,
		contentType: record.contentType,
		contentLength: record.contentLength,
		contentDigest: record.contentDigest,
		idempotencyKey: record.idempotencyKey,
		integrityVerified: record.integrityVerified,
	};
}

export function createAssetVersionStore(db: Database): AssetVersionStore {
	return {
		async list(userId, projectId) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}

			const [versionRows, reviewRows, canonicalRows] = await Promise.all([
				db
					.select()
					.from(assetVersions)
					.where(eq(assetVersions.projectId, projectId))
					.orderBy(
						asc(assetVersions.assetRecordId),
						asc(assetVersions.versionNumber)
					),
				db
					.select()
					.from(assetVersionReviewEvents)
					.where(eq(assetVersionReviewEvents.projectId, projectId))
					.orderBy(
						asc(assetVersionReviewEvents.createdAt),
						asc(assetVersionReviewEvents.id)
					),
				db
					.select()
					.from(assetFamilyCanonicalDesigns)
					.where(eq(assetFamilyCanonicalDesigns.projectId, projectId))
					.orderBy(
						asc(assetFamilyCanonicalDesigns.createdAt),
						asc(assetFamilyCanonicalDesigns.id)
					),
			]);

			const reviewsByVersion = new Map<string, AssetVersionReviewEvent[]>();
			for (const reviewRow of reviewRows) {
				const events = reviewsByVersion.get(reviewRow.assetVersionId) ?? [];
				events.push(toReviewEvent(reviewRow));
				reviewsByVersion.set(reviewRow.assetVersionId, events);
			}

			return {
				assetVersions: versionRows.map((versionRow) =>
					toAssetVersion(versionRow, reviewsByVersion.get(versionRow.id) ?? [])
				),
				canonicalDesigns: canonicalRows.map(toCanonicalDesign),
			};
		},

		async getAssetRecordForUpload(userId, projectId, assetRecordId) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}
			const [record] = await db
				.select({
					projectId: assetRecords.projectId,
					assetFamilyId: assetRecords.assetFamilyId,
					assetRecordId: assetRecords.id,
				})
				.from(assetRecords)
				.where(
					and(
						eq(assetRecords.projectId, projectId),
						eq(assetRecords.id, assetRecordId),
						isNotNull(assetRecords.assetFamilyId)
					)
				)
				.limit(1);
			return record ?? null;
		},

		async createCandidateVersion(userId, input) {
			if (
				!(
					input.integrityVerified &&
					input.contentDigest &&
					/^[0-9a-f]{64}$/.test(input.contentDigest)
				)
			) {
				return null;
			}
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return null;
			}

			const [assetRecord] = await db
				.select({
					id: assetRecords.id,
					assetFamilyId: assetRecords.assetFamilyId,
				})
				.from(assetRecords)
				.where(
					and(
						eq(assetRecords.projectId, input.projectId),
						eq(assetRecords.assetFamilyId, input.assetFamilyId),
						eq(assetRecords.id, input.assetRecordId)
					)
				)
				.limit(1);
			if (!assetRecord) {
				return null;
			}

			const readExistingVersion = async () => {
				const [existing] = await db
					.select()
					.from(assetVersions)
					.where(
						and(
							eq(assetVersions.projectId, input.projectId),
							eq(assetVersions.assetRecordId, assetRecord.id),
							eq(assetVersions.idempotencyKey, input.idempotencyKey)
						)
					)
					.limit(1);
				if (!existing) {
					return null;
				}
				if (
					existing.contentDigest !== input.contentDigest ||
					existing.contentLength !== input.contentLength ||
					existing.contentType !== input.contentType
				) {
					return { kind: "idempotency-conflict" as const };
				}
				const reviewRows = await db
					.select()
					.from(assetVersionReviewEvents)
					.where(eq(assetVersionReviewEvents.assetVersionId, existing.id))
					.orderBy(
						asc(assetVersionReviewEvents.createdAt),
						asc(assetVersionReviewEvents.id)
					);
				return {
					kind: "existing" as const,
					version: toAssetVersion(existing, reviewRows.map(toReviewEvent)),
				};
			};
			const existingVersion = await readExistingVersion();
			if (existingVersion) {
				return existingVersion;
			}

			try {
				const [, [version], [candidateEvent]] = await db.batch([
					db.execute(sql`
						select pg_advisory_xact_lock(
							hashtextextended(${assetRecord.id}, 0)
						)
					`),
					db
						.insert(assetVersions)
						.values({
							id: input.id,
							projectId: input.projectId,
							assetFamilyId: assetRecord.assetFamilyId,
							assetRecordId: assetRecord.id,
							versionNumber: sql<number>`coalesce(
								(select max(${assetVersions.versionNumber})
								 from ${assetVersions}
								 where ${assetVersions.assetRecordId} = ${assetRecord.id}),
								0
							) + 1`,
							objectKey: input.objectKey,
							contentType: input.contentType,
							contentLength: input.contentLength,
							contentDigest: input.contentDigest,
							integrityVerified: input.integrityVerified,
							idempotencyKey: input.idempotencyKey,
							createdByUserId: userId,
						})
						.returning(),
					db
						.insert(assetVersionReviewEvents)
						.values({
							id: crypto.randomUUID(),
							projectId: input.projectId,
							assetFamilyId: assetRecord.assetFamilyId,
							assetRecordId: assetRecord.id,
							assetVersionId: input.id,
							type: "candidate",
							createdByUserId: userId,
						})
						.returning(),
				]);
				return version && candidateEvent
					? {
							kind: "created" as const,
							version: toAssetVersion(version, [toReviewEvent(candidateEvent)]),
						}
					: null;
			} catch (error) {
				const racedVersion = await readExistingVersion();
				if (racedVersion) {
					return racedVersion;
				}
				throw error;
			}
		},

		async getFileRecord(userId, projectId, assetVersionId) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}
			const [version] = await db
				.select()
				.from(assetVersions)
				.where(
					and(
						eq(assetVersions.projectId, projectId),
						eq(assetVersions.id, assetVersionId)
					)
				)
				.limit(1);
			return version ? toFileRecord(version) : null;
		},

		async recordReviewEvent(userId, input: AssetVersionReviewInput) {
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return null;
			}

			const [version] = await db
				.select()
				.from(assetVersions)
				.where(
					and(
						eq(assetVersions.projectId, input.projectId),
						eq(assetVersions.id, input.assetVersionId)
					)
				)
				.limit(1);
			if (!version) {
				return null;
			}
			const [latestEvent] = await db
				.select({ type: assetVersionReviewEvents.type })
				.from(assetVersionReviewEvents)
				.where(
					and(
						eq(assetVersionReviewEvents.projectId, input.projectId),
						eq(assetVersionReviewEvents.assetVersionId, input.assetVersionId)
					)
				)
				.orderBy(
					desc(assetVersionReviewEvents.createdAt),
					desc(assetVersionReviewEvents.id)
				)
				.limit(1);
			if (latestEvent?.type === input.decision) {
				return null;
			}
			if (
				input.decision === "approved" &&
				!(version.integrityVerified && version.contentDigest)
			) {
				return null;
			}

			const [event] = await db
				.insert(assetVersionReviewEvents)
				.values({
					id: crypto.randomUUID(),
					projectId: version.projectId,
					assetFamilyId: version.assetFamilyId,
					assetRecordId: version.assetRecordId,
					assetVersionId: version.id,
					type: input.decision,
					rationale: input.rationale.trim(),
					createdByUserId: userId,
				})
				.returning();
			return event ? toReviewEvent(event) : null;
		},

		async selectCanonicalDesign(
			userId,
			input: AssetFamilyCanonicalDesignInput
		) {
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return null;
			}

			const [version] = await db
				.select()
				.from(assetVersions)
				.where(
					and(
						eq(assetVersions.projectId, input.projectId),
						eq(assetVersions.assetFamilyId, input.assetFamilyId),
						eq(assetVersions.id, input.assetVersionId)
					)
				)
				.limit(1);
			if (!version) {
				return null;
			}

			const [latestReviewEvent] = await db
				.select({ type: assetVersionReviewEvents.type })
				.from(assetVersionReviewEvents)
				.where(eq(assetVersionReviewEvents.assetVersionId, version.id))
				.orderBy(
					desc(assetVersionReviewEvents.createdAt),
					desc(assetVersionReviewEvents.id)
				)
				.limit(1);
			if (
				latestReviewEvent?.type !== "approved" ||
				!(version.integrityVerified && version.contentDigest)
			) {
				return null;
			}

			const [currentSelection] = await db
				.select()
				.from(assetFamilyCanonicalDesigns)
				.where(
					and(
						eq(assetFamilyCanonicalDesigns.projectId, input.projectId),
						eq(assetFamilyCanonicalDesigns.assetFamilyId, input.assetFamilyId)
					)
				)
				.orderBy(
					desc(assetFamilyCanonicalDesigns.createdAt),
					desc(assetFamilyCanonicalDesigns.id)
				)
				.limit(1);
			if (currentSelection?.assetVersionId === version.id) {
				return toCanonicalDesign(currentSelection);
			}

			const [selection] = await db
				.insert(assetFamilyCanonicalDesigns)
				.values({
					id: crypto.randomUUID(),
					projectId: version.projectId,
					assetFamilyId: version.assetFamilyId,
					assetRecordId: version.assetRecordId,
					assetVersionId: version.id,
					createdByUserId: userId,
				})
				.returning();
			return selection ? toCanonicalDesign(selection) : null;
		},
	};
}
