import type {
	AssetRecordTrackingStore,
	AssetVersionSummary,
	DerivativeSummary,
} from "@sprite-anvil/api/asset-record-tracking";
import {
	assetFamilySummarySchema,
	assetRecordTrackingDetailSchema,
	assetVersionReviewDispositionSchema,
	assetVersionSummarySchema,
	derivativeSummarySchema,
} from "@sprite-anvil/api/asset-record-tracking";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { legacyAssetAttestations } from "@sprite-anvil/db/schema/asset-production-history";
import { assetRecordDerivatives } from "@sprite-anvil/db/schema/asset-record-derivatives";
import { assetRecordReferences } from "@sprite-anvil/db/schema/asset-record-references";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersionQualityEvidence,
	assetVersionReviewEvents,
	assetVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { project } from "@sprite-anvil/db/schema/project";
import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { toAssetRecord } from "./asset-record-mapper";
import {
	type AssetVersionObjectStorage,
	createAssetVersionWriter,
} from "./asset-version-store";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function hasDatabaseErrorCode(error: unknown, codes: readonly string[]) {
	if (!error || typeof error !== "object") {
		return false;
	}
	const candidate = error as { code?: unknown; cause?: { code?: unknown } };
	return codes.includes(String(candidate.code ?? candidate.cause?.code ?? ""));
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
	const sortedLeft = [...left].sort();
	const sortedRight = [...right].sort();
	return (
		sortedLeft.length === sortedRight.length &&
		sortedLeft.every((value, index) => value === sortedRight[index])
	);
}

function toVersionSummary(
	version: typeof assetVersions.$inferSelect,
	disposition: "candidate" | "approved" | "rejected"
): AssetVersionSummary {
	return assetVersionSummarySchema.parse({
		createdAt: toISOString(version.createdAt),
		fileName: version.fileName,
		id: version.id,
		reviewDisposition: disposition,
		sha256: version.sha256,
		sourceImageHeight: version.sourceImageHeight,
		sourceImageWidth: version.sourceImageWidth,
		versionNumber: version.versionNumber,
	});
}

async function getOwnedAssetRecord(
	db: Database,
	userId: string,
	projectId: string,
	assetRecordId: string
) {
	const ownedProject = await getProjectForUser(db, userId, projectId);
	if (!ownedProject) {
		return null;
	}
	const [record] = await db
		.select({ record: assetRecords })
		.from(assetRecords)
		.innerJoin(project, eq(project.id, assetRecords.projectId))
		.where(
			and(
				eq(assetRecords.id, assetRecordId),
				eq(assetRecords.projectId, projectId),
				eq(project.ownerUserId, userId)
			)
		)
		.limit(1);
	return record?.record ?? null;
}

function hasCompatibleVisualWorld(
	record: typeof assetRecords.$inferSelect,
	visualWorldId: string
) {
	return !record.visualWorldId || record.visualWorldId === visualWorldId;
}

async function getLatestDisposition(
	db: Database,
	projectId: string,
	versionId: string
) {
	const [latestReview] = await db
		.select({ decision: assetVersionReviewEvents.decision })
		.from(assetVersionReviewEvents)
		.where(
			and(
				eq(assetVersionReviewEvents.projectId, projectId),
				eq(assetVersionReviewEvents.versionId, versionId)
			)
		)
		.orderBy(
			desc(assetVersionReviewEvents.createdAt),
			desc(assetVersionReviewEvents.id)
		)
		.limit(1);
	return latestReview
		? assetVersionReviewDispositionSchema.parse(latestReview.decision)
		: ("candidate" as const);
}

type CreateDerivativeInput = Parameters<
	AssetRecordTrackingStore["createDerivative"]
>[1];
type CreateFamilyInput = Parameters<
	AssetRecordTrackingStore["createFamily"]
>[1];

function isSameFamily(
	family: typeof assetFamilies.$inferSelect | undefined,
	input: CreateFamilyInput
): family is typeof assetFamilies.$inferSelect {
	return Boolean(
		family?.id === input.id &&
			family.canonicalVersionId === input.canonicalVersionId &&
			family.name === input.name &&
			family.useContext === input.useContext &&
			family.visualWorldId === input.visualWorldId
	);
}

