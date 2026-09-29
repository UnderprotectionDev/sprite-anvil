import type {
	FamilyReadiness,
	FamilyReadinessStore,
	ReadinessAssetStatus,
	ReadinessEvaluationItem,
	ReadinessEvidence,
	ReadinessEvidenceInput,
	RequiredSetItem,
	RequiredSetRevision,
} from "@sprite-anvil/api/family-readiness";
import {
	assessGeneralAssetSupport,
	evaluateFamilyReadiness,
	familyReadinessSchema,
	isReadinessEvidenceCurrent,
	readinessEvidenceSchema,
	requiredSetItemSchema,
	requiredSetRevisionSchema,
} from "@sprite-anvil/api/family-readiness";
import type { SpecializedProfileId } from "@sprite-anvil/api/specialized-profile-contracts";
import {
	assessProfileQualityReadiness,
	isProfileQualityEvidenceValid,
	specializedProfileIdSchema,
} from "@sprite-anvil/api/specialized-profile-contracts";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { assetFamilyCanonicalDesigns } from "@sprite-anvil/db/schema/asset-families";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersionReviewEvents,
	assetVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import {
	familyReadinessEvidence,
	familyRequiredSetActivations,
	familyRequiredSetHeads,
	familyRequiredSetRevisions,
} from "@sprite-anvil/db/schema/family-readiness";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
	areContractPinsCompatible,
	type ProfileContractSnapshot,
	type ProjectProfileContracts,
	readProjectProfileContracts,
} from "../../quality-evidence/server/profile-contract-scope";

const requiredSetItemsSchema = requiredSetItemSchema.array().max(100);

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function toRevision(
	row: typeof familyRequiredSetRevisions.$inferSelect,
	activeRevisionId: string | null,
	activatedRevisionIds: Set<string>
): RequiredSetRevision {
	return requiredSetRevisionSchema.parse({
		id: row.id,
		projectId: row.projectId,
		assetFamilyId: row.assetFamilyId,
		revisionNumber: row.revisionNumber,
		items: requiredSetItemsSchema.parse(row.items),
		createdByUserId: row.createdByUserId,
		createdAt: toISOString(row.createdAt),
		isActive: row.id === activeRevisionId,
		wasActivated: activatedRevisionIds.has(row.id),
	});
}

function toEvidence(
	row: typeof familyReadinessEvidence.$inferSelect,
	isCurrent: boolean
): ReadinessEvidence {
	return readinessEvidenceSchema.parse({
		id: row.id,
		projectId: row.projectId,
		assetFamilyId: row.assetFamilyId,
		revisionId: row.revisionId,
		itemId: row.itemId,
		kind: row.kind,
		result: row.result,
		assetVersionIds: row.assetVersionIds,
		profileContractRevisionIds: row.profileContractRevisionIds,
		contextRevisionId: row.contextRevisionId,
		visualWorldId: row.visualWorldId,
		useContext: row.useContext,
		canonicalDesignVersionId: row.canonicalDesignVersionId,
		ruleId: row.ruleId,
		ruleClass: row.ruleClass,
		testId: row.testId,
		observedValue: row.observedValue,
		method: row.method,
		rationale: row.rationale,
		createdByUserId: row.createdByUserId,
		createdAt: toISOString(row.createdAt),
		isCurrent,
	});
}

function evidenceMatchesCurrentScope(
	evidence: typeof familyReadinessEvidence.$inferSelect,
	input: {
		assetVersionIds: string[];
		profileContractRevisionIds: (string | null)[];
		profileIds: (SpecializedProfileId | null)[];
		contextRevisionId: string | null;
		visualWorldId: string;
		useContext: string;
		canonicalDesignVersionId: string | null;
		contracts: ProjectProfileContracts;
	}
) {
	const scopeMatches = isReadinessEvidenceCurrent(evidence, input, {
		profileContractsMatter: false,
	});
	if (!scopeMatches || evidence.kind === "applicability") {
		return scopeMatches;
	}
	const entryId =
		evidence.kind === "quality" ? evidence.ruleId : evidence.testId;
	return (
		entryId !== null &&
		areContractPinsCompatible({
			activeRevisionIds: input.profileContractRevisionIds,
			contracts: input.contracts,
			entryId,
			kind: evidence.kind,
			pinnedRevisionIds: evidence.profileContractRevisionIds,
			profileIds: input.profileIds,
		})
	);
}

type EvidenceRow = typeof familyReadinessEvidence.$inferSelect;
interface CurrentEvidence {
	isCurrent: boolean;
	row: EvidenceRow;
}
type AssessedRuleResult = "passed" | "failed" | "inconclusive" | "waived";

