import { isDeepStrictEqual } from "node:util";
import {
	type HistoricalComposition,
	type HistoricalCompositionInput,
	type HistoricalCompositionPinResult,
	historicalCompositionSchema,
} from "@sprite-anvil/api/historical-compositions";
import { specializedProfileContractSchema } from "@sprite-anvil/api/specialized-profile-contracts";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { assetFamilyCanonicalDesigns } from "@sprite-anvil/db/schema/asset-families";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersionReviewEvents,
	assetVersions,
	compositeVersionReviewEvents,
	compositeVersions,
	compositionMemberships,
	unitVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { dependencyLinks } from "@sprite-anvil/db/schema/dependency-revalidation";
import {
	familyReadinessEvidence,
	familyRequiredSetRevisions,
} from "@sprite-anvil/db/schema/family-readiness";
import { historicalCompositionPins } from "@sprite-anvil/db/schema/historical-compositions";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import { specializedProfileContractRevisions } from "@sprite-anvil/db/schema/specialized-profile-contracts";
import { and, asc, eq, inArray } from "drizzle-orm";
import { assessHistoricalComposition } from "./historical-composition-report";

export async function historicalCompositionOptions(
	database: Database,
	userId: string,
	projectId: string
) {
	if (!(await getProjectForUser(database, userId, projectId))) {
		return null;
	}
	const evidence = await database
		.select()
		.from(familyReadinessEvidence)
		.where(eq(familyReadinessEvidence.projectId, projectId))
		.orderBy(
			asc(familyReadinessEvidence.createdAt),
			asc(familyReadinessEvidence.id)
		);
	const contracts = await database
		.select()
		.from(specializedProfileContractRevisions)
		.orderBy(asc(specializedProfileContractRevisions.id));
	return {
		evidence: evidence.map((row) => ({
			id: row.id,
			kind: row.kind,
			result: row.result,
			requirementId: row.ruleId ?? row.testId,
			contextRevisionId: row.contextRevisionId,
			canonicalDesignVersionId: row.canonicalDesignVersionId,
			assetVersionIds: row.assetVersionIds,
			versionTargetId: row.unitVersionId ?? row.compositeVersionId,
			profileContractRevisionIds: row.profileContractRevisionIds,
			createdAt: row.createdAt.toISOString(),
		})),
		contracts: contracts.map((row) => ({
			id: row.id,
			name: specializedProfileContractSchema.parse(row.definition).name,
		})),
	};
}

function readPin(row: typeof historicalCompositionPins.$inferSelect) {
	return historicalCompositionSchema.parse({
		...row.snapshot,
		id: row.id,
		createdAt: row.createdAt.toISOString(),
	});
}

export async function listHistoricalCompositions(
	database: Database,
	userId: string,
	projectId: string
) {
	if (!(await getProjectForUser(database, userId, projectId))) {
		return null;
	}
	const rows = await database
		.select()
		.from(historicalCompositionPins)
		.where(eq(historicalCompositionPins.projectId, projectId))
		.orderBy(
			asc(historicalCompositionPins.createdAt),
			asc(historicalCompositionPins.id)
		);
	return rows.map(readPin);
}