function toDerivativeSummary(
	derivativeRecord: typeof assetRecords.$inferSelect,
	link: typeof assetRecordDerivatives.$inferSelect
): DerivativeSummary {
	return derivativeSummarySchema.parse({
		assetRecordId: derivativeRecord.id,
		assetRecordName: derivativeRecord.name,
		canonicalVersionId: link.canonicalVersionId,
		dependencyFacets: link.dependencyFacets,
		familyStatus: "matched",
		id: link.id,
	});
}

async function getApprovedFamilyForDerivative(
	db: Database,
	input: CreateDerivativeInput,
	sourceRecord: typeof assetRecords.$inferSelect
) {
	if (!sourceRecord.assetFamilyId) {
		return { ok: false as const, reason: "conflict" as const };
	}
	const [family] = await db
		.select()
		.from(assetFamilies)
		.where(
			and(
				eq(assetFamilies.projectId, input.projectId),
				eq(assetFamilies.id, sourceRecord.assetFamilyId)
			)
		)
		.limit(1);
	const [canonicalVersion] = await db
		.select()
		.from(assetVersions)
		.where(
			and(
				eq(assetVersions.projectId, input.projectId),
				eq(assetVersions.assetRecordId, sourceRecord.id),
				eq(assetVersions.id, input.canonicalVersionId)
			)
		)
		.limit(1);
	if (!(family && canonicalVersion)) {
		return { ok: false as const, reason: "not_found" as const };
	}
	if (
		family.canonicalVersionId !== input.canonicalVersionId ||
		(await getLatestDisposition(
			db,
			input.projectId,
			input.canonicalVersionId
		)) !== "approved"
	) {
		return { ok: false as const, reason: "review_blocked" as const };
	}
	return { family, ok: true as const };
}

async function getExistingDerivative(
	db: Database,
	input: CreateDerivativeInput,
	sourceRecord: typeof assetRecords.$inferSelect,
	derivativeRecord: typeof assetRecords.$inferSelect
) {
	const [existing] = await db
		.select()
		.from(assetRecordDerivatives)
		.where(
			and(
				eq(assetRecordDerivatives.projectId, input.projectId),
				eq(assetRecordDerivatives.sourceAssetRecordId, sourceRecord.id),
				eq(assetRecordDerivatives.derivativeAssetRecordId, derivativeRecord.id)
			)
		)
		.limit(1);
	if (!existing) {
		return null;
	}
	if (
		existing.id !== input.id ||
		existing.canonicalVersionId !== input.canonicalVersionId ||
		!sameStringSet(existing.dependencyFacets, input.dependencyFacets)
	) {
		return { ok: false as const, reason: "conflict" as const };
	}
	return {
		ok: true as const,
		value: toDerivativeSummary(derivativeRecord, existing),
	};
}

async function insertDerivativeLink(
	db: Database,
	userId: string,
	input: CreateDerivativeInput,
	familyId: string,
	sourceRecord: typeof assetRecords.$inferSelect,
	derivativeRecord: typeof assetRecords.$inferSelect
) {
	try {
		const [assignmentRows, linkRows] = await db.batch([
			db
				.update(assetRecords)
				.set({ assetFamilyId: familyId })
				.where(
					and(
						eq(assetRecords.projectId, input.projectId),
						eq(assetRecords.id, derivativeRecord.id),
						or(
							isNull(assetRecords.assetFamilyId),
							eq(assetRecords.assetFamilyId, familyId)
						)
					)
				)
				.returning({ id: assetRecords.id }),
			db
				.insert(assetRecordDerivatives)
				.values({
					id: input.id,
					projectId: input.projectId,
					assetFamilyId: familyId,
					canonicalVersionId: input.canonicalVersionId,
					sourceAssetRecordId: sourceRecord.id,
					derivativeAssetRecordId: derivativeRecord.id,
					dependencyFacets: input.dependencyFacets,
					createdByUserId: userId,
				})
				.returning(),
		]);
		const [assigned] = assignmentRows as { id: string }[];
		const [link] = linkRows as (typeof assetRecordDerivatives.$inferSelect)[];
		if (!(assigned && link)) {
			return { ok: false as const, reason: "conflict" as const };
		}
		return {
			ok: true as const,
			value: toDerivativeSummary(derivativeRecord, link),
		};
	} catch (error) {
		if (!hasDatabaseErrorCode(error, ["23503", "23505"])) {
			throw error;
		}
		const existing = await getExistingDerivative(
			db,
			input,
			sourceRecord,
			derivativeRecord
		);
		return existing ?? { ok: false as const, reason: "conflict" as const };
	}
}