function qualityEvidenceResult(
	entry: CurrentEvidence | undefined
): AssessedRuleResult | "not_assessed" {
	const result = entry?.row.result;
	return result === "passed" ||
		result === "failed" ||
		result === "inconclusive" ||
		result === "waived"
		? result
		: "not_assessed";
}

function usageEvidenceResult(
	entry: CurrentEvidence | undefined
): "passed" | "failed" | "inconclusive" | "not_assessed" {
	const result = entry?.row.result;
	return result === "passed" || result === "failed" || result === "inconclusive"
		? result
		: "not_assessed";
}

type EvaluatedItem = FamilyReadiness["items"][number] & {
	evaluation: ReadinessEvaluationItem;
};

type QualityRequirement =
	FamilyReadiness["items"][number]["qualityRequirements"][number];
type UsageRequirement =
	FamilyReadiness["items"][number]["usageRequirements"][number];

function latestEvidenceByItem(
	items: RequiredSetItem[],
	evidenceRows: EvidenceRow[],
	currentVersions: Map<string, typeof assetVersions.$inferSelect>,
	contextRevisionId: string | null,
	family: typeof assetFamilies.$inferSelect,
	canonicalDesignVersionId: string | null,
	assetRecordsById: Map<string, typeof assetRecords.$inferSelect>,
	contracts: ProjectProfileContracts
) {
	const result = new Map<string, CurrentEvidence[]>();
	for (const item of items) {
		const expectedVersionIds = item.assetRecordIds.flatMap((recordId) => {
			const version = currentVersions.get(recordId);
			return version ? [version.id] : [];
		});
		const profiles = item.assetRecordIds.map((recordId) => {
			const category = assetRecordsById.get(recordId)?.assetCategory;
			const parsed = specializedProfileIdSchema.safeParse(category);
			return parsed.success ? parsed.data : null;
		});
		const expectedProfileContractRevisionIds = profiles.map((profileId) =>
			profileId
				? (contracts.activeByProfile.get(profileId)?.revisionId ?? null)
				: null
		);
		const latestByKind = new Map<string, EvidenceRow>();
		for (const evidence of evidenceRows) {
			let evidenceKey: string = evidence.kind;
			if (evidence.kind === "quality") {
				evidenceKey = `quality:${evidence.ruleId ?? ""}`;
			} else if (evidence.kind === "usage_test") {
				evidenceKey = `usage_test:${evidence.testId ?? ""}`;
			}
			if (evidence.itemId === item.id && !latestByKind.has(evidenceKey)) {
				latestByKind.set(evidenceKey, evidence);
			}
		}
		result.set(
			item.id,
			[...latestByKind.values()].map((row) => ({
				row,
				isCurrent: evidenceMatchesCurrentScope(row, {
					assetVersionIds: expectedVersionIds,
					profileContractRevisionIds: expectedProfileContractRevisionIds,
					profileIds: profiles,
					contextRevisionId,
					visualWorldId: family.visualWorldId,
					useContext: family.useContext,
					canonicalDesignVersionId,
					contracts,
				}),
			}))
		);
	}
	return result;
}

function collectFamilyUsageEvidence(
	allEvidenceByItem: Map<string, CurrentEvidence[]>,
	activeItems: RequiredSetItem[]
) {
	const usageItemIds = new Set(
		activeItems
			.filter((item) => item.kind === "usage_test")
			.map((item) => item.id)
	);
	return [...usageItemIds].flatMap(
		(itemId) => allEvidenceByItem.get(itemId) ?? []
	);
}

function latestUsageEvidence(
	evidence: CurrentEvidence[],
	testId: string,
	targetVersionId: string
) {
	return evidence
		.filter(
			(entry) =>
				entry.row.kind === "usage_test" &&
				entry.row.testId === testId &&
				entry.row.assetVersionIds.includes(targetVersionId)
		)
		.sort(
			(left, right) =>
				new Date(right.row.createdAt).getTime() -
				new Date(left.row.createdAt).getTime()
		)[0];
}

function assessGeneralAssetSupportEvidence(evidence: CurrentEvidence[]) {
	const row = evidence.find(
		(entry) =>
			entry.row.kind === "quality" &&
			entry.row.ruleId === "general.asset_support"
	);
	return assessGeneralAssetSupport({
		isCurrent: Boolean(row?.isCurrent),
		result: qualityEvidenceResult(row),
	});
}

