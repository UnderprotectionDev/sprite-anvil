import { assetVersionContentTypeSchema } from "@sprite-anvil/api/asset-record-tracking";
import type {
	AssetFamilyCanonicalDesign,
	AssetFamilyCanonicalDesignInput,
	AssetVersion,
	AssetVersionFileRecord,
	AssetVersionReviewEvent,
	AssetVersionReviewInput,
	AssetVersionStore,
	CompositeVersion,
	CompositeVersionCreateInput,
	CompositeVersionReviewEvent,
	CompositeVersionReviewInput,
	CompositionMembership,
	CreateCandidateVersionResult,
	CreateCompositeVersionResult,
	UnitVersion,
	UnitVersionCorrectionInput,
} from "@sprite-anvil/api/asset-versions";
import {
	assetFamilyCanonicalDesignSchema,
	assetVersionReviewEventSchema,
	assetVersionSchema,
	compositeVersionReviewEventSchema,
	compositeVersionSchema,
	compositionMembershipSchema,
	unitVersionCorrectionInputSchema,
	unitVersionSchema,
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
	compositeVersionReviewEvents,
	compositeVersions,
	compositionMemberships,
	unitVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

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

function toUnitVersion(record: typeof unitVersions.$inferSelect): UnitVersion {
	return unitVersionSchema.parse({
		id: record.id,
		projectId: record.projectId,
		assetRecordId: record.assetRecordId,
		assetVersionId: record.assetVersionId,
		sourceAssetVersionId: record.sourceAssetVersionId,
		unitType: record.unitType,
		unitKey: record.unitKey,
		versionNumber: record.versionNumber,
		createdAt: toISOString(record.createdAt),
	});
}

function toCompositeVersionReviewEvent(
	record: typeof compositeVersionReviewEvents.$inferSelect
): CompositeVersionReviewEvent {
	return compositeVersionReviewEventSchema.parse({
		id: record.id,
		compositeVersionId: record.compositeVersionId,
		type: record.decision,
		rationale: record.rationale,
		createdAt: toISOString(record.createdAt),
	});
}

function toCompositionMembership(
	record: typeof compositionMemberships.$inferSelect
): CompositionMembership {
	return compositionMembershipSchema.parse({
		id: record.id,
		projectId: record.projectId,
		assetRecordId: record.assetRecordId,
		compositeVersionId: record.compositeVersionId,
		unitVersionId: record.unitVersionId,
		unitType: record.unitType,
		unitKey: record.unitKey,
		createdAt: toISOString(record.createdAt),
	});
}

function toCompositeVersion(
	record: typeof compositeVersions.$inferSelect,
	reviewEvents: CompositeVersionReviewEvent[],
	memberships: CompositionMembership[]
): CompositeVersion {
	return compositeVersionSchema.parse({
		id: record.id,
		projectId: record.projectId,
		assetRecordId: record.assetRecordId,
		versionNumber: record.versionNumber,
		reviewDisposition: reviewEvents.at(-1)?.type ?? "candidate",
		reviewEvents,
		compositionMemberships: memberships,
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
		productionSource: record.productionSource ?? "unknown",
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
		productionSource: record.productionSource ?? "unknown",
	};
}

type UnitCorrectionResolution =
	| { kind: "valid"; value?: UnitVersionCorrectionInput }
	| { kind: "invalid" }
	| { kind: "invalid-unit-source" };

async function resolveUnitCorrection(
	db: Database,
	input: AssetVersionFileRecord,
	assetRecordId: string
): Promise<UnitCorrectionResolution> {
	if (!input.unitCorrection) {
		return { kind: "valid" };
	}

	const parsedCorrection = unitVersionCorrectionInputSchema.safeParse(
		input.unitCorrection
	);
	if (!parsedCorrection.success) {
		return { kind: "invalid" };
	}

	const unitCorrection = parsedCorrection.data;
	const [sourceVersion] = await db
		.select({ id: assetVersions.id })
		.from(assetVersions)
		.where(
			and(
				eq(assetVersions.projectId, input.projectId),
				eq(assetVersions.assetRecordId, assetRecordId),
				eq(assetVersions.id, unitCorrection.sourceAssetVersionId)
			)
		)
		.limit(1);
	if (!sourceVersion) {
		return { kind: "invalid" };
	}

	const [sourceUnitVersion] = await db
		.select()
		.from(unitVersions)
		.where(
			and(
				eq(unitVersions.projectId, input.projectId),
				eq(unitVersions.assetVersionId, unitCorrection.sourceAssetVersionId)
			)
		)
		.limit(1);
	if (
		sourceUnitVersion &&
		(sourceUnitVersion.unitType !== unitCorrection.unitType ||
			sourceUnitVersion.unitKey !== unitCorrection.unitKey)
	) {
		return { kind: "invalid-unit-source" };
	}

	return { kind: "valid", value: unitCorrection };
}

async function readExistingVersion(
	db: Database,
	input: AssetVersionFileRecord,
	assetRecordId: string,
	assetFamilyId: string,
	unitCorrection: UnitVersionCorrectionInput | undefined
): Promise<CreateCandidateVersionResult | null> {
	const [existing] = await db
		.select()
		.from(assetVersions)
		.where(
			and(
				eq(assetVersions.projectId, input.projectId),
				eq(assetVersions.assetRecordId, assetRecordId),
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
		existing.contentType !== input.contentType ||
		existing.productionSource !== (input.productionSource ?? "unknown")
	) {
		return { kind: "idempotency-conflict" };
	}

	const [existingUnitVersion] = await db
		.select()
		.from(unitVersions)
		.where(
			and(
				eq(unitVersions.projectId, input.projectId),
				eq(unitVersions.assetVersionId, existing.id)
			)
		)
		.limit(1);
	const correctionMismatch = unitCorrection
		? !existingUnitVersion ||
			existingUnitVersion.sourceAssetVersionId !==
				unitCorrection.sourceAssetVersionId ||
			existingUnitVersion.unitType !== unitCorrection.unitType ||
			existingUnitVersion.unitKey !== unitCorrection.unitKey
		: Boolean(existingUnitVersion);
	if (correctionMismatch) {
		return { kind: "idempotency-conflict" };
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
		kind: "existing",
		version: toAssetVersion(
			existing,
			assetFamilyId,
			reviewRows.map(toReviewEvent)
		),
		...(existingUnitVersion
			? { unitVersion: toUnitVersion(existingUnitVersion) }
			: {}),
	};
}

async function insertCandidateVersion(
	db: Database,
	userId: string,
	input: AssetVersionFileRecord,
	assetRecordId: string,
	assetFamilyId: string,
	unitCorrection: UnitVersionCorrectionInput | undefined
): Promise<CreateCandidateVersionResult | null> {
	if (
		!(input.contentDigest && contentDigestPattern.test(input.contentDigest))
	) {
		return null;
	}
	const advisoryLock = db.execute(sql`
		select pg_advisory_xact_lock(
			hashtextextended(${assetRecordId}, 0)
		)
	`);
	const versionInsert = db
		.insert(assetVersions)
		.values({
			id: input.id,
			projectId: input.projectId,
			assetFamilyId,
			assetRecordId,
			versionNumber: sql<number>`coalesce(
				(select max(${assetVersions.versionNumber})
				 from ${assetVersions}
				 where ${assetVersions.assetRecordId} = ${assetRecordId}),
				0
			) + 1`,
			objectKey: input.objectKey,
			fileName: input.fileName,
			contentType: input.contentType,
			sha256: input.contentDigest,
			byteSize: input.contentLength,
			contentDigest: input.contentDigest,
			integrityVerified: input.integrityVerified,
			productionSource: input.productionSource ?? "unknown",
			idempotencyKey: input.idempotencyKey,
			createdByUserId: userId,
		})
		.returning();
	const candidateEventInsert = db
		.insert(assetVersionReviewEvents)
		.values({
			id: crypto.randomUUID(),
			projectId: input.projectId,
			assetRecordId,
			versionId: input.id,
			decision: "candidate",
			rationale: null,
			createdByUserId: userId,
		})
		.returning();
	const qualityEvidenceInsert = db
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
		.returning();

	try {
		if (unitCorrection) {
			const unitVersionInsert = db
				.insert(unitVersions)
				.values({
					id: crypto.randomUUID(),
					projectId: input.projectId,
					assetRecordId,
					assetVersionId: input.id,
					sourceAssetVersionId: unitCorrection.sourceAssetVersionId,
					unitType: unitCorrection.unitType,
					unitKey: unitCorrection.unitKey,
					versionNumber: sql<number>`coalesce(
						(select max(${unitVersions.versionNumber})
						 from ${unitVersions}
						 where ${unitVersions.projectId} = ${input.projectId}
							and ${unitVersions.assetRecordId} = ${assetRecordId}
							and ${unitVersions.unitType} = ${unitCorrection.unitType}
							and ${unitVersions.unitKey} = ${unitCorrection.unitKey}),
						0
					) + 1`,
					createdByUserId: userId,
				})
				.returning();
			const [, [version], [candidateEvent], [qualityEvidence], [unitVersion]] =
				await db.batch([
					advisoryLock,
					versionInsert,
					candidateEventInsert,
					qualityEvidenceInsert,
					unitVersionInsert,
				]);
			return version && candidateEvent && qualityEvidence && unitVersion
				? {
						kind: "created",
						version: toAssetVersion(version, assetFamilyId, [
							toReviewEvent(candidateEvent),
						]),
						unitVersion: toUnitVersion(unitVersion),
					}
				: null;
		}

		const [, [version], [candidateEvent], [qualityEvidence]] = await db.batch([
			advisoryLock,
			versionInsert,
			candidateEventInsert,
			qualityEvidenceInsert,
		]);
		return version && candidateEvent && qualityEvidence
			? {
					kind: "created",
					version: toAssetVersion(version, assetFamilyId, [
						toReviewEvent(candidateEvent),
					]),
				}
			: null;
	} catch (error) {
		const racedVersion = await readExistingVersion(
			db,
			input,
			assetRecordId,
			assetFamilyId,
			unitCorrection
		);
		if (racedVersion) {
			return racedVersion;
		}
		throw error;
	}
}

async function readCompositeVersion(
	db: Database,
	record: typeof compositeVersions.$inferSelect
): Promise<CompositeVersion> {
	const [reviewRows, membershipRows] = await Promise.all([
		db
			.select()
			.from(compositeVersionReviewEvents)
			.where(
				and(
					eq(compositeVersionReviewEvents.projectId, record.projectId),
					eq(compositeVersionReviewEvents.compositeVersionId, record.id)
				)
			)
			.orderBy(
				asc(compositeVersionReviewEvents.createdAt),
				asc(compositeVersionReviewEvents.id)
			),
		db
			.select()
			.from(compositionMemberships)
			.where(
				and(
					eq(compositionMemberships.projectId, record.projectId),
					eq(compositionMemberships.compositeVersionId, record.id)
				)
			)
			.orderBy(
				asc(compositionMemberships.unitType),
				asc(compositionMemberships.unitKey)
			),
	]);
	return toCompositeVersion(
		record,
		reviewRows.map(toCompositeVersionReviewEvent),
		membershipRows.map(toCompositionMembership)
	);
}

async function readExistingCompositeVersion(
	db: Database,
	input: CompositeVersionCreateInput
): Promise<CreateCompositeVersionResult | null> {
	const [existing] = await db
		.select()
		.from(compositeVersions)
		.where(
			and(
				eq(compositeVersions.projectId, input.projectId),
				eq(compositeVersions.assetRecordId, input.assetRecordId),
				eq(compositeVersions.idempotencyKey, input.idempotencyKey)
			)
		)
		.limit(1);
	if (!existing) {
		return null;
	}
	const compositeVersion = await readCompositeVersion(db, existing);
	const existingUnitVersionIds = compositeVersion.compositionMemberships
		.map((membership) => membership.unitVersionId)
		.sort();
	const requestedUnitVersionIds = [...input.unitVersionIds].sort();
	if (
		existingUnitVersionIds.length !== requestedUnitVersionIds.length ||
		existingUnitVersionIds.some(
			(unitVersionId, index) => unitVersionId !== requestedUnitVersionIds[index]
		)
	) {
		return { kind: "idempotency-conflict" };
	}
	return { kind: "existing", compositeVersion };
}

async function insertCompositeVersion(
	db: Database,
	userId: string,
	input: CompositeVersionCreateInput,
	unitRows: (typeof unitVersions.$inferSelect)[]
): Promise<CreateCompositeVersionResult | null> {
	const id = crypto.randomUUID();
	const advisoryLock = db.execute(sql`
		select pg_advisory_xact_lock(
			hashtextextended(${input.assetRecordId}, 0)
		)
	`);
	const compositeVersionInsert = db
		.insert(compositeVersions)
		.values({
			id,
			projectId: input.projectId,
			assetRecordId: input.assetRecordId,
			versionNumber: sql<number>`coalesce(
				(select max(${compositeVersions.versionNumber})
				 from ${compositeVersions}
				 where ${compositeVersions.projectId} = ${input.projectId}
					and ${compositeVersions.assetRecordId} = ${input.assetRecordId}),
				0
			) + 1`,
			idempotencyKey: input.idempotencyKey,
			createdByUserId: userId,
		})
		.returning();
	const candidateReviewInsert = db
		.insert(compositeVersionReviewEvents)
		.values({
			id: crypto.randomUUID(),
			projectId: input.projectId,
			assetRecordId: input.assetRecordId,
			compositeVersionId: id,
			decision: "candidate",
			rationale: null,
			createdByUserId: userId,
		})
		.returning();
	const membershipInsert = db
		.insert(compositionMemberships)
		.values(
			unitRows.map((unitVersion) => ({
				id: crypto.randomUUID(),
				projectId: input.projectId,
				assetRecordId: input.assetRecordId,
				compositeVersionId: id,
				unitVersionId: unitVersion.id,
				unitType: unitVersion.unitType,
				unitKey: unitVersion.unitKey,
			}))
		)
		.returning();

	try {
		const [, [compositeVersion], [candidateReview], savedMemberships] =
			await db.batch([
				advisoryLock,
				compositeVersionInsert,
				candidateReviewInsert,
				membershipInsert,
			]);
		if (
			!(
				compositeVersion &&
				candidateReview &&
				savedMemberships &&
				savedMemberships.length === unitRows.length
			)
		) {
			return null;
		}
		return {
			kind: "created",
			compositeVersion: toCompositeVersion(
				compositeVersion,
				[toCompositeVersionReviewEvent(candidateReview)],
				savedMemberships.map(toCompositionMembership)
			),
		};
	} catch (error) {
		const racedCompositeVersion = await readExistingCompositeVersion(db, input);
		if (racedCompositeVersion) {
			return racedCompositeVersion;
		}
		throw error;
	}
}

export function createAssetVersionStore(db: Database): AssetVersionStore {
	return {
		async list(userId, projectId) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}

			const [
				versionRows,
				reviewRows,
				canonicalRows,
				unitRows,
				compositeRows,
				compositeReviewRows,
				membershipRows,
			] = await Promise.all([
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
				db
					.select()
					.from(unitVersions)
					.where(eq(unitVersions.projectId, projectId))
					.orderBy(
						asc(unitVersions.assetRecordId),
						asc(unitVersions.unitType),
						asc(unitVersions.unitKey),
						asc(unitVersions.versionNumber)
					),
				db
					.select()
					.from(compositeVersions)
					.where(eq(compositeVersions.projectId, projectId))
					.orderBy(
						asc(compositeVersions.assetRecordId),
						asc(compositeVersions.versionNumber)
					),
				db
					.select()
					.from(compositeVersionReviewEvents)
					.where(eq(compositeVersionReviewEvents.projectId, projectId))
					.orderBy(
						asc(compositeVersionReviewEvents.createdAt),
						asc(compositeVersionReviewEvents.id)
					),
				db
					.select()
					.from(compositionMemberships)
					.where(eq(compositionMemberships.projectId, projectId))
					.orderBy(
						asc(compositionMemberships.assetRecordId),
						asc(compositionMemberships.unitType),
						asc(compositionMemberships.unitKey)
					),
			]);

			const reviewsByVersion = new Map<string, AssetVersionReviewEvent[]>();
			for (const reviewRow of reviewRows) {
				const events = reviewsByVersion.get(reviewRow.versionId) ?? [];
				events.push(toReviewEvent(reviewRow));
				reviewsByVersion.set(reviewRow.versionId, events);
			}
			const reviewsByCompositeVersion = new Map<
				string,
				CompositeVersionReviewEvent[]
			>();
			for (const reviewRow of compositeReviewRows) {
				const events =
					reviewsByCompositeVersion.get(reviewRow.compositeVersionId) ?? [];
				events.push(toCompositeVersionReviewEvent(reviewRow));
				reviewsByCompositeVersion.set(reviewRow.compositeVersionId, events);
			}
			const membershipsByCompositeVersion = new Map<
				string,
				CompositionMembership[]
			>();
			for (const membershipRow of membershipRows) {
				const memberships =
					membershipsByCompositeVersion.get(membershipRow.compositeVersionId) ??
					[];
				memberships.push(toCompositionMembership(membershipRow));
				membershipsByCompositeVersion.set(
					membershipRow.compositeVersionId,
					memberships
				);
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
				unitVersions: unitRows.map(toUnitVersion),
				compositeVersions: compositeRows.map((compositeVersion) =>
					toCompositeVersion(
						compositeVersion,
						reviewsByCompositeVersion.get(compositeVersion.id) ?? [],
						membershipsByCompositeVersion.get(compositeVersion.id) ?? []
					)
				),
			};
		},

		async createCompositeVersion(userId, input) {
			if (new Set(input.unitVersionIds).size !== input.unitVersionIds.length) {
				return { kind: "invalid-unit-versions" };
			}
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return null;
			}
			const [assetRecord] = await db
				.select({ id: assetRecords.id })
				.from(assetRecords)
				.where(
					and(
						eq(assetRecords.projectId, input.projectId),
						eq(assetRecords.id, input.assetRecordId),
						isNotNull(assetRecords.assetFamilyId)
					)
				)
				.limit(1);
			if (!assetRecord) {
				return null;
			}

			const existingVersion = await readExistingCompositeVersion(db, input);
			if (existingVersion) {
				return existingVersion;
			}

			const selectedUnits = await db
				.select()
				.from(unitVersions)
				.where(
					and(
						eq(unitVersions.projectId, input.projectId),
						eq(unitVersions.assetRecordId, input.assetRecordId),
						inArray(unitVersions.id, input.unitVersionIds)
					)
				)
				.orderBy(
					asc(unitVersions.unitType),
					asc(unitVersions.unitKey),
					asc(unitVersions.versionNumber)
				);
			if (selectedUnits.length !== input.unitVersionIds.length) {
				return { kind: "invalid-unit-versions" };
			}
			const selectedSlots = new Set<string>();
			for (const unitVersion of selectedUnits) {
				const slot = `${unitVersion.unitType}\u0000${unitVersion.unitKey}`;
				if (selectedSlots.has(slot)) {
					return { kind: "invalid-unit-versions" };
				}
				selectedSlots.add(slot);
			}

			return insertCompositeVersion(db, userId, input, selectedUnits);
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

			const correctionResolution = await resolveUnitCorrection(
				db,
				input,
				assetRecord.id
			);
			if (correctionResolution.kind === "invalid") {
				return null;
			}
			if (correctionResolution.kind === "invalid-unit-source") {
				return correctionResolution;
			}

			const unitCorrection = correctionResolution.value;
			const existingVersion = await readExistingVersion(
				db,
				input,
				assetRecord.id,
				assetRecord.assetFamilyId,
				unitCorrection
			);
			if (existingVersion) {
				return existingVersion;
			}

			return insertCandidateVersion(
				db,
				userId,
				input,
				assetRecord.id,
				assetRecord.assetFamilyId,
				unitCorrection
			);
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

		async recordCompositeVersionReviewEvent(
			userId,
			input: CompositeVersionReviewInput
		) {
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return null;
			}
			const [compositeVersion] = await db
				.select()
				.from(compositeVersions)
				.where(
					and(
						eq(compositeVersions.projectId, input.projectId),
						eq(compositeVersions.id, input.compositeVersionId)
					)
				)
				.limit(1);
			if (!compositeVersion) {
				return null;
			}
			const [latestEvent] = await db
				.select({ type: compositeVersionReviewEvents.decision })
				.from(compositeVersionReviewEvents)
				.where(
					and(
						eq(compositeVersionReviewEvents.projectId, input.projectId),
						eq(
							compositeVersionReviewEvents.compositeVersionId,
							input.compositeVersionId
						)
					)
				)
				.orderBy(
					desc(compositeVersionReviewEvents.createdAt),
					desc(compositeVersionReviewEvents.id)
				)
				.limit(1);
			if (latestEvent?.type === input.decision) {
				return null;
			}
			const [event] = await db
				.insert(compositeVersionReviewEvents)
				.values({
					id: crypto.randomUUID(),
					projectId: compositeVersion.projectId,
					assetRecordId: compositeVersion.assetRecordId,
					compositeVersionId: compositeVersion.id,
					decision: input.decision,
					rationale: input.rationale.trim(),
					createdByUserId: userId,
				})
				.returning();
			return event ? toCompositeVersionReviewEvent(event) : null;
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