export async function pinHistoricalComposition(
	database: Database,
	userId: string,
	input: HistoricalCompositionInput,
	verifyContent: (versionId: string) => Promise<boolean>
): Promise<HistoricalCompositionPinResult | null> {
	if (!(await getProjectForUser(database, userId, input.projectId))) {
		return null;
	}
	const [existing] = await database
		.select()
		.from(historicalCompositionPins)
		.where(
			and(
				eq(historicalCompositionPins.projectId, input.projectId),
				eq(historicalCompositionPins.idempotencyKey, input.idempotencyKey)
			)
		)
		.limit(1);
	if (existing) {
		const pin = readPin(existing);
		return isDeepStrictEqual(pin.selection, input)
			? { kind: "saved", pin }
			: { kind: "idempotency-conflict" };
	}
	const [composite] = await database
		.select()
		.from(compositeVersions)
		.where(
			and(
				eq(compositeVersions.projectId, input.projectId),
				eq(compositeVersions.id, input.compositeVersionId)
			)
		)
		.limit(1);
	const [context] = await database
		.select()
		.from(contextRevisions)
		.where(
			and(
				eq(contextRevisions.projectId, input.projectId),
				eq(contextRevisions.id, input.contextRevisionId)
			)
		)
		.limit(1);
	const [canonical] = await database
		.select()
		.from(assetFamilyCanonicalDesigns)
		.where(
			and(
				eq(assetFamilyCanonicalDesigns.projectId, input.projectId),
				eq(
					assetFamilyCanonicalDesigns.assetVersionId,
					input.canonicalDesignVersionId
				)
			)
		)
		.limit(1);
	if (!(composite && context && canonical)) {
		return { kind: "invalid-selection" };
	}
	const memberships = await database
		.select()
		.from(compositionMemberships)
		.innerJoin(
			unitVersions,
			eq(compositionMemberships.unitVersionId, unitVersions.id)
		)
		.where(
			and(
				eq(compositionMemberships.projectId, input.projectId),
				eq(compositionMemberships.compositeVersionId, composite.id)
			)
		)
		.orderBy(asc(compositionMemberships.unitKey));
	const versionIds = [
		...new Set([
			input.canonicalDesignVersionId,
			...memberships.map((row) => row.unit_versions.assetVersionId),
			...input.dependencyVersionIds,
		]),
	];
	if (versionIds.length > 256 || memberships.length > 256) {
		return { kind: "invalid-selection" };
	}
	const versions = await database
		.select()
		.from(assetVersions)
		.where(
			and(
				eq(assetVersions.projectId, input.projectId),
				inArray(assetVersions.id, versionIds)
			)
		);
	const links = input.dependencyLinkIds.length
		? await database
				.select()
				.from(dependencyLinks)
				.where(
					and(
						eq(dependencyLinks.projectId, input.projectId),
						inArray(dependencyLinks.id, input.dependencyLinkIds)
					)
				)
		: [];
	const evidence = input.readinessEvidenceIds.length
		? await database
				.select()
				.from(familyReadinessEvidence)
				.where(
					and(
						eq(familyReadinessEvidence.projectId, input.projectId),
						inArray(familyReadinessEvidence.id, input.readinessEvidenceIds)
					)
				)
				.orderBy(
					asc(familyReadinessEvidence.createdAt),
					asc(familyReadinessEvidence.id)
				)
		: [];
	const contracts = input.profileContractRevisionIds.length
		? await database
				.select()
				.from(specializedProfileContractRevisions)
				.where(
					inArray(
						specializedProfileContractRevisions.id,
						input.profileContractRevisionIds
					)
				)
		: [];
	if (
		versions.length !== versionIds.length ||
		links.length !== input.dependencyLinkIds.length ||
		evidence.length !== input.readinessEvidenceIds.length ||
		contracts.length !== input.profileContractRevisionIds.length ||
		versions.some(
			(version) => version.assetFamilyId !== canonical.assetFamilyId
		)
	) {
		return { kind: "invalid-selection" };
	}
	const [family] = await database
		.select()
		.from(assetFamilies)
		.where(
			and(
				eq(assetFamilies.projectId, input.projectId),
				eq(assetFamilies.id, canonical.assetFamilyId)
			)
		)
		.limit(1);
	const records = await database
		.select()
		.from(assetRecords)
		.where(
			and(
				eq(assetRecords.projectId, input.projectId),
				inArray(assetRecords.id, [
					...new Set(versions.map((version) => version.assetRecordId)),
					composite.assetRecordId,
				])
			)
		);
	const allLinks = await database
		.select()
		.from(dependencyLinks)
		.where(
			and(
				eq(dependencyLinks.projectId, input.projectId),
				inArray(dependencyLinks.targetAssetVersionId, versionIds)
			)
		);
	const revisions = await database
		.select()
		.from(familyRequiredSetRevisions)
		.where(
			and(
				eq(familyRequiredSetRevisions.projectId, input.projectId),
				eq(familyRequiredSetRevisions.assetFamilyId, canonical.assetFamilyId)
			)
		);
	const assetReviews = input.reviewEventIds.length
		? await database
				.select()
				.from(assetVersionReviewEvents)
				.where(
					and(
						eq(assetVersionReviewEvents.projectId, input.projectId),
						inArray(assetVersionReviewEvents.id, input.reviewEventIds)
					)
				)
				.orderBy(
					asc(assetVersionReviewEvents.createdAt),
					asc(assetVersionReviewEvents.id)
				)
		: [];
	const compositeReviews = input.reviewEventIds.length
		? await database
				.select()
				.from(compositeVersionReviewEvents)
				.where(
					and(
						eq(compositeVersionReviewEvents.projectId, input.projectId),
						inArray(compositeVersionReviewEvents.id, input.reviewEventIds)
					)
				)
				.orderBy(
					asc(compositeVersionReviewEvents.createdAt),
					asc(compositeVersionReviewEvents.id)
				)
		: [];
	if (
		!family ||
		assetReviews.length + compositeReviews.length !==
			input.reviewEventIds.length ||
		assetReviews.some((review) => !versionIds.includes(review.versionId)) ||
		compositeReviews.some(
			(review) => review.compositeVersionId !== composite.id
		) ||
		links.some((link) => !versionIds.includes(link.targetAssetVersionId)) ||
		contracts.some(
			(contract, index) =>
				contracts.findIndex(
					(candidate) => candidate.profileId === contract.profileId
				) !== index
		) ||
		records.find((record) => record.id === composite.assetRecordId)
			?.assetFamilyId !== family.id
	) {
		return { kind: "invalid-selection" };
	}
	const integrityResults = await Promise.all(
		versions.map(async (version) => ({
			id: version.id,
			verified: version.integrityVerified && (await verifyContent(version.id)),
		}))
	);
	const integrityFailures = integrityResults
		.filter((result) => !result.verified)
		.map((result) => result.id);
	const report = assessHistoricalComposition(input, {
		family,
		records,
		versions,
		links: allLinks,
		selectedLinks: links,
		evidence,
		revisions,
		contracts,
		assetReviews,
		compositeReviews,
		integrityFailures,
		targets: [
			...versions
				.filter(
					(version) =>
						!memberships.some(
							(row) => row.unit_versions.assetVersionId === version.id
						)
				)
				.map((version) => ({
					id: version.id,
					kind: "asset" as const,
					assetRecordId: version.assetRecordId,
					versionIds: [version.id],
				})),
			...memberships.map((row) => ({
				id: row.unit_versions.id,
				kind: "unit" as const,
				assetRecordId: row.unit_versions.assetRecordId,
				versionIds: [row.unit_versions.assetVersionId],
			})),
			{
				id: composite.id,
				kind: "composite",
				assetRecordId: composite.assetRecordId,
				versionIds: [
					...new Set(
						memberships.map((row) => row.unit_versions.assetVersionId)
					),
				],
			},
		],
	});
	const pin: HistoricalComposition = {
		id: crypto.randomUUID(),
		selection: input,
		unitVersionIds: memberships.map((row) => row.unit_versions.id),
		assetVersionIds: versionIds,
		report,
		createdAt: new Date().toISOString(),
	};
	const [saved] = await database
		.insert(historicalCompositionPins)
		.values({
			id: pin.id,
			projectId: input.projectId,
			idempotencyKey: input.idempotencyKey,
			compositeVersionId: composite.id,
			assetRecordId: composite.assetRecordId,
			contextRevisionId: context.id,
			canonicalDesignVersionId: input.canonicalDesignVersionId,
			snapshot: {
				selection: pin.selection,
				unitVersionIds: pin.unitVersionIds,
				assetVersionIds: pin.assetVersionIds,
				report: pin.report,
			},
			createdByUserId: userId,
		})
		.onConflictDoNothing()
		.returning();
	if (saved) {
		return { kind: "saved", pin: readPin(saved) };
	}
	const [concurrentPin] = await database
		.select()
		.from(historicalCompositionPins)
		.where(
			and(
				eq(historicalCompositionPins.projectId, input.projectId),
				eq(historicalCompositionPins.idempotencyKey, input.idempotencyKey)
			)
		)
		.limit(1);
	if (!concurrentPin) {
		throw new Error("Historical composition could not be persisted or reread.");
	}
	const persisted = readPin(concurrentPin);
	return isDeepStrictEqual(persisted.selection, input)
		? { kind: "saved", pin: persisted }
		: { kind: "idempotency-conflict" };
}