function assessSpecializedProfile(
	contract: ProfileContractSnapshot,
	version: typeof assetVersions.$inferSelect,
	currentEvidence: CurrentEvidence[],
	familyUsageEvidence: CurrentEvidence[]
): {
	profileUsageTestsComplete: boolean;
	qualityReadiness: ReadinessAssetStatus["qualityReadiness"];
	qualityRequirements: QualityRequirement[];
	usageRequirements: UsageRequirement[];
} {
	const ruleResults = new Map<
		string,
		"passed" | "failed" | "inconclusive" | "waived"
	>();
	const qualityRequirements: QualityRequirement[] = contract.contract.rules.map(
		(rule) => {
			const row = currentEvidence.find(
				(entry) => entry.row.kind === "quality" && entry.row.ruleId === rule.id
			);
			const result = qualityEvidenceResult(row);
			if (result !== "not_assessed") {
				ruleResults.set(rule.id, result);
			}
			return {
				id: rule.id,
				name: rule.name,
				class: rule.class,
				required: rule.required,
				waiverEligible: rule.waiverEligible,
				result,
				isCurrent: Boolean(row?.isCurrent),
			};
		}
	);
	let profileUsageTestsComplete = true;
	const usageTestResults = new Map<
		string,
		"passed" | "failed" | "inconclusive" | "waived"
	>();
	const usageRequirements: UsageRequirement[] =
		contract.contract.usageTests.map((usageTest) => {
			const evidenceEntry = latestUsageEvidence(
				familyUsageEvidence,
				usageTest.id,
				version.id
			);
			const result = evidenceEntry?.isCurrent
				? usageEvidenceResult(evidenceEntry)
				: "not_assessed";
			if (result !== "not_assessed") {
				usageTestResults.set(usageTest.id, result);
			}
			if (usageTest.required && result !== "passed") {
				profileUsageTestsComplete = false;
			}
			return {
				id: usageTest.id,
				name: usageTest.name,
				required: usageTest.required,
				result,
				isCurrent: Boolean(evidenceEntry?.isCurrent),
			};
		});
	return {
		profileUsageTestsComplete,
		qualityReadiness: assessProfileQualityReadiness(
			contract.contract,
			ruleResults,
			usageTestResults
		).status,
		qualityRequirements,
		usageRequirements,
	};
}

function getProfileContractUsageTestStatus(
	item: RequiredSetItem,
	profileIds: (SpecializedProfileId | null)[],
	activeContracts: (ProfileContractSnapshot | null)[]
) {
	if (item.kind !== "usage_test") {
		return;
	}
	return activeContracts.every((contract, index) => {
		const profileId = profileIds[index];
		if (!profileId) {
			return true;
		}
		return Boolean(
			contract?.contract.usageTests.some((test) => test.id === item.testId)
		);
	});
}