function getCurrentDispositions(
	versions: (typeof assetVersions.$inferSelect)[],
	reviews: (typeof assetVersionReviewEvents.$inferSelect)[]
) {
	const latestByVersion = new Map<
		string,
		typeof assetVersionReviewEvents.$inferSelect
	>();
	for (const review of reviews) {
		if (!latestByVersion.has(review.versionId)) {
			latestByVersion.set(review.versionId, review);
		}
	}
	const orderedApprovedVersions = versions
		.filter(
			(version) => latestByVersion.get(version.id)?.decision === "approved"
		)
		.sort((left, right) => {
			const leftReview = latestByVersion.get(left.id);
			const rightReview = latestByVersion.get(right.id);
			return (
				(rightReview?.createdAt.valueOf() ?? 0) -
					(leftReview?.createdAt.valueOf() ?? 0) ||
				(rightReview?.id.localeCompare(leftReview?.id ?? "") ?? 0)
			);
		});
	const approvedVersionId = orderedApprovedVersions[0]?.id ?? null;
	const dispositions = new Map<string, "candidate" | "approved" | "rejected">();
	for (const version of versions) {
		dispositions.set(
			version.id,
			latestByVersion.get(version.id)?.decision ?? "candidate"
		);
	}
	return { approvedVersionId, dispositions };
}

