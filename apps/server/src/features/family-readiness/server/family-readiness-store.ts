import type {
	FamilyReadiness,
	FamilyReadinessStore,
	QualityVersionTarget,
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
import { readDerivativeRevalidationState } from "../../dependency-revalidation/server/dependency-revalidation-catalog";
import {
	areContractPinsCompatible,
	type ProfileContractSnapshot,
	type ProjectProfileContracts,
	readProjectProfileContracts,
} from "../../quality-evidence/server/profile-contract-scope";
import {
	isAvailableQualityVersionTarget,
	qualityVersionTargetFromEvidence,
	readAssessmentQualityVersionTarget,
	readQualityVersionTargets,
} from "../../quality-evidence/server/quality-version-targets";

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
		usageTestContext: row.usageTestContext,
		observedValue: row.observedValue,
		versionTarget: qualityVersionTargetFromEvidence(row),
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
	if (evidence.kind === "usage_test" && !evidence.usageTestContext) {
		return false;
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
			ruleClass: evidence.ruleClass,
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

function nonWaivableEvidenceResult(
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
type HumanReviewRequirement =
	FamilyReadiness["items"][number]["humanReviewRequirements"][number];
type UsageRequirement =
	FamilyReadiness["items"][number]["usageRequirements"][number];

function qualityEvidenceFields(input: ReadinessEvidenceInput) {
	if (input.kind !== "quality") {
		return {
			ruleId: null,
			method: "method" in input ? input.method : null,
			observedValue: null,
			unitVersionId: null,
			compositeVersionId: null,
		};
	}
	return {
		ruleId: input.ruleId,
		method: input.method,
		observedValue: input.observedValue ?? null,
		unitVersionId:
			input.versionTarget?.kind === "unit" ? input.versionTarget.id : null,
		compositeVersionId:
			input.versionTarget?.kind === "composite" ? input.versionTarget.id : null,
	};
}

function isQualityVersionTargetCurrent(
	evidence: EvidenceRow,
	assessmentTarget: QualityVersionTarget | null,
	availableTargets: QualityVersionTarget[]
) {
	const target = qualityVersionTargetFromEvidence(evidence);
	if (!target) {
		return evidence.result !== "waived";
	}
	return (
		target.kind === assessmentTarget?.kind &&
		target.id === assessmentTarget.id &&
		isAvailableQualityVersionTarget(target, availableTargets)
	);
}

function latestEvidenceByItem(
	items: RequiredSetItem[],
	evidenceRows: EvidenceRow[],
	currentVersions: Map<string, typeof assetVersions.$inferSelect>,
	contextRevisionId: string | null,
	family: typeof assetFamilies.$inferSelect,
	canonicalDesignVersionId: string | null,
	assetRecordsById: Map<string, typeof assetRecords.$inferSelect>,
	contracts: ProjectProfileContracts,
	versionTargets: Map<string, QualityVersionTarget[]>
) {
	const result = new Map<string, CurrentEvidence[]>();
	for (const item of items) {
		const availableTargets = item.assetRecordIds.flatMap(
			(recordId) => versionTargets.get(recordId) ?? []
		);
		const assessmentTarget = readAssessmentQualityVersionTarget(
			evidenceRows,
			item.id,
			availableTargets
		);
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
				isCurrent:
					isQualityVersionTargetCurrent(
						row,
						assessmentTarget,
						availableTargets
					) &&
					evidenceMatchesCurrentScope(row, {
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
	versionIds: string[],
	currentEvidence: CurrentEvidence[],
	familyUsageEvidence: CurrentEvidence[]
): {
	profileUsageTestsComplete: boolean;
	qualityReadiness: ReadinessAssetStatus["qualityReadiness"];
	qualityRequirements: QualityRequirement[];
	humanReviewRequirements: HumanReviewRequirement[];
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
			if (row?.isCurrent && result !== "not_assessed") {
				ruleResults.set(rule.id, result);
			}
			return {
				id: rule.id,
				name: rule.input,
				class: rule.class,
				required: rule.class !== "quality_advisory",
				waiverEligible: rule.waiverEligibility,
				result,
				isCurrent: Boolean(row?.isCurrent),
			};
		}
	);
	const humanReviewResults = new Map<
		string,
		"passed" | "failed" | "inconclusive"
	>();
	const humanReviewRequirements: HumanReviewRequirement[] =
		contract.contract.humanReviews.map((review) => {
			const row = currentEvidence.find(
				(entry) =>
					entry.row.kind === "quality" &&
					entry.row.ruleId === review.id &&
					entry.row.ruleClass === "human_review"
			);
			const result = nonWaivableEvidenceResult(row);
			if (row?.isCurrent && result !== "not_assessed") {
				humanReviewResults.set(review.id, result);
			}
			return {
				id: review.id,
				name: review.label,
				required: review.required,
				result,
				isCurrent: Boolean(row?.isCurrent),
			};
		});
	let profileUsageTestsComplete = true;
	const usageTestResults = new Map<
		string,
		"passed" | "failed" | "inconclusive" | "waived"
	>();
	const usageRequirements: UsageRequirement[] =
		contract.contract.usageTests.map((usageTest) => {
			const evidenceEntries = versionIds.map((versionId) =>
				latestUsageEvidence(familyUsageEvidence, usageTest.id, versionId)
			);
			const versionResults = evidenceEntries.map((evidenceEntry) =>
				evidenceEntry?.isCurrent
					? nonWaivableEvidenceResult(evidenceEntry)
					: "not_assessed"
			);
			const result =
				versionResults.length > 0 &&
				versionResults.every((versionResult) => versionResult === "passed")
					? "passed"
					: (versionResults.find(
							(versionResult) => versionResult === "failed"
						) ??
						versionResults.find(
							(versionResult) => versionResult === "inconclusive"
						) ??
						"not_assessed");
			if (result !== "not_assessed") {
				usageTestResults.set(usageTest.id, result);
			}
			if (usageTest.required && result !== "passed") {
				profileUsageTestsComplete = false;
			}
			return {
				id: usageTest.id,
				name: usageTest.label,
				required: true,
				result,
				isCurrent:
					evidenceEntries.length > 0 &&
					evidenceEntries.every((evidenceEntry) => evidenceEntry?.isCurrent),
			};
		});
	return {
		profileUsageTestsComplete,
		qualityReadiness: assessProfileQualityReadiness(
			contract.contract,
			ruleResults,
			usageTestResults,
			humanReviewResults
		).status,
		qualityRequirements,
		humanReviewRequirements,
		usageRequirements,
	};
}

function getProfileContractUsageTestStatus(
	item: RequiredSetItem,
	linkedAssets: LinkedReadinessAsset[]
) {
	if (item.kind !== "usage_test") {
		return;
	}
	return linkedAssets.every(({ profileId, profileContract }) => {
		if (!profileId) {
			return true;
		}
		return Boolean(
			profileContract?.contract.usageTests.some(
				(test) => test.id === item.testId
			)
		);
	});
}

interface LinkedReadinessAsset {
	profileContract: ProfileContractSnapshot | null;
	profileId: SpecializedProfileId | null;
	version: typeof assetVersions.$inferSelect | null;
}

function groupProfileAssets(linkedAssets: LinkedReadinessAsset[]) {
	const profileGroups = new Map<
		SpecializedProfileId,
		{ contract: ProfileContractSnapshot; versionIds: string[] }
	>();
	for (const linkedAsset of linkedAssets) {
		if (!(linkedAsset.profileId && linkedAsset.profileContract)) {
			continue;
		}
		const group = profileGroups.get(linkedAsset.profileId);
		if (group) {
			if (linkedAsset.version) {
				group.versionIds.push(linkedAsset.version.id);
			}
			continue;
		}
		profileGroups.set(linkedAsset.profileId, {
			contract: linkedAsset.profileContract,
			versionIds: linkedAsset.version ? [linkedAsset.version.id] : [],
		});
	}
	return profileGroups;
}

function combineQualityReadiness(
	linkedAssets: LinkedReadinessAsset[],
	profileContractActive: boolean,
	profileAssessments: ReturnType<typeof assessSpecializedProfile>[]
): ReadinessAssetStatus["qualityReadiness"] {
	const profileIds = new Set(
		linkedAssets.flatMap((linkedAsset) =>
			linkedAsset.profileId ? [linkedAsset.profileId] : []
		)
	);
	if (
		linkedAssets.length === 0 ||
		linkedAssets.some((linkedAsset) => !linkedAsset.profileId) ||
		!profileContractActive ||
		profileAssessments.length !== profileIds.size
	) {
		return "not_assessed";
	}
	const statuses = profileAssessments.map(
		(profileAssessment) => profileAssessment.qualityReadiness
	);
	if (statuses.some((status) => status === "blocked")) {
		return "blocked";
	}
	if (statuses.some((status) => status === "exceptions_ready")) {
		return "exceptions_ready";
	}
	return statuses.every((status) => status === "export_ready")
		? "export_ready"
		: "not_assessed";
}

function combineReviewDisposition(
	versions: (typeof assetVersions.$inferSelect)[],
	latestReviews: Map<string, typeof assetVersionReviewEvents.$inferSelect>
): ReadinessAssetStatus["reviewDisposition"] {
	const decisions = versions.map(
		(version) => latestReviews.get(version.id)?.decision ?? "candidate"
	);
	if (decisions.includes("rejected")) {
		return "rejected";
	}
	return decisions.every((decision) => decision === "approved")
		? "approved"
		: "candidate";
}

function assessLinkedReadinessAssets(input: {
	currentEvidence: CurrentEvidence[];
	familyUsageEvidence: CurrentEvidence[];
	latestReviews: Map<string, typeof assetVersionReviewEvents.$inferSelect>;
	linkedAssets: LinkedReadinessAsset[];
	applicabilityIsCurrent: boolean;
}): {
	assetStatus: ReadinessAssetStatus | null;
	profileContractActive: boolean;
	profileUsageTestsComplete: boolean | undefined;
	qualityReadiness: ReadinessAssetStatus["qualityReadiness"];
	qualityRequirements: QualityRequirement[];
	humanReviewRequirements: HumanReviewRequirement[];
	usageRequirements: UsageRequirement[];
} {
	const { currentEvidence, familyUsageEvidence, latestReviews, linkedAssets } =
		input;
	const profileGroups = groupProfileAssets(linkedAssets);
	const profileAssessments = [...profileGroups.values()].map((profileGroup) =>
		assessSpecializedProfile(
			profileGroup.contract,
			profileGroup.versionIds,
			currentEvidence,
			familyUsageEvidence
		)
	);
	const profileContractActive = linkedAssets.every(
		({ profileId, profileContract }) => !profileId || Boolean(profileContract)
	);
	const hasSpecializedAsset = linkedAssets.some(({ profileId }) => profileId);
	const hasOnlyGeneralAssets = linkedAssets.length > 0 && !hasSpecializedAsset;
	const generalAssessment = hasOnlyGeneralAssets
		? assessGeneralAssetSupportEvidence(currentEvidence)
		: null;
	const qualityRequirements = hasOnlyGeneralAssets
		? (generalAssessment?.qualityRequirements ?? [])
		: [
				...new Map(
					profileAssessments
						.flatMap(
							(profileAssessment) => profileAssessment.qualityRequirements
						)
						.map((requirement) => [requirement.id, requirement])
				).values(),
			];
	const humanReviewRequirements = hasOnlyGeneralAssets
		? []
		: [
				...new Map(
					profileAssessments
						.flatMap(
							(profileAssessment) => profileAssessment.humanReviewRequirements
						)
						.map((requirement) => [requirement.id, requirement])
				).values(),
			];
	const usageRequirements = [
		...new Map(
			profileAssessments
				.flatMap((profileAssessment) => profileAssessment.usageRequirements)
				.map((requirement) => [requirement.id, requirement])
		).values(),
	];
	const qualityReadiness =
		generalAssessment?.qualityReadiness ??
		combineQualityReadiness(
			linkedAssets,
			profileContractActive,
			profileAssessments
		);
	const uniqueProfileCount = new Set(
		linkedAssets.flatMap((linkedAsset) =>
			linkedAsset.profileId ? [linkedAsset.profileId] : []
		)
	).size;
	const profileUsageTestsComplete = hasSpecializedAsset
		? profileContractActive &&
			linkedAssets.every((linkedAsset) => Boolean(linkedAsset.version)) &&
			profileAssessments.length === uniqueProfileCount &&
			profileAssessments.every(
				(profileAssessment) => profileAssessment.profileUsageTestsComplete
			)
		: undefined;
	const versions = linkedAssets.flatMap((linkedAsset) =>
		linkedAsset.version ? [linkedAsset.version] : []
	);
	const allVersionsPresent =
		linkedAssets.length > 0 && versions.length === linkedAssets.length;
	return {
		assetStatus: allVersionsPresent
			? {
					applicability: input.applicabilityIsCurrent
						? "applicable"
						: "not_assessed",
					integrityVerified: versions.every(
						(version) => version.integrityVerified && version.contentDigest
					),
					qualityReadiness,
					reviewDisposition: combineReviewDisposition(versions, latestReviews),
				}
			: null,
		profileContractActive,
		profileUsageTestsComplete,
		qualityReadiness,
		qualityRequirements,
		humanReviewRequirements,
		usageRequirements,
	};
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
	contracts: ProjectProfileContracts,
	applicabilityIsRevalidated: boolean
): EvaluatedItem {
	const currentEvidence = evidence.filter((entry) => entry.isCurrent);
	const applicabilityEvidence = currentEvidence.find(
		(entry) => entry.row.kind === "applicability"
	);
	const applicabilityIsCurrent = Boolean(
		applicabilityEvidence?.row.result === "applicable" ||
			applicabilityIsRevalidated
	);
	const linkedAssets = item.assetRecordIds.map((assetRecordId) => {
		const category = assetRecordsById.get(assetRecordId)?.assetCategory;
		const parsedProfileId = specializedProfileIdSchema.safeParse(category);
		const profileId = parsedProfileId.success ? parsedProfileId.data : null;
		return {
			profileId,
			profileContract: profileId
				? (contracts.activeByProfile.get(profileId) ?? null)
				: null,
			version: currentVersions.get(assetRecordId) ?? null,
		};
	});
	const familyUsageEvidence = collectFamilyUsageEvidence(
		allEvidenceByItem,
		activeItems
	);
	const itemVersions = linkedAssets.flatMap((linkedAsset) =>
		linkedAsset.version ? [linkedAsset.version] : []
	);
	const linkedAssetAssessment = assessLinkedReadinessAssets({
		currentEvidence,
		familyUsageEvidence,
		latestReviews,
		linkedAssets,
		applicabilityIsCurrent,
	});
	const usageEvidence = currentEvidence.find(
		(entry) =>
			entry.row.kind === "usage_test" && entry.row.testId === item.testId
	);
	const usageTestStatus = nonWaivableEvidenceResult(usageEvidence);
	const evaluation: ReadinessEvaluationItem = {
		id: item.id,
		kind: item.kind,
		disposition: item.disposition,
		asset: linkedAssetAssessment.assetStatus,
		profileContractActive: linkedAssetAssessment.profileContractActive,
		profileContractUsageTest: getProfileContractUsageTestStatus(
			item,
			linkedAssets
		),
		profileUsageTestsComplete: linkedAssetAssessment.profileUsageTestsComplete,
		usageTestStatus,
	};
	const [readinessResult] = evaluateFamilyReadiness({
		activeRequiredSetRevisionId: activeRevisionId,
		items: [evaluation],
	}).items;
	return {
		item,
		status: readinessResult?.status ?? "incomplete",
		blockers: readinessResult?.blockers ?? [],
		currentAssetVersionIds: itemVersions.map((current) => current.id),
		qualityReadiness: linkedAssetAssessment.qualityReadiness,
		qualityRequirements: linkedAssetAssessment.qualityRequirements,
		humanReviewRequirements: linkedAssetAssessment.humanReviewRequirements,
		usageRequirements: linkedAssetAssessment.usageRequirements,
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
	activeRevision: RequiredSetRevision,
	assetVersionId?: string
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
		if (
			!currentVersions.has(version.assetRecordId) ||
			version.id === assetVersionId
		) {
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
	const exactVersion = versionRows.find(
		(version) => version.id === assetVersionId
	);
	const versionTargets = await readQualityVersionTargets(
		db,
		projectId,
		activeRevision.items.flatMap((item) => item.assetRecordIds),
		exactVersion
			? {
					assetRecordId: exactVersion.assetRecordId,
					assetVersionId: exactVersion.id,
				}
			: undefined
	);
	const currentEvidence = latestEvidenceByItem(
		activeRevision.items,
		evidenceRows,
		currentVersions,
		contextRows[0]?.id ?? null,
		family,
		canonicalRows[0]?.assetVersionId ?? null,
		assetRecordsById,
		contracts,
		versionTargets
	);
	const revalidation = await readDerivativeRevalidationState(db, projectId);
	const items = activeRevision.items.map((item) => ({
		...evaluateRequiredSetItem(
			item,
			activeRevision.id,
			currentVersions,
			latestReviews,
			(currentEvidence.get(item.id) ?? []).filter(
				(entry) =>
					entry.row.kind !== "applicability" ||
					!item.assetRecordIds.some((recordId) => {
						const version = currentVersions.get(recordId);
						return version && revalidation.requiredVersionIds.has(version.id);
					})
			),
			currentEvidence,
			activeRevision.items,
			assetRecordsById,
			contracts,
			item.assetRecordIds.length > 0 &&
				item.assetRecordIds.every((recordId) => {
					const version = currentVersions.get(recordId);
					return version && revalidation.reviewedVersionIds.has(version.id);
				})
		),
		qualityVersionTargets: item.assetRecordIds.flatMap(
			(recordId) => versionTargets.get(recordId) ?? []
		),
	}));
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
	if (item.assetRecordIds.length === 0) {
		return { isValid: false, ruleClass: null };
	}
	if (profileIds.every((profileId) => profileId === null)) {
		const isValid =
			input.ruleId === "general.asset_support" && input.result !== "waived";
		return { isValid, ruleClass: null };
	}
	const rule = activeContracts
		.flatMap((contract) => contract?.contract.rules ?? [])
		.find((candidate) => candidate.id === input.ruleId);
	if (rule) {
		const isValid = isProfileQualityEvidenceValid({
			rule,
			result: input.result,
			observedValue: input.observedValue,
		});
		return {
			isValid,
			ruleClass: isValid ? rule.class : null,
		};
	}
	const humanReview = activeContracts
		.flatMap((contract) => contract?.contract.humanReviews ?? [])
		.find((candidate) => candidate.id === input.ruleId);
	const isValid = Boolean(
		humanReview &&
			input.result !== "waived" &&
			input.observedValue === undefined
	);
	return { isValid, ruleClass: isValid ? "human_review" : null };
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

const objectSceneUsageTestId = "object.approved_character_ground_scene";

function usageTestContextForInput(input: ReadinessEvidenceInput) {
	if (input.kind !== "usage_test") {
		return null;
	}
	return input.usageTestContext;
}

async function isUsageTestContextValid(
	db: Database,
	input: ReadinessEvidenceInput
) {
	if (input.kind !== "usage_test" || input.testId !== objectSceneUsageTestId) {
		return true;
	}
	const characterVersionId = input.usageTestContext.approvedCharacterVersionId;
	const groundVersionIds = input.usageTestContext.targetGroundVersionIds;
	if (
		!(characterVersionId && groundVersionIds) ||
		groundVersionIds.length < 2
	) {
		return false;
	}
	const selectedVersionIds = [characterVersionId, ...groundVersionIds];
	if (new Set(selectedVersionIds).size !== selectedVersionIds.length) {
		return false;
	}
	const selectedVersions = await db
		.select({
			id: assetVersions.id,
			assetRecordId: assetVersions.assetRecordId,
			assetCategory: assetRecords.assetCategory,
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
				eq(assetVersions.projectId, input.projectId),
				inArray(assetVersions.id, selectedVersionIds)
			)
		);
	if (selectedVersions.length !== selectedVersionIds.length) {
		return false;
	}
	const versionsById = new Map(
		selectedVersions.map((version) => [version.id, version])
	);
	const characterVersion = versionsById.get(characterVersionId);
	const groundVersions = groundVersionIds.map((id) => versionsById.get(id));
	if (
		characterVersion?.assetCategory !== "character_creature_animation" ||
		groundVersions.some(
			(version) =>
				version?.assetCategory !== "tileset_terrain_texture" || !version
		) ||
		new Set(groundVersions.map((version) => version?.assetRecordId)).size !==
			groundVersions.length
	) {
		return false;
	}
	const [latestCharacterReview] = await db
		.select({ decision: assetVersionReviewEvents.decision })
		.from(assetVersionReviewEvents)
		.where(
			and(
				eq(assetVersionReviewEvents.projectId, input.projectId),
				eq(assetVersionReviewEvents.versionId, characterVersionId)
			)
		)
		.orderBy(
			desc(assetVersionReviewEvents.createdAt),
			desc(assetVersionReviewEvents.id)
		)
		.limit(1);
	return latestCharacterReview?.decision === "approved";
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
	if (input.kind === "usage_test" && item.kind !== "usage_test") {
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
	if (!(await isUsageTestContextValid(db, input))) {
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
	if (input.kind === "quality" && input.versionTarget) {
		const targets = await readQualityVersionTargets(
			db,
			input.projectId,
			item.assetRecordIds
		);
		if (
			![...targets.values()]
				.flat()
				.some(
					(target) =>
						target.kind === input.versionTarget?.kind &&
						target.id === input.versionTarget?.id
				)
		) {
			return null;
		}
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

export function createFamilyReadinessStore(db: Database) {
	async function readQualityWaiverSource(
		input: ReadinessEvidenceInput,
		scope: EvidenceScope
	) {
		if (input.kind !== "quality" || input.result !== "waived") {
			return null;
		}
		const [source] = await db
			.select()
			.from(familyReadinessEvidence)
			.where(
				and(
					eq(familyReadinessEvidence.projectId, input.projectId),
					eq(familyReadinessEvidence.assetFamilyId, input.assetFamilyId),
					eq(familyReadinessEvidence.revisionId, input.revisionId),
					eq(familyReadinessEvidence.itemId, input.itemId),
					eq(familyReadinessEvidence.kind, "quality"),
					eq(familyReadinessEvidence.ruleId, input.ruleId)
				)
			)
			.orderBy(
				desc(familyReadinessEvidence.createdAt),
				desc(familyReadinessEvidence.id)
			)
			.limit(1);
		const contracts = await readProjectProfileContracts(db, input.projectId);
		const isValid = Boolean(
			source &&
				input.waiverEvidenceId === source.id &&
				(source.result === "failed" || source.result === "inconclusive") &&
				source.ruleClass === "waivable_requirement" &&
				source.observedValue === input.observedValue &&
				source.method === input.method &&
				qualityVersionTargetFromEvidence(source)?.kind ===
					input.versionTarget?.kind &&
				qualityVersionTargetFromEvidence(source)?.id ===
					input.versionTarget?.id &&
				evidenceMatchesCurrentScope(source, {
					assetVersionIds: scope.assetVersionIds,
					profileContractRevisionIds: scope.profileContractRevisionIds,
					contextRevisionId: scope.contextRevisionId,
					canonicalDesignVersionId: scope.canonicalDesignVersionId,
					visualWorldId: scope.family.visualWorldId,
					useContext: scope.family.useContext,
					profileIds: scope.profileIds,
					contracts,
				})
		);
		return isValid ? source : null;
	}

	async function list(
		userId: string,
		projectId: string,
		assetFamilyId: string,
		assetVersionId?: string
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
			activeRevision,
			assetVersionId
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
		const isWaiver = input.kind === "quality" && input.result === "waived";
		const waiverSource = isWaiver
			? await readQualityWaiverSource(input, scope)
			: null;
		if (isWaiver && !waiverSource) {
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
						: (waiverSource?.profileContractRevisionIds ??
							scope.profileContractRevisionIds),
				contextRevisionId: scope.contextRevisionId,
				visualWorldId: scope.family.visualWorldId,
				useContext: scope.family.useContext,
				canonicalDesignVersionId: scope.canonicalDesignVersionId,
				...qualityEvidenceFields(input),
				ruleClass: input.kind === "quality" ? scope.ruleClass : null,
				testId: input.kind === "usage_test" ? input.testId : null,
				usageTestContext: usageTestContextForInput(input),
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

	return {
		list,
		saveDraft,
		activate,
		recordEvidence,
	} satisfies FamilyReadinessStore;
}