function evaluateRequiredSetItem(
	item: RequiredSetItem,
	activeRevisionId: string,
	currentVersions: Map<string, typeof assetVersions.$inferSelect>,
	latestReviews: Map<string, typeof assetVersionReviewEvents.$inferSelect>,
	evidence: CurrentEvidence[],
	allEvidenceByItem: Map<string, CurrentEvidence[]>,
	activeItems: RequiredSetItem[],
	assetRecordsById: Map<string, typeof assetRecords.$inferSelect>,
	contracts: ProjectProfileContracts
): EvaluatedItem {
	const itemVersions = item.assetRecordIds.flatMap((recordId) => {
		const version = currentVersions.get(recordId);
		return version ? [version] : [];
	});
	const currentEvidence = evidence.filter((entry) => entry.isCurrent);
	const applicabilityEvidence = currentEvidence.find(
		(entry) => entry.row.kind === "applicability"
	);
	const applicabilityIsCurrent = Boolean(
		applicabilityEvidence?.row.result === "applicable"
	);
	const [version] = itemVersions;
	const profileIds = item.assetRecordIds.map((assetRecordId) => {
		const category = assetRecordsById.get(assetRecordId)?.assetCategory;
		const parsedProfileId = specializedProfileIdSchema.safeParse(category);
		return parsedProfileId.success ? parsedProfileId.data : null;
	});
	const [profileId] = profileIds;
	const profileContract = profileId
		? contracts.activeByProfile.get(profileId)
		: null;
	const activeContracts = profileIds.map((linkedProfileId) =>
		linkedProfileId
			? (contracts.activeByProfile.get(linkedProfileId) ?? null)
			: null
	);
	const profileContractActive = activeContracts.every(
		(contract, index) => !profileIds[index] || Boolean(contract)
	);
	const familyUsageEvidence = collectFamilyUsageEvidence(
		allEvidenceByItem,
		activeItems
	);
	const qualityRequirements: FamilyReadiness["items"][number]["qualityRequirements"] =
		[];
	const usageRequirements: FamilyReadiness["items"][number]["usageRequirements"] =
		[];
	let qualityReadiness: ReadinessAssetStatus["qualityReadiness"] =
		"not_assessed";
	let profileUsageTestsComplete = true;
	if (item.kind !== "usage_test" && version) {
		if (!profileId) {
			const {
				qualityReadiness: generalQualityReadiness,
				qualityRequirements: generalQualityRequirements,
			} = assessGeneralAssetSupportEvidence(currentEvidence);
			qualityReadiness = generalQualityReadiness;
			qualityRequirements.push(...generalQualityRequirements);
		} else if (profileContract) {
			const {
				profileUsageTestsComplete: allProfileUsageTestsComplete,
				qualityReadiness: specializedQualityReadiness,
				qualityRequirements: specializedQualityRequirements,
				usageRequirements: specializedUsageRequirements,
			} = assessSpecializedProfile(
				profileContract,
				version,
				currentEvidence,
				familyUsageEvidence
			);
			qualityReadiness = specializedQualityReadiness;
			qualityRequirements.push(...specializedQualityRequirements);
			usageRequirements.push(...specializedUsageRequirements);
			profileUsageTestsComplete = allProfileUsageTestsComplete;
		}
	}
	const assetStatus: ReadinessAssetStatus | null =
		item.kind !== "usage_test" && version
			? {
					applicability: applicabilityIsCurrent ? "applicable" : "not_assessed",
					integrityVerified: Boolean(
						version.integrityVerified && version.contentDigest
					),
					qualityReadiness,
					reviewDisposition:
						latestReviews.get(version.id)?.decision ?? "candidate",
				}
			: null;
	const usageEvidence = currentEvidence.find(
		(entry) =>
			entry.row.kind === "usage_test" && entry.row.testId === item.testId
	);
	const usageTestStatus = usageEvidenceResult(usageEvidence);
	const evaluation: ReadinessEvaluationItem = {
		id: item.id,
		kind: item.kind,
		disposition: item.disposition,
		asset: assetStatus,
		profileContractActive,
		profileContractUsageTest: getProfileContractUsageTestStatus(
			item,
			profileIds,
			activeContracts
		),
		profileUsageTestsComplete:
			item.kind !== "usage_test" && profileId && profileContract
				? profileUsageTestsComplete
				: undefined,
		usageTestStatus,
	};
	const [assessment] = evaluateFamilyReadiness({
		activeRequiredSetRevisionId: activeRevisionId,
		items: [evaluation],
	}).items;
	return {
		item,
		status: assessment?.status ?? "incomplete",
		blockers: assessment?.blockers ?? [],
		currentAssetVersionIds: itemVersions.map((current) => current.id),
		qualityReadiness,
		qualityRequirements,
		usageRequirements,
		latestEvidence: evidence.map((entry) =>
			toEvidence(entry.row, entry.isCurrent)
		),
		evaluation,
	};
}

