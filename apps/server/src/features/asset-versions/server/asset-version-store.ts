import { assetVersionContentTypeSchema } from "@sprite-anvil/api/asset-record-tracking";
import type {
	AssetFamilyCanonicalDesign,
	AssetFamilyCanonicalDesignInput,
	AssetVersion,
	AssetVersionApprovalBlocked,
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
import {
	createVersionProductionEvidence,
	type ManagedSnapshot,
	type ManualImportEvidence,
	type ManualImportEvidenceInput,
	type VersionProductionEvidence,
} from "@sprite-anvil/api/production-provenance";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { assetFamilyCanonicalDesigns } from "@sprite-anvil/db/schema/asset-families";
import {
	legacyAssetAttestations,
	managedSnapshots,
	manualImportEvidence,
} from "@sprite-anvil/db/schema/asset-production-history";
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
import { generationPackages } from "@sprite-anvil/db/schema/generation-packages";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
	hasManualImportEvidence,
	isManualImportEvidenceRequired,
} from "../../asset-records/server/manual-import-evidence-gate";
import {
	toManagedSnapshot,
	toManualImportEvidence,
} from "../../production-provenance/server/production-provenance-mapper";
import { readAssetVersionApprovalBlockers } from "../../reviews/server/asset-version-approval";
import {
	readBatchReviewEvents,
	recordBatchReviewEvents,
} from "../../reviews/server/batch-review-events";

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
	reviewEvents: AssetVersionReviewEvent[],
	productionEvidence: VersionProductionEvidence = createVersionProductionEvidence(
		record.sourceKind
	)
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
		productionEvidence,
		integrityVerified: record.integrityVerified,
		sourceKind: record.sourceKind,
		previewUrl: `/api/projects/${encodeURIComponent(record.projectId)}/asset-versions/${record.id}/preview`,
		productionSource: record.productionSource ?? "unknown",
		reviewDisposition: reviewEvents.at(-1)?.type ?? "candidate",
		reviewEvents,
		createdAt: toISOString(record.createdAt),
	});
}

async function readVersionProductionEvidence(
	db: Database,
	record: typeof assetVersions.$inferSelect
) {
	const [manualRows, legacyRows, snapshotRows] = await Promise.all([
		db
			.select()
			.from(manualImportEvidence)
			.where(
				and(
					eq(manualImportEvidence.projectId, record.projectId),
					eq(manualImportEvidence.versionId, record.id)
				)
			)
			.orderBy(asc(manualImportEvidence.revision)),
		db
			.select({ id: legacyAssetAttestations.id })
			.from(legacyAssetAttestations)
			.where(
				and(
					eq(legacyAssetAttestations.projectId, record.projectId),
					eq(legacyAssetAttestations.versionId, record.id)
				)
			)
			.limit(1),
		db
			.select()
			.from(managedSnapshots)
			.where(
				and(
					eq(managedSnapshots.projectId, record.projectId),
					eq(managedSnapshots.assetVersionId, record.id)
				)
			)
			.orderBy(asc(managedSnapshots.createdAt), asc(managedSnapshots.id)),
	]);
	const latestManualEvidence = manualRows.at(-1);
	return createVersionProductionEvidence(
		legacyRows.length > 0 ? "legacy_asset" : record.sourceKind,
		latestManualEvidence ? toManualImportEvidence(latestManualEvidence) : null,
		snapshotRows.map(toManagedSnapshot)
	);
}

