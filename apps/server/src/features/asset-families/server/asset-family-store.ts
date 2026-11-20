import type {
	AssetFamilyCatalogScope,
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
import type { Database } from "@sprite-anvil/db";
import { getProjectForUser } from "@sprite-anvil/db";
import {
	assetFamilyCanonicalDesigns,
	assetFamilyRelationships,
} from "@sprite-anvil/db/schema/asset-families";
import {
	assetFamilies,
	assetRecords,
	subjectIdentities,
} from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersionReviewEvents,
	assetVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { and, asc, desc, eq, gt, inArray, isNotNull, or } from "drizzle-orm";

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
	record: Omit<typeof assetFamilies.$inferSelect, "subjectIdentityId"> & {
		subjectIdentityId: string;
	}
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

type AssetRecordCatalogRow = Omit<
	Pick<
		typeof assetRecords.$inferSelect,
		"id" | "projectId" | "assetFamilyId" | "name" | "createdAt"
	>,
	"assetFamilyId"
> & { assetFamilyId: string | null };

function toAssetRecord(
	record: Pick<
		typeof assetRecords.$inferSelect,
		"id" | "projectId" | "assetFamilyId" | "name" | "createdAt"
	>
): AssetRecord {
	return assetRecordSchema.parse({
		id: record.id,
		projectId: record.projectId,
		assetFamilyId: record.assetFamilyId,
		name: record.name,
		createdAt: toISOString(record.createdAt),
	});
}

export function toFamilyAssetRecords(records: AssetRecordCatalogRow[]) {
	return records
		.filter(
			(record): record is AssetRecordCatalogRow & { assetFamilyId: string } =>
				typeof record.assetFamilyId === "string" &&
				record.assetFamilyId.length > 0
		)
		.map(toAssetRecord);
}

function toRelationship(
	record: typeof assetFamilyRelationships.$inferSelect
): AssetFamilyRelationship {
	return assetFamilyRelationshipSchema.parse({
		id: record.id,
		projectId: record.projectId,
		assetFamilyId: record.assetFamilyId,
		sourceAssetRecordId: record.sourceAssetRecordId,
		sourceAssetVersionId: record.sourceAssetVersionId ?? null,
		targetAssetRecordId: record.targetAssetRecordId,
		type: record.type,
		createdAt: toISOString(record.createdAt),
	});
}

async function isApprovedCanonicalSource(
	db: Database,
	input: AssetFamilyRelationshipCreateInput
) {
	if (!input.sourceAssetVersionId) {
		return false;
	}
	const [canonicalDesign] = await db
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
	if (
		!canonicalDesign ||
		canonicalDesign.assetVersionId !== input.sourceAssetVersionId ||
		canonicalDesign.assetRecordId !== input.sourceAssetRecordId
	) {
		return false;
	}
	const [latestReviewEvent] = await db
		.select({ type: assetVersionReviewEvents.decision })
		.from(assetVersionReviewEvents)
		.where(eq(assetVersionReviewEvents.versionId, input.sourceAssetVersionId))
		.orderBy(
			desc(assetVersionReviewEvents.createdAt),
			desc(assetVersionReviewEvents.id)
		)
		.limit(1);
	const [sourceVersion] = await db
		.select({
			id: assetVersions.id,
			contentDigest: assetVersions.contentDigest,
			integrityVerified: assetVersions.integrityVerified,
		})
		.from(assetVersions)
		.where(
			and(
				eq(assetVersions.projectId, input.projectId),
				eq(assetVersions.assetFamilyId, input.assetFamilyId),
				eq(assetVersions.assetRecordId, input.sourceAssetRecordId),
				eq(assetVersions.id, input.sourceAssetVersionId)
			)
		)
		.limit(1);
	return Boolean(
		sourceVersion?.integrityVerified &&
			sourceVersion.contentDigest &&
			latestReviewEvent?.type === "approved"
	);
}

function readIdentities(
	db: Database,
	projectId: string,
	scope?: Extract<AssetFamilyCatalogScope, { kind: "identity-page" }>,
	identityId?: string
) {
	const after = scope?.after;
	const identities = db
		.select()
		.from(subjectIdentities)
		.where(
			and(
				eq(subjectIdentities.projectId, projectId),
				identityId ? eq(subjectIdentities.id, identityId) : undefined,
				after
					? or(
							gt(subjectIdentities.name, after.name),
							and(
								eq(subjectIdentities.name, after.name),
								gt(subjectIdentities.id, after.id)
							)
						)
					: undefined
			)
		)
		.orderBy(asc(subjectIdentities.name), asc(subjectIdentities.id));
	return scope ? identities.limit(scope.limit) : identities;
}

function readFamilyRows(
	db: Database,
	projectId: string,
	scope?: { identityIds: string[] } | { familyId: string }
) {
	return db
		.select()
		.from(assetFamilies)
		.where(
			and(
				eq(assetFamilies.projectId, projectId),
				scope &&
					("identityIds" in scope
						? inArray(assetFamilies.subjectIdentityId, scope.identityIds)
						: eq(assetFamilies.id, scope.familyId))
			)
		)
		.orderBy(asc(assetFamilies.createdAt), asc(assetFamilies.id));
}

async function readScopedFamilyRows(
	db: Database,
	projectId: string,
	scope: AssetFamilyCatalogScope
) {
	if (scope.kind === "family") {
		const families = await readFamilyRows(db, projectId, {
			familyId: scope.familyId,
		});
		const identityId = families[0]?.subjectIdentityId;
		return identityId
			? ([
					await readIdentities(db, projectId, undefined, identityId),
					families,
				] as const)
			: ([[], []] as const);
	}
	const identities = await readIdentities(db, projectId, scope);
	const families = await readFamilyRows(db, projectId, {
		identityIds: identities.map(({ id }) => id),
	});
	return [identities, families] as const;
}

function readFamilyMembers(
	db: Database,
	projectId: string,
	familyIds?: string[]
) {
	return Promise.all([
		db
			.select()
			.from(assetRecords)
			.where(
				and(
					eq(assetRecords.projectId, projectId),
					familyIds
						? inArray(assetRecords.assetFamilyId, familyIds)
						: isNotNull(assetRecords.assetFamilyId)
				)
			)
			.orderBy(asc(assetRecords.name)),
		db
			.select()
			.from(assetFamilyRelationships)
			.where(
				and(
					eq(assetFamilyRelationships.projectId, projectId),
					familyIds
						? inArray(assetFamilyRelationships.assetFamilyId, familyIds)
						: undefined
				)
			)
			.orderBy(asc(assetFamilyRelationships.type)),
	]);
}

export function createAssetFamilyStore(db: Database): AssetFamilyStore {
	return {
		async list(userId, projectId, scope) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}

			const identityAndFamilyRows = scope
				? readScopedFamilyRows(db, projectId, scope)
				: Promise.all([
						readIdentities(db, projectId),
						readFamilyRows(db, projectId),
					]);
			const memberRows = scope
				? identityAndFamilyRows.then(([, families]) =>
						readFamilyMembers(
							db,
							projectId,
							families.map(({ id }) => id)
						)
					)
				: readFamilyMembers(db, projectId);
			const [[identityRows, familyRows], [assetRows, relationshipRows]] =
				await Promise.all([identityAndFamilyRows, memberRows]);

			return assetFamilyCatalogSchema.parse({
				subjectIdentities: identityRows.map(toSubjectIdentityRecord),
				assetFamilies: familyRows.flatMap((family) =>
					family.subjectIdentityId
						? [
								toAssetFamilyRecord({
									...family,
									subjectIdentityId: family.subjectIdentityId,
								}),
							]
						: []
				),
				assetRecords: toFamilyAssetRecords(assetRows),
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
					canonicalVersionId: null,
					createdByUserId: userId,
				})
				.onConflictDoNothing()
				.returning();
			return record?.subjectIdentityId
				? toAssetFamilyRecord({
						...record,
						subjectIdentityId: record.subjectIdentityId,
					})
				: null;
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
					identityCriteria: input.identityCriteria,
					supportLevel: "general",
					availability: "active",
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

			if (
				input.type === "derivative" &&
				!(await isApprovedCanonicalSource(db, input))
			) {
				return null;
			}
			if (input.type !== "derivative" && input.sourceAssetVersionId) {
				return null;
			}

			const [record] = await db
				.insert(assetFamilyRelationships)
				.values({
					id: crypto.randomUUID(),
					projectId: input.projectId,
					assetFamilyId: input.assetFamilyId,
					sourceAssetRecordId: input.sourceAssetRecordId,
					sourceAssetVersionId: input.sourceAssetVersionId ?? null,
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