async function readActiveRevisionReadiness(
	db: Database,
	projectId: string,
	family: typeof assetFamilies.$inferSelect,
	activeRevision: RequiredSetRevision
) {
	const assetRecordIds = [
		...new Set(activeRevision.items.flatMap((item) => item.assetRecordIds)),
	];
	const [versionRows, contextRows, canonicalRows, assetRecordRows, contracts] =
		await Promise.all([
			assetRecordIds.length > 0
				? db
						.select()
						.from(assetVersions)
						.where(
							and(
								eq(assetVersions.projectId, projectId),
								eq(assetVersions.assetFamilyId, family.id),
								inArray(assetVersions.assetRecordId, assetRecordIds)
							)
						)
						.orderBy(
							desc(assetVersions.versionNumber),
							desc(assetVersions.createdAt)
						)
				: Promise.resolve([]),
			db
				.select()
				.from(contextRevisions)
				.where(
					and(
						eq(contextRevisions.projectId, projectId),
						or(
							eq(contextRevisions.state, "active"),
							eq(contextRevisions.revisionNumber, 0)
						)
					)
				)
				.orderBy(desc(contextRevisions.revisionNumber))
				.limit(1),
			db
				.select()
				.from(assetFamilyCanonicalDesigns)
				.where(
					and(
						eq(assetFamilyCanonicalDesigns.projectId, projectId),
						eq(assetFamilyCanonicalDesigns.assetFamilyId, family.id)
					)
				)
				.orderBy(
					desc(assetFamilyCanonicalDesigns.createdAt),
					desc(assetFamilyCanonicalDesigns.id)
				)
				.limit(1),
			assetRecordIds.length > 0
				? db
						.select()
						.from(assetRecords)
						.where(
							and(
								eq(assetRecords.projectId, projectId),
								eq(assetRecords.assetFamilyId, family.id),
								inArray(assetRecords.id, assetRecordIds)
							)
						)
				: Promise.resolve([]),
			readProjectProfileContracts(db, projectId),
		]);
	const assetRecordsById = new Map(
		assetRecordRows.map((record) => [record.id, record])
	);
	const currentVersions = new Map<string, (typeof versionRows)[number]>();
	for (const version of versionRows) {
		if (!currentVersions.has(version.assetRecordId)) {
			currentVersions.set(version.assetRecordId, version);
		}
	}
	const currentVersionIds = [...currentVersions.values()].map(
		(version) => version.id
	);
	const [reviewRows, evidenceRows] = await Promise.all([
		currentVersionIds.length > 0
			? db
					.select()
					.from(assetVersionReviewEvents)
					.where(inArray(assetVersionReviewEvents.versionId, currentVersionIds))
					.orderBy(
						desc(assetVersionReviewEvents.createdAt),
						desc(assetVersionReviewEvents.id)
					)
			: Promise.resolve([]),
		db
			.select()
			.from(familyReadinessEvidence)
			.where(
				and(
					eq(familyReadinessEvidence.projectId, projectId),
					eq(familyReadinessEvidence.assetFamilyId, family.id),
					eq(familyReadinessEvidence.revisionId, activeRevision.id)
				)
			)
			.orderBy(
				desc(familyReadinessEvidence.createdAt),
				desc(familyReadinessEvidence.id)
			),
	]);
	const latestReviews = new Map<string, (typeof reviewRows)[number]>();
	for (const review of reviewRows) {
		if (!latestReviews.has(review.versionId)) {
			latestReviews.set(review.versionId, review);
		}
	}
	const currentEvidence = latestEvidenceByItem(
		activeRevision.items,
		evidenceRows,
		currentVersions,
		contextRows[0]?.id ?? null,
		family,
		canonicalRows[0]?.assetVersionId ?? null,
		assetRecordsById,
		contracts
	);
	const items = activeRevision.items.map((item) =>
		evaluateRequiredSetItem(
			item,
			activeRevision.id,
			currentVersions,
			latestReviews,
			currentEvidence.get(item.id) ?? [],
			currentEvidence,
			activeRevision.items,
			assetRecordsById,
			contracts
		)
	);
	return {
		status: items.every((item) => item.status === "complete")
			? ("complete" as const)
			: ("incomplete" as const),
		items,
	};
}

interface EvidenceScope {
	assetVersionIds: string[];
	canonicalDesignVersionId: string | null;
	contextRevisionId: string | null;
	family: typeof assetFamilies.$inferSelect;
	profileContractRevisionIds: (string | null)[];
	profileIds: (SpecializedProfileId | null)[];
	ruleClass:
		| "integrity_gate"
		| "waivable_requirement"
		| "quality_advisory"
		| "human_review"
		| null;
}

async function readEvidenceScopeContext(
	db: Database,
	input: ReadinessEvidenceInput,
	item: RequiredSetItem
) {
	const [
		familyRows,
		contextRows,
		canonicalRows,
		versionRows,
		assetRecordRows,
		contracts,
	] = await Promise.all([
		db
			.select()
			.from(assetFamilies)
			.where(
				and(
					eq(assetFamilies.projectId, input.projectId),
					eq(assetFamilies.id, input.assetFamilyId)
				)
			)
			.limit(1),
		db
			.select({ id: contextRevisions.id })
			.from(contextRevisions)
			.where(
				and(
					eq(contextRevisions.projectId, input.projectId),
					or(
						eq(contextRevisions.state, "active"),
						eq(contextRevisions.revisionNumber, 0)
					)
				)
			)
			.orderBy(desc(contextRevisions.revisionNumber))
			.limit(1),
		db
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
			.limit(1),
		db
			.select()
			.from(assetVersions)
			.where(
				and(
					eq(assetVersions.projectId, input.projectId),
					eq(assetVersions.assetFamilyId, input.assetFamilyId),
					inArray(assetVersions.assetRecordId, item.assetRecordIds)
				)
			)
			.orderBy(
				desc(assetVersions.versionNumber),
				desc(assetVersions.createdAt)
			),
		db
			.select()
			.from(assetRecords)
			.where(
				and(
					eq(assetRecords.projectId, input.projectId),
					eq(assetRecords.assetFamilyId, input.assetFamilyId),
					inArray(assetRecords.id, item.assetRecordIds)
				)
			),
		readProjectProfileContracts(db, input.projectId),
	]);
	const [family] = familyRows;
	return {
		family: family ?? null,
		contextRevisionId: contextRows[0]?.id ?? null,
		canonicalDesignVersionId: canonicalRows[0]?.assetVersionId ?? null,
		versionRows,
		assetRecordRows,
		contracts,
	};
}