async function checkReviewApproval(
	db: Database,
	userId: string,
	version: typeof assetVersions.$inferSelect
): Promise<true | AssetVersionApprovalBlocked | null> {
	if (!(version.integrityVerified && version.contentDigest)) {
		return null;
	}
	const productionEvidence = await readVersionProductionEvidence(db, version);
	if (productionEvidence.evidenceLevel === "incomplete") {
		return null;
	}
	if (
		isManualImportEvidenceRequired(version.sourceKind) &&
		!(await hasManualImportEvidence(db, {
			assetRecordId: version.assetRecordId,
			projectId: version.projectId,
			versionId: version.id,
		}))
	) {
		return null;
	}
	const blockers = await readAssetVersionApprovalBlockers(db, userId, version);
	return blockers.length > 0 ? { kind: "approval-blocked", blockers } : true;
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
		existing.productionSource !== (input.productionSource ?? "unknown") ||
		existing.sourceKind !==
			(unitCorrection ? "derived" : (input.sourceKind ?? "manual_import"))
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
	const productionEvidence = await readVersionProductionEvidence(db, existing);
	return {
		kind: "existing",
		version: toAssetVersion(
			existing,
			assetFamilyId,
			reviewRows.map(toReviewEvent),
			productionEvidence
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
			sourceKind: unitCorrection
				? "derived"
				: (input.sourceKind ?? "manual_import"),
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

async function persistManualImportEvidence(
	db: Database,
	userId: string,
	input: ManualImportEvidenceInput
): Promise<Awaited<ReturnType<AssetVersionStore["saveManualImportEvidence"]>>> {
	const [latestReview] = await db
		.select({ decision: assetVersionReviewEvents.decision })
		.from(assetVersionReviewEvents)
		.where(
			and(
				eq(assetVersionReviewEvents.projectId, input.projectId),
				eq(assetVersionReviewEvents.versionId, input.versionId)
			)
		)
		.orderBy(
			desc(assetVersionReviewEvents.createdAt),
			desc(assetVersionReviewEvents.id)
		)
		.limit(1);
	if ((latestReview?.decision ?? "candidate") !== "candidate") {
		return { kind: "not-candidate" };
	}

	const [latestEvidence] = await db
		.select()
		.from(manualImportEvidence)
		.where(
			and(
				eq(manualImportEvidence.projectId, input.projectId),
				eq(manualImportEvidence.versionId, input.versionId)
			)
		)
		.orderBy(desc(manualImportEvidence.revision))
		.limit(1);
	if (latestEvidence && isSameManualImportEvidence(latestEvidence, input)) {
		return {
			kind: "existing",
			evidence: toManualImportEvidence(latestEvidence),
		};
	}

	const revision = (latestEvidence?.revision ?? 0) + 1;
	const [savedEvidence] = await db
		.insert(manualImportEvidence)
		.values({
			id: crypto.randomUUID(),
			projectId: input.projectId,
			assetRecordId: input.assetRecordId,
			versionId: input.versionId,
			generationPackageId: input.generationPackageId,
			revision,
			sourceSurface: input.sourceSurface,
			generationInstruction: input.actualInstruction,
			createdByUserId: userId,
		})
		.onConflictDoNothing()
		.returning();
	if (savedEvidence) {
		return {
			kind: "created",
			evidence: toManualImportEvidence(savedEvidence),
		};
	}

	const [concurrentEvidence] = await db
		.select()
		.from(manualImportEvidence)
		.where(
			and(
				eq(manualImportEvidence.projectId, input.projectId),
				eq(manualImportEvidence.versionId, input.versionId)
			)
		)
		.orderBy(desc(manualImportEvidence.revision))
		.limit(1);
	return concurrentEvidence &&
		isSameManualImportEvidence(concurrentEvidence, input)
		? {
				kind: "existing",
				evidence: toManualImportEvidence(concurrentEvidence),
			}
		: { kind: "conflict" };
}

function isSameManualImportEvidence(
	row: typeof manualImportEvidence.$inferSelect | undefined,
	input: ManualImportEvidenceInput
): boolean {
	return Boolean(
		row &&
			row.generationPackageId === input.generationPackageId &&
			row.sourceSurface === input.sourceSurface &&
			row.generationInstruction === input.actualInstruction
	);
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
				manualEvidenceRows,
				legacyAttestationRows,
				managedSnapshotRows,
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
				db
					.select()
					.from(manualImportEvidence)
					.where(eq(manualImportEvidence.projectId, projectId))
					.orderBy(
						asc(manualImportEvidence.versionId),
						asc(manualImportEvidence.revision)
					),
				db
					.select({ versionId: legacyAssetAttestations.versionId })
					.from(legacyAssetAttestations)
					.where(eq(legacyAssetAttestations.projectId, projectId))
					.orderBy(asc(legacyAssetAttestations.versionId)),
				db
					.select()
					.from(managedSnapshots)
					.where(eq(managedSnapshots.projectId, projectId))
					.orderBy(
						asc(managedSnapshots.assetVersionId),
						asc(managedSnapshots.createdAt),
						asc(managedSnapshots.id)
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
			const manualEvidenceByVersion = new Map<string, ManualImportEvidence>();
			for (const evidenceRow of manualEvidenceRows) {
				manualEvidenceByVersion.set(
					evidenceRow.versionId,
					toManualImportEvidence(evidenceRow)
				);
			}
			const legacyVersionIds = new Set(
				legacyAttestationRows.map((row) => row.versionId)
			);
			const snapshotsByVersion = new Map<string, ManagedSnapshot[]>();
			for (const snapshotRow of managedSnapshotRows) {
				const snapshots =
					snapshotsByVersion.get(snapshotRow.assetVersionId) ?? [];
				snapshots.push(toManagedSnapshot(snapshotRow));
				snapshotsByVersion.set(snapshotRow.assetVersionId, snapshots);
			}

			return {
				assetVersions: versionRows
					.map(({ version, assetFamilyId }) =>
						assetFamilyId
							? toAssetVersion(
									version,
									assetFamilyId,
									reviewsByVersion.get(version.id) ?? [],
									createVersionProductionEvidence(
										legacyVersionIds.has(version.id)
											? "legacy_asset"
											: version.sourceKind,
										manualEvidenceByVersion.get(version.id) ?? null,
										snapshotsByVersion.get(version.id) ?? []
									)
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

		async saveManualImportEvidence(userId, input) {
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return { kind: "not-found" };
			}
			const [version] = await db
				.select()
				.from(assetVersions)
				.where(
					and(
						eq(assetVersions.projectId, input.projectId),
						eq(assetVersions.assetRecordId, input.assetRecordId),
						eq(assetVersions.id, input.versionId)
					)
				)
				.limit(1);
			if (!version) {
				return { kind: "not-found" };
			}
			if (version.sourceKind !== "manual_import") {
				return { kind: "not-manual-import" };
			}
			const [generationPackage] = await db
				.select({ id: generationPackages.id })
				.from(generationPackages)
				.where(
					and(
						eq(generationPackages.projectId, input.projectId),
						eq(generationPackages.assetRecordId, input.assetRecordId),
						eq(generationPackages.id, input.generationPackageId)
					)
				)
				.limit(1);
			if (!generationPackage) {
				return { kind: "package-not-found" };
			}

			return persistManualImportEvidence(db, userId, input);
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

		async readReviewBlockers(userId, projectId, assetVersionId) {
			if (!(await getProjectForUser(db, userId, projectId))) {
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
			if (!version) {
				return null;
			}
			const approval = await checkReviewApproval(db, userId, version);
			if (approval === true) {
				return [];
			}
			return approval
				? approval.blockers
				: ["Bütünlük veya zorunlu üretim kanıtı eksik."];
		},
		readBatchReviewEvents: (userId, input) =>
			readBatchReviewEvents(db, userId, input),
		async recordBatchReviewEvents(userId, input) {
			if (!(await getProjectForUser(db, userId, input.projectId))) {
				return null;
			}
			if (input.decision === "approved") {
				const results = await Promise.all(
					input.targets.map((target) =>
						this.readReviewBlockers(
							userId,
							input.projectId,
							target.assetVersionId
						)
					)
				);
				if (results.some((blockers) => !blockers || blockers.length > 0)) {
					return null;
				}
			}
			return recordBatchReviewEvents(db, userId, input);
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
			if (input.decision === "approved") {
				const approval = await checkReviewApproval(db, userId, version);
				if (approval !== true) {
					return approval;
				}
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