export function createAssetRecordTrackingStore(
	db: Database,
	storage: AssetVersionObjectStorage | null
): AssetRecordTrackingStore {
	const versionWriter = createAssetVersionWriter(db, storage);
	return {
		async getTracking(userId, projectId, assetRecordId) {
			const record = await getOwnedAssetRecord(
				db,
				userId,
				projectId,
				assetRecordId
			);
			if (!record) {
				return null;
			}

			const [
				versions,
				reviewEvents,
				derivativeRows,
				referenceRows,
				qualityRows,
				historyRows,
				availableRecords,
				availableVersionRows,
				availableReviewRows,
				visualWorldRows,
				familyRows,
			] = await Promise.all([
				db
					.select()
					.from(assetVersions)
					.where(
						and(
							eq(assetVersions.projectId, projectId),
							eq(assetVersions.assetRecordId, assetRecordId)
						)
					)
					.orderBy(asc(assetVersions.versionNumber)),
				db
					.select()
					.from(assetVersionReviewEvents)
					.where(
						and(
							eq(assetVersionReviewEvents.projectId, projectId),
							eq(assetVersionReviewEvents.assetRecordId, assetRecordId)
						)
					)
					.orderBy(
						desc(assetVersionReviewEvents.createdAt),
						desc(assetVersionReviewEvents.id)
					),
				db
					.select({ link: assetRecordDerivatives, derivative: assetRecords })
					.from(assetRecordDerivatives)
					.innerJoin(
						assetRecords,
						eq(assetRecords.id, assetRecordDerivatives.derivativeAssetRecordId)
					)
					.where(
						and(
							eq(assetRecordDerivatives.projectId, projectId),
							eq(assetRecordDerivatives.sourceAssetRecordId, assetRecordId)
						)
					)
					.orderBy(asc(assetRecordDerivatives.createdAt)),
				db
					.select({
						reference: assetRecordReferences,
						version: assetVersions,
						referencedRecord: assetRecords,
					})
					.from(assetRecordReferences)
					.innerJoin(
						assetVersions,
						eq(assetVersions.id, assetRecordReferences.targetVersionId)
					)
					.innerJoin(
						assetRecords,
						eq(assetRecords.id, assetVersions.assetRecordId)
					)
					.where(
						and(
							eq(assetRecordReferences.projectId, projectId),
							eq(assetRecordReferences.assetRecordId, assetRecordId)
						)
					)
					.orderBy(asc(assetRecordReferences.createdAt)),
				db
					.select()
					.from(assetVersionQualityEvidence)
					.where(eq(assetVersionQualityEvidence.projectId, projectId))
					.orderBy(desc(assetVersionQualityEvidence.createdAt)),
				db
					.select({
						attestation: legacyAssetAttestations,
						version: assetVersions,
					})
					.from(legacyAssetAttestations)
					.innerJoin(
						assetVersions,
						eq(assetVersions.id, legacyAssetAttestations.versionId)
					)
					.where(
						and(
							eq(legacyAssetAttestations.projectId, projectId),
							eq(assetVersions.assetRecordId, assetRecordId)
						)
					)
					.orderBy(desc(legacyAssetAttestations.createdAt)),
				db
					.select({
						id: assetRecords.id,
						name: assetRecords.name,
						assetFamilyId: assetRecords.assetFamilyId,
					})
					.from(assetRecords)
					.where(
						and(
							eq(assetRecords.projectId, projectId),
							eq(assetRecords.availability, "active")
						)
					)
					.orderBy(asc(assetRecords.name)),
				db
					.select({ version: assetVersions, record: assetRecords })
					.from(assetVersions)
					.innerJoin(
						assetRecords,
						eq(assetRecords.id, assetVersions.assetRecordId)
					)
					.where(
						and(
							eq(assetVersions.projectId, projectId),
							eq(assetRecords.availability, "active")
						)
					)
					.orderBy(desc(assetVersions.createdAt)),
				db
					.select()
					.from(assetVersionReviewEvents)
					.where(eq(assetVersionReviewEvents.projectId, projectId))
					.orderBy(
						desc(assetVersionReviewEvents.createdAt),
						desc(assetVersionReviewEvents.id)
					),
				db
					.select({ id: visualWorlds.id, name: visualWorlds.name })
					.from(visualWorlds)
					.where(eq(visualWorlds.projectId, projectId))
					.orderBy(asc(visualWorlds.name)),
				record.assetFamilyId
					? db
							.select({ family: assetFamilies, visualWorld: visualWorlds })
							.from(assetFamilies)
							.innerJoin(
								visualWorlds,
								eq(visualWorlds.id, assetFamilies.visualWorldId)
							)
							.where(
								and(
									eq(assetFamilies.projectId, projectId),
									eq(assetFamilies.id, record.assetFamilyId)
								)
							)
							.limit(1)
					: Promise.resolve([]),
			]);

			const { approvedVersionId, dispositions } = getCurrentDispositions(
				versions,
				reviewEvents
			);
			const { dispositions: availableDispositions } = getCurrentDispositions(
				availableVersionRows.map(({ version }) => version),
				availableReviewRows
			);
			const versionSummaries = versions.map((version) =>
				toVersionSummary(version, dispositions.get(version.id) ?? "candidate")
			);
			const approvedVersion =
				versionSummaries.find((version) => version.id === approvedVersionId) ??
				null;
			const qualityVersionIds = new Set(
				qualityRows.map((row) => row.versionId)
			);
			const referenceConflictFeatures = new Set<string>();
			for (const feature of [
				"identity",
				"pose",
				"style",
				"palette",
				"equipment",
				"composition",
				"theme",
			] as const) {
				const allowed = referenceRows.some((row) =>
					row.reference.transferredFeatures.includes(feature)
				);
				const forbidden = referenceRows.some((row) =>
					row.reference.forbiddenFeatures.includes(feature)
				);
				if (allowed && forbidden) {
					referenceConflictFeatures.add(feature);
				}
			}
			const [familyRow] = familyRows;
			const conflictIds = referenceRows.map(
				({ reference, version, referencedRecord }) => ({
					assetRecordName: referencedRecord.name,
					conflictFeatures: [...referenceConflictFeatures].filter(
						(feature) =>
							reference.transferredFeatures.includes(feature) ||
							reference.forbiddenFeatures.includes(feature)
					),
					forbiddenFeatures: reference.forbiddenFeatures,
					id: reference.id,
					notes: reference.notes,
					role: reference.role,
					transferredFeatures: reference.transferredFeatures,
					versionId: version.id,
					versionNumber: version.versionNumber,
				})
			);

			return assetRecordTrackingDetailSchema.parse({
				record: toAssetRecord(record, familyRow?.visualWorld.id ?? null),
				tracking: {
					approvedVersion,
					alternatives: versionSummaries.filter(
						(version) => version.id !== approvedVersionId
					),
					derivatives: derivativeRows.map(({ link, derivative }) => ({
						assetRecordId: derivative.id,
						assetRecordName: derivative.name,
						canonicalVersionId: link.canonicalVersionId,
						dependencyFacets: link.dependencyFacets,
						familyStatus:
							derivative.assetFamilyId === record.assetFamilyId
								? "matched"
								: "unassigned",
						id: link.id,
					})),
					family: familyRow
						? assetFamilySummarySchema.parse({
								canonicalVersionId: familyRow.family.canonicalVersionId,
								id: familyRow.family.id,
								name: familyRow.family.name,
								useContext: familyRow.family.useContext,
								visualWorldId: familyRow.visualWorld.id,
								visualWorldName: familyRow.visualWorld.name,
							})
						: null,
					availableRecords: availableRecords.map((option) => ({ ...option })),
					availableVersions: availableVersionRows.map(
						({ version, record: versionRecord }) => ({
							assetRecordId: versionRecord.id,
							assetRecordName: versionRecord.name,
							fileName: version.fileName,
							id: version.id,
							reviewDisposition:
								availableDispositions.get(version.id) ?? "candidate",
							versionNumber: version.versionNumber,
						})
					),
					productionHistory: historyRows.map(({ attestation, version }) => ({
						createdAt: toISOString(attestation.createdAt),
						historyUnknown: true,
						id: attestation.id,
						kind: "legacy_asset_attestation",
						knownSource: attestation.knownSource,
						supportingEvidence: attestation.supportingEvidence,
						userRelationship: attestation.userRelationship,
						versionNumber: version.versionNumber,
					})),
					quality: {
						integrityStatus:
							versions.length > 0 &&
							versions.every((version) => qualityVersionIds.has(version.id))
								? "format_signature_matched"
								: "unavailable",
						profileStatus: "general_support",
						verifiedVersionCount: versions.filter((version) =>
							qualityVersionIds.has(version.id)
						).length,
					},
					references: conflictIds,
					reviewEvents: reviewEvents.map((review) => ({
						createdAt: toISOString(review.createdAt),
						decision: review.decision,
						id: review.id,
						rationale: review.rationale,
						versionId: review.versionId,
					})),
					visualWorlds: visualWorldRows,
				},
			});
		},

		createVersion(userId, input) {
			return versionWriter.create(userId, input);
		},
		async recordReview(userId, input) {
			const record = await getOwnedAssetRecord(
				db,
				userId,
				input.projectId,
				input.assetRecordId
			);
			if (record?.availability !== "active") {
				return { ok: false, reason: "not_found" };
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
				return { ok: false, reason: "not_found" };
			}
			if (input.decision === "approved") {
				const [quality] = await db
					.select({ id: assetVersionQualityEvidence.id })
					.from(assetVersionQualityEvidence)
					.where(
						and(
							eq(assetVersionQualityEvidence.projectId, input.projectId),
							eq(assetVersionQualityEvidence.versionId, input.versionId),
							eq(assetVersionQualityEvidence.gate, "format_signature"),
							eq(assetVersionQualityEvidence.result, "matched")
						)
					)
					.limit(1);
				if (!quality) {
					return { ok: false, reason: "review_blocked" };
				}
			}
			const [existing] = await db
				.select()
				.from(assetVersionReviewEvents)
				.where(eq(assetVersionReviewEvents.id, input.id))
				.limit(1);
			if (existing) {
				if (
					existing.projectId !== input.projectId ||
					existing.assetRecordId !== input.assetRecordId ||
					existing.versionId !== input.versionId ||
					existing.decision !== input.decision ||
					existing.rationale !== input.rationale ||
					existing.createdByUserId !== userId
				) {
					return { ok: false, reason: "conflict" };
				}
				return {
					ok: true,
					value: {
						createdAt: toISOString(existing.createdAt),
						decision: existing.decision,
						id: existing.id,
						rationale: existing.rationale,
						versionId: existing.versionId,
					},
				};
			}
			const [review] = await db
				.insert(assetVersionReviewEvents)
				.values({
					id: input.id,
					projectId: input.projectId,
					assetRecordId: input.assetRecordId,
					versionId: input.versionId,
					decision: input.decision,
					rationale: input.rationale,
					createdByUserId: userId,
				})
				.onConflictDoNothing()
				.returning();
			if (!review) {
				return { ok: false, reason: "conflict" };
			}
			return {
				ok: true,
				value: {
					createdAt: toISOString(review.createdAt),
					decision: review.decision,
					id: review.id,
					rationale: review.rationale,
					versionId: review.versionId,
				},
			};
		},

		async createFamily(userId, input) {
			const record = await getOwnedAssetRecord(
				db,
				userId,
				input.projectId,
				input.assetRecordId
			);
			if (record?.availability !== "active") {
				return { ok: false, reason: "not_found" };
			}
			const [world] = await db
				.select()
				.from(visualWorlds)
				.where(
					and(
						eq(visualWorlds.projectId, input.projectId),
						eq(visualWorlds.id, input.visualWorldId)
					)
				)
				.limit(1);
			const [canonicalVersion] = await db
				.select()
				.from(assetVersions)
				.where(
					and(
						eq(assetVersions.projectId, input.projectId),
						eq(assetVersions.assetRecordId, input.assetRecordId),
						eq(assetVersions.id, input.canonicalVersionId)
					)
				)
				.limit(1);
			if (!(world && canonicalVersion)) {
				return { ok: false, reason: "not_found" };
			}
			if (!hasCompatibleVisualWorld(record, input.visualWorldId)) {
				return { ok: false, reason: "conflict" };
			}
			if (
				(await getLatestDisposition(
					db,
					input.projectId,
					canonicalVersion.id
				)) !== "approved"
			) {
				return { ok: false, reason: "review_blocked" };
			}
			if (record.assetFamilyId) {
				const [existingFamily] = await db
					.select()
					.from(assetFamilies)
					.where(
						and(
							eq(assetFamilies.projectId, input.projectId),
							eq(assetFamilies.id, record.assetFamilyId)
						)
					)
					.limit(1);
				if (isSameFamily(existingFamily, input)) {
					return {
						ok: true,
						value: {
							canonicalVersionId: input.canonicalVersionId,
							id: existingFamily.id,
							name: existingFamily.name,
							useContext: existingFamily.useContext,
							visualWorldId: world.id,
							visualWorldName: world.name,
						},
					};
				}
				return { ok: false, reason: "conflict" };
			}
			const [nameConflict] = await db
				.select({ id: assetFamilies.id })
				.from(assetFamilies)
				.where(
					and(
						eq(assetFamilies.projectId, input.projectId),
						sql`lower(${assetFamilies.name}) = lower(${input.name})`
					)
				)
				.limit(1);
			if (nameConflict) {
				return { ok: false, reason: "conflict" };
			}
			const [family] = await db
				.insert(assetFamilies)
				.values({
					id: input.id,
					projectId: input.projectId,
					visualWorldId: input.visualWorldId,
					canonicalVersionId: input.canonicalVersionId,
					name: input.name,
					useContext: input.useContext,
					createdByUserId: userId,
				})
				.onConflictDoNothing()
				.returning();
			if (!family) {
				return { ok: false, reason: "conflict" };
			}
			const [assigned] = await db
				.update(assetRecords)
				.set({ assetFamilyId: family.id })
				.where(
					and(
						eq(assetRecords.projectId, input.projectId),
						eq(assetRecords.id, input.assetRecordId),
						isNull(assetRecords.assetFamilyId)
					)
				)
				.returning({ id: assetRecords.id });
			if (!assigned) {
				await db.delete(assetFamilies).where(eq(assetFamilies.id, family.id));
				return { ok: false, reason: "conflict" };
			}
			return {
				ok: true,
				value: {
					canonicalVersionId: family.canonicalVersionId,
					id: family.id,
					name: family.name,
					useContext: family.useContext,
					visualWorldId: world.id,
					visualWorldName: world.name,
				},
			};
		},

		async createDerivative(userId, input) {
			const sourceRecord = await getOwnedAssetRecord(
				db,
				userId,
				input.projectId,
				input.sourceAssetRecordId
			);
			const derivativeRecord = await getOwnedAssetRecord(
				db,
				userId,
				input.projectId,
				input.derivedAssetRecordId
			);
			if (
				!(sourceRecord && derivativeRecord) ||
				sourceRecord.availability !== "active" ||
				derivativeRecord.availability !== "active"
			) {
				return { ok: false, reason: "not_found" };
			}
			if (
				sourceRecord.id === derivativeRecord.id ||
				!sourceRecord.assetFamilyId ||
				(derivativeRecord.assetFamilyId &&
					derivativeRecord.assetFamilyId !== sourceRecord.assetFamilyId)
			) {
				return { ok: false, reason: "conflict" };
			}
			const familyResult = await getApprovedFamilyForDerivative(
				db,
				input,
				sourceRecord
			);
			if (!familyResult.ok) {
				return familyResult;
			}
			if (
				!hasCompatibleVisualWorld(
					derivativeRecord,
					familyResult.family.visualWorldId
				)
			) {
				return { ok: false, reason: "conflict" };
			}
			const existing = await getExistingDerivative(
				db,
				input,
				sourceRecord,
				derivativeRecord
			);
			if (existing) {
				return existing;
			}
			return insertDerivativeLink(
				db,
				userId,
				input,
				familyResult.family.id,
				sourceRecord,
				derivativeRecord
			);
		},
		async createReference(userId, input) {
			const record = await getOwnedAssetRecord(
				db,
				userId,
				input.projectId,
				input.assetRecordId
			);
			if (record?.availability !== "active") {
				return { ok: false, reason: "not_found" };
			}
			const [target] = await db
				.select({ version: assetVersions, record: assetRecords })
				.from(assetVersions)
				.innerJoin(
					assetRecords,
					eq(assetRecords.id, assetVersions.assetRecordId)
				)
				.innerJoin(project, eq(project.id, assetRecords.projectId))
				.where(
					and(
						eq(assetVersions.projectId, input.projectId),
						eq(assetVersions.id, input.targetVersionId),
						eq(project.ownerUserId, userId),
						eq(assetRecords.availability, "active")
					)
				)
				.limit(1);
			if (!target) {
				return { ok: false, reason: "not_found" };
			}
			const [existing] = await db
				.select()
				.from(assetRecordReferences)
				.where(eq(assetRecordReferences.id, input.id))
				.limit(1);
			if (existing) {
				if (
					existing.projectId !== input.projectId ||
					existing.assetRecordId !== input.assetRecordId ||
					existing.targetVersionId !== input.targetVersionId ||
					existing.role !== input.role ||
					existing.notes !== input.notes ||
					existing.createdByUserId !== userId ||
					!sameStringSet(
						existing.transferredFeatures,
						input.transferredFeatures
					) ||
					!sameStringSet(existing.forbiddenFeatures, input.forbiddenFeatures)
				) {
					return { ok: false, reason: "conflict" };
				}
				return {
					ok: true,
					value: {
						assetRecordName: target.record.name,
						conflictFeatures: [],
						forbiddenFeatures:
							existing.forbiddenFeatures as (typeof input.forbiddenFeatures)[number][],
						id: existing.id,
						notes: existing.notes,
						role: existing.role as typeof input.role,
						transferredFeatures:
							existing.transferredFeatures as (typeof input.transferredFeatures)[number][],
						versionId: target.version.id,
						versionNumber: target.version.versionNumber,
					},
				};
			}
			const [reference] = await db
				.insert(assetRecordReferences)
				.values({
					id: input.id,
					projectId: input.projectId,
					assetRecordId: input.assetRecordId,
					targetVersionId: input.targetVersionId,
					role: input.role,
					transferredFeatures: input.transferredFeatures,
					forbiddenFeatures: input.forbiddenFeatures,
					notes: input.notes,
					createdByUserId: userId,
				})
				.onConflictDoNothing()
				.returning();
			if (!reference) {
				return { ok: false, reason: "conflict" };
			}
			return {
				ok: true,
				value: {
					assetRecordName: target.record.name,
					conflictFeatures: [],
					forbiddenFeatures:
						reference.forbiddenFeatures as (typeof input.forbiddenFeatures)[number][],
					id: reference.id,
					notes: reference.notes,
					role: reference.role as typeof input.role,
					transferredFeatures:
						reference.transferredFeatures as (typeof input.transferredFeatures)[number][],
					versionId: target.version.id,
					versionNumber: target.version.versionNumber,
				},
			};
		},
	};
}