function indexCurrentVersions(versions: (typeof assetVersions.$inferSelect)[]) {
	const currentVersions = new Map<string, typeof assetVersions.$inferSelect>();
	for (const version of versions) {
		if (!currentVersions.has(version.assetRecordId)) {
			currentVersions.set(version.assetRecordId, version);
		}
	}
	return currentVersions;
}

function resolveQualityRuleClass(
	input: ReadinessEvidenceInput,
	item: RequiredSetItem,
	profileIds: (SpecializedProfileId | null)[],
	activeContracts: (ProfileContractSnapshot | null)[]
): { isValid: boolean; ruleClass: EvidenceScope["ruleClass"] } {
	if (input.kind !== "quality") {
		return { isValid: true, ruleClass: null };
	}
	if (item.assetRecordIds.length !== 1) {
		return { isValid: false, ruleClass: null };
	}
	const [profileId] = profileIds;
	const [contract] = activeContracts;
	if (!profileId) {
		const isValid =
			input.ruleId === "general.asset_support" && input.result !== "waived";
		return { isValid, ruleClass: null };
	}
	const rule = contract?.contract.rules.find(
		(candidate) => candidate.id === input.ruleId
	);
	const isValid = Boolean(
		rule &&
			isProfileQualityEvidenceValid({
				rule,
				result: input.result,
				observedValue: input.observedValue,
			})
	);
	return {
		isValid,
		ruleClass: isValid ? (rule?.class ?? null) : null,
	};
}

function isUsageTestSupported(
	input: ReadinessEvidenceInput,
	profileIds: (SpecializedProfileId | null)[],
	activeContracts: (ProfileContractSnapshot | null)[]
) {
	if (input.kind !== "usage_test") {
		return true;
	}
	return activeContracts.every((contract, index) => {
		const profileId = profileIds[index];
		return (
			!profileId ||
			Boolean(
				contract?.contract.usageTests.some((test) => test.id === input.testId)
			)
		);
	});
}

async function readEvidenceItem(
	db: Database,
	userId: string,
	input: ReadinessEvidenceInput
): Promise<RequiredSetItem | null> {
	if (!(await getProjectForUser(db, userId, input.projectId))) {
		return null;
	}
	const [head] = await db
		.select({ activeRevisionId: familyRequiredSetHeads.activeRevisionId })
		.from(familyRequiredSetHeads)
		.where(
			and(
				eq(familyRequiredSetHeads.projectId, input.projectId),
				eq(familyRequiredSetHeads.assetFamilyId, input.assetFamilyId)
			)
		)
		.limit(1);
	if (head?.activeRevisionId !== input.revisionId) {
		return null;
	}
	const [revision] = await db
		.select()
		.from(familyRequiredSetRevisions)
		.where(
			and(
				eq(familyRequiredSetRevisions.projectId, input.projectId),
				eq(familyRequiredSetRevisions.assetFamilyId, input.assetFamilyId),
				eq(familyRequiredSetRevisions.id, input.revisionId)
			)
		)
		.limit(1);
	if (!revision) {
		return null;
	}
	const items = requiredSetItemsSchema.parse(revision.items);
	const item = items.find((entry) => entry.id === input.itemId);
	if (!item || item.assetRecordIds.length === 0) {
		return null;
	}
	if (
		(input.kind === "usage_test" && item.kind !== "usage_test") ||
		(input.kind !== "usage_test" && item.kind === "usage_test")
	) {
		return null;
	}
	if (
		input.kind === "usage_test" &&
		(input.testId !== item.testId || item.assetRecordIds.length === 0)
	) {
		return null;
	}
	return item;
}

