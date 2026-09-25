import { assetVersionContentTypeSchema } from "@sprite-anvil/api/asset-record-tracking";
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
import { assetFamilyCanonicalDesigns } from "@sprite-anvil/db/schema/asset-families";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersionQualityEvidence,
	assetVersionReviewEvents,
	assetVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";

const contentDigestPattern = /^[0-9a-f]{64}$/;

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
		assetVersionId: record.versionId,
		type: record.decision,
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
	assetFamilyId: string,
	reviewEvents: AssetVersionReviewEvent[]
): AssetVersion {
	return assetVersionSchema.parse({
		id: record.id,
		projectId: record.projectId,
		assetFamilyId,
		assetRecordId: record.assetRecordId,
		versionNumber: record.versionNumber,
		contentType: assetVersionContentTypeSchema.parse(record.contentType),
		contentLength: record.byteSize,
		contentDigest: record.contentDigest ?? record.sha256,
		integrityVerified: record.integrityVerified,
		previewUrl: `/api/projects/${encodeURIComponent(record.projectId)}/asset-versions/${record.id}/preview`,
		reviewDisposition: reviewEvents.at(-1)?.type ?? "candidate",
		reviewEvents,
		createdAt: toISOString(record.createdAt),
	});
}

function toFileRecord(
	record: typeof assetVersions.$inferSelect,
	assetFamilyId: string
): AssetVersionFileRecord {
	return {
		id: record.id,
		projectId: record.projectId,
		assetFamilyId,
		assetRecordId: record.assetRecordId,
		fileName: record.fileName,
		objectKey: record.objectKey,
		contentType: assetVersionContentTypeSchema.parse(record.contentType),
		contentLength: record.byteSize,
		contentDigest: record.contentDigest ?? record.sha256,
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
					.select({
						version: assetVersions,
						assetFamilyId: assetRecords.assetFamilyId,
					})
					.from(assetVersions)
					.innerJoin(
						assetRecords,
						and(
							eq(assetRecords.projectId, assetVersions.projectId),
							eq(assetRecords.id, assetVersions.assetRecordId)
						)
					)
					.where(
						and(
							eq(assetVersions.projectId, projectId),
							isNotNull(assetRecords.assetFamilyId)
						)
					)
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
				const events = reviewsByVersion.get(reviewRow.versionId) ?? [];
				events.push(toReviewEvent(reviewRow));
				reviewsByVersion.set(reviewRow.versionId, events);
			}

			return {
				assetVersions: versionRows
					.map(({ version, assetFamilyId }) =>
						assetFamilyId
							? toAssetVersion(
									version,
									assetFamilyId,
									reviewsByVersion.get(version.id) ?? []
								)
							: null
					)
					.filter((version): version is AssetVersion => version !== null),
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
			return record?.assetFamilyId
				? { ...record, assetFamilyId: record.assetFamilyId }
				: null;
		},

		async createCandidateVersion(userId, input) {
			if (
				!(
					input.integrityVerified &&
					input.contentDigest &&
					contentDigestPattern.test(input.contentDigest)
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
			if (!assetRecord?.assetFamilyId) {
				return null;
			}
			const { assetFamilyId } = assetRecord;

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
					existing.byteSize !== input.contentLength ||
					existing.contentType !== input.contentType
				) {
					return { kind: "idempotency-conflict" as const };
				}
				const reviewRows = await db
					.select()
					.from(assetVersionReviewEvents)
					.where(eq(assetVersionReviewEvents.versionId, existing.id))
					.orderBy(
						asc(assetVersionReviewEvents.createdAt),
						asc(assetVersionReviewEvents.id)
					);
				return {
					kind: "existing" as const,
					version: toAssetVersion(
						existing,
						assetFamilyId,
						reviewRows.map(toReviewEvent)
					),
				};
			};
			const existingVersion = await readExistingVersion();
			if (existingVersion) {
				return existingVersion;
			}

			try {
				const [, [version], [candidateEvent], [qualityEvidence]] =
					await db.batch([
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
								assetFamilyId,
								assetRecordId: assetRecord.id,
								versionNumber: sql<number>`coalesce(
								(select max(${assetVersions.versionNumber})
								 from ${assetVersions}
								 where ${assetVersions.assetRecordId} = ${assetRecord.id}),
								0
							) + 1`,
								objectKey: input.objectKey,
								fileName: input.fileName,
								contentType: input.contentType,
								sha256: input.contentDigest,
								byteSize: input.contentLength,
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
								assetRecordId: assetRecord.id,
								versionId: input.id,
								decision: "candidate",
								rationale: null,
								createdByUserId: userId,
							})
							.returning(),
						db
							.insert(assetVersionQualityEvidence)
							.values({
								id: crypto.randomUUID(),
								projectId: input.projectId,
								versionId: input.id,
								gate: "format_signature",
								result: "matched",
								sha256: input.contentDigest,
								byteSize: input.contentLength,
								createdByUserId: userId,
							})
							.returning(),
					]);
				return version && candidateEvent && qualityEvidence
					? {
							kind: "created" as const,
							version: toAssetVersion(version, assetFamilyId, [
								toReviewEvent(candidateEvent),
							]),
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
			const [versionRow] = await db
				.select({
					version: assetVersions,
					assetFamilyId: assetRecords.assetFamilyId,
				})
				.from(assetVersions)
				.innerJoin(
					assetRecords,
					and(
						eq(assetRecords.projectId, assetVersions.projectId),
						eq(assetRecords.id, assetVersions.assetRecordId)
					)
				)
				.where(
					and(
						eq(assetVersions.projectId, projectId),
						eq(assetVersions.id, assetVersionId)
					)
				)
				.limit(1);
			if (!versionRow?.assetFamilyId) {
				return null;
			}
			return toFileRecord(versionRow.version, versionRow.assetFamilyId);
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
			if (!version?.assetFamilyId) {
				return null;
			}
			const [latestEvent] = await db
				.select({ type: assetVersionReviewEvents.decision })
				.from(assetVersionReviewEvents)
				.where(
					and(
						eq(assetVersionReviewEvents.projectId, input.projectId),
						eq(assetVersionReviewEvents.versionId, input.assetVersionId)
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
					assetRecordId: version.assetRecordId,
					versionId: version.id,
					decision: input.decision,
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
			if (!version?.assetFamilyId) {
				return null;
			}

			const [latestReviewEvent] = await db
				.select({ type: assetVersionReviewEvents.decision })
				.from(assetVersionReviewEvents)
				.where(eq(assetVersionReviewEvents.versionId, version.id))
				.orderBy(
					desc(assetVersionReviewEvents.createdAt),
					desc(assetVersionReviewEvents.id)
				)
				.limit(1);
			if (
				latestReviewEvent?.type !== "approved" ||
				!(
					version.integrityVerified &&
					(version.contentDigest ?? version.sha256)
				)
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

			const [[selection]] = await db.batch([
				db
					.insert(assetFamilyCanonicalDesigns)
					.values({
						id: crypto.randomUUID(),
						projectId: version.projectId,
						assetFamilyId: version.assetFamilyId,
						assetRecordId: version.assetRecordId,
						assetVersionId: version.id,
						createdByUserId: userId,
					})
					.returning(),
				db
					.update(assetFamilies)
					.set({ canonicalVersionId: version.id })
					.where(
						and(
							eq(assetFamilies.projectId, input.projectId),
							eq(assetFamilies.id, input.assetFamilyId)
						)
					),
			]);
			return selection ? toCanonicalDesign(selection) : null;
		},
	};
}