async function readEvidenceScope(
	db: Database,
	input: ReadinessEvidenceInput,
	item: RequiredSetItem
): Promise<EvidenceScope | null> {
	const context = await readEvidenceScopeContext(db, input, item);
	if (!(context.family && context.contextRevisionId)) {
		return null;
	}
	const currentVersions = indexCurrentVersions(context.versionRows);
	const versions = item.assetRecordIds.flatMap((recordId) => {
		const version = currentVersions.get(recordId);
		return version ? [version.id] : [];
	});
	if (versions.length !== item.assetRecordIds.length) {
		return null;
	}
	const recordsById = new Map(
		context.assetRecordRows.map((record) => [record.id, record])
	);
	if (recordsById.size !== item.assetRecordIds.length) {
		return null;
	}
	const profileIds = item.assetRecordIds.map((recordId) => {
		const parsed = specializedProfileIdSchema.safeParse(
			recordsById.get(recordId)?.assetCategory
		);
		return parsed.success ? parsed.data : null;
	});
	const activeContracts = profileIds.map((profileId) =>
		profileId
			? (context.contracts.activeByProfile.get(profileId) ?? null)
			: null
	);
	const qualityRule = resolveQualityRuleClass(
		input,
		item,
		profileIds,
		activeContracts
	);
	if (
		!(
			qualityRule.isValid &&
			isUsageTestSupported(input, profileIds, activeContracts)
		)
	) {
		return null;
	}
	return {
		family: context.family,
		contextRevisionId: context.contextRevisionId,
		canonicalDesignVersionId: context.canonicalDesignVersionId,
		assetVersionIds: versions,
		profileContractRevisionIds: profileIds.map((profileId, index) =>
			profileId ? (activeContracts[index]?.revisionId ?? null) : null
		),
		profileIds,
		ruleClass: qualityRule.ruleClass,
	};
}

export function createFamilyReadinessStore(db: Database): FamilyReadinessStore {
	async function list(
		userId: string,
		projectId: string,
		assetFamilyId: string
	) {
		if (!(await getProjectForUser(db, userId, projectId))) {
			return null;
		}
		const [familyRows, revisionRows, headRows, activationRows] =
			await Promise.all([
				db
					.select()
					.from(assetFamilies)
					.where(
						and(
							eq(assetFamilies.projectId, projectId),
							eq(assetFamilies.id, assetFamilyId)
						)
					)
					.limit(1),
				db
					.select()
					.from(familyRequiredSetRevisions)
					.where(
						and(
							eq(familyRequiredSetRevisions.projectId, projectId),
							eq(familyRequiredSetRevisions.assetFamilyId, assetFamilyId)
						)
					)
					.orderBy(asc(familyRequiredSetRevisions.revisionNumber)),
				db
					.select()
					.from(familyRequiredSetHeads)
					.where(
						and(
							eq(familyRequiredSetHeads.projectId, projectId),
							eq(familyRequiredSetHeads.assetFamilyId, assetFamilyId)
						)
					)
					.limit(1),
				db
					.select({ revisionId: familyRequiredSetActivations.revisionId })
					.from(familyRequiredSetActivations)
					.where(
						and(
							eq(familyRequiredSetActivations.projectId, projectId),
							eq(familyRequiredSetActivations.assetFamilyId, assetFamilyId)
						)
					),
			]);
		const [family] = familyRows;
		if (!family) {
			return null;
		}
		const activeRevisionId = headRows[0]?.activeRevisionId ?? null;
		const activatedRevisionIds = new Set(
			activationRows.map((activation) => activation.revisionId)
		);
		const revisions = revisionRows.map((row) =>
			toRevision(row, activeRevisionId, activatedRevisionIds)
		);
		const activeRevision =
			revisions.find((revision) => revision.id === activeRevisionId) ?? null;
		if (!activeRevision) {
			return familyReadinessSchema.parse({
				projectId,
				assetFamilyId,
				status: "not_configured",
				activeRevision: null,
				revisions,
				items: [],
			});
		}
		const readiness = await readActiveRevisionReadiness(
			db,
			projectId,
			family,
			activeRevision
		);
		return familyReadinessSchema.parse({
			projectId,
			assetFamilyId,
			status: readiness.status,
			activeRevision,
			revisions,
			items: readiness.items.map(
				({ evaluation: _evaluation, ...item }) => item
			),
		});
	}

	async function saveDraft(
		userId: string,
		input: Parameters<FamilyReadinessStore["saveDraft"]>[1]
	) {
		if (!(await getProjectForUser(db, userId, input.projectId))) {
			return null;
		}
		const [family] = await db
			.select({ id: assetFamilies.id })
			.from(assetFamilies)
			.where(
				and(
					eq(assetFamilies.projectId, input.projectId),
					eq(assetFamilies.id, input.assetFamilyId)
				)
			)
			.limit(1);
		if (!family) {
			return null;
		}
		const referencedAssetRecordIds = [
			...new Set(input.items.flatMap((item) => item.assetRecordIds)),
		];
		if (referencedAssetRecordIds.length > 0) {
			const rows = await db
				.select({ id: assetRecords.id })
				.from(assetRecords)
				.where(
					and(
						eq(assetRecords.projectId, input.projectId),
						eq(assetRecords.assetFamilyId, input.assetFamilyId),
						inArray(assetRecords.id, referencedAssetRecordIds)
					)
				);
			if (rows.length !== referencedAssetRecordIds.length) {
				return null;
			}
		}
		const [latestRevision] = await db
			.select({ revisionNumber: familyRequiredSetRevisions.revisionNumber })
			.from(familyRequiredSetRevisions)
			.where(
				and(
					eq(familyRequiredSetRevisions.projectId, input.projectId),
					eq(familyRequiredSetRevisions.assetFamilyId, input.assetFamilyId)
				)
			)
			.orderBy(desc(familyRequiredSetRevisions.revisionNumber))
			.limit(1);
		const now = new Date();
		const id = crypto.randomUUID();
		const [revision] = await db
			.insert(familyRequiredSetRevisions)
			.values({
				id,
				projectId: input.projectId,
				assetFamilyId: input.assetFamilyId,
				revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
				items: input.items.map((item) => requiredSetItemSchema.parse(item)),
				createdByUserId: userId,
				createdAt: now,
			})
			.onConflictDoNothing()
			.returning();
		if (!revision) {
			return null;
		}
		return toRevision(revision, null, new Set());
	}

	async function activate(
		userId: string,
		input: Parameters<FamilyReadinessStore["activate"]>[1]
	) {
		if (!(await getProjectForUser(db, userId, input.projectId))) {
			return null;
		}
		const [revision] = await db
			.select({ id: familyRequiredSetRevisions.id })
			.from(familyRequiredSetRevisions)
			.where(
				and(
					eq(familyRequiredSetRevisions.id, input.revisionId),
					eq(familyRequiredSetRevisions.projectId, input.projectId),
					eq(familyRequiredSetRevisions.assetFamilyId, input.assetFamilyId)
				)
			)
			.limit(1);
		if (!revision) {
			return null;
		}
		const now = new Date();
		await db.execute(sql`
			WITH updated_head AS (
				INSERT INTO family_required_set_heads (
					project_id,
					asset_family_id,
					active_revision_id,
					updated_at
				)
				VALUES (
					${input.projectId},
					${input.assetFamilyId},
					${revision.id},
					${now}
				)
				ON CONFLICT (project_id, asset_family_id)
				DO UPDATE SET
					active_revision_id = EXCLUDED.active_revision_id,
					updated_at = EXCLUDED.updated_at
				RETURNING project_id, asset_family_id, active_revision_id
			)
			INSERT INTO family_required_set_activations (
				id,
				project_id,
				asset_family_id,
				revision_id,
				activated_by_user_id,
				activated_at
			)
			SELECT
				${crypto.randomUUID()},
				project_id,
				asset_family_id,
				active_revision_id,
				${userId},
				${now}
			FROM updated_head
		`);
		return list(userId, input.projectId, input.assetFamilyId);
	}

	async function recordEvidence(userId: string, input: ReadinessEvidenceInput) {
		const item = await readEvidenceItem(db, userId, input);
		if (!item) {
			return null;
		}
		const scope = await readEvidenceScope(db, input, item);
		if (!scope) {
			return null;
		}
		const now = new Date();
		const [inserted] = await db
			.insert(familyReadinessEvidence)
			.values({
				id: crypto.randomUUID(),
				projectId: input.projectId,
				assetFamilyId: input.assetFamilyId,
				revisionId: input.revisionId,
				itemId: input.itemId,
				kind: input.kind,
				result: input.result,
				assetVersionIds: scope.assetVersionIds,
				profileContractRevisionIds:
					input.kind === "applicability"
						? []
						: scope.profileContractRevisionIds,
				contextRevisionId: scope.contextRevisionId,
				visualWorldId: scope.family.visualWorldId,
				useContext: scope.family.useContext,
				canonicalDesignVersionId: scope.canonicalDesignVersionId,
				ruleId: input.kind === "quality" ? input.ruleId : null,
				ruleClass: input.kind === "quality" ? scope.ruleClass : null,
				testId: input.kind === "usage_test" ? input.testId : null,
				observedValue:
					input.kind === "quality" ? (input.observedValue ?? null) : null,
				method: "method" in input ? input.method : null,
				rationale: input.rationale,
				createdByUserId: userId,
				createdAt: now,
			})
			.returning();
		if (!inserted) {
			return null;
		}
		return list(userId, input.projectId, input.assetFamilyId);
	}

	return { list, saveDraft, activate, recordEvidence };
}
