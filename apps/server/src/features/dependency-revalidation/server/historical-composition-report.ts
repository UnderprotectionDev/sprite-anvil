import { requiredSetItemSchema } from "@sprite-anvil/api/family-readiness";
import type {
	HistoricalCompositionInput,
	HistoricalCompositionReport,
} from "@sprite-anvil/api/historical-compositions";
import {
	assessProfileQualityReadiness,
	specializedProfileContractSchema,
} from "@sprite-anvil/api/specialized-profile-contracts";
import type {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import type {
	assetVersionReviewEvents,
	assetVersions,
	compositeVersionReviewEvents,
} from "@sprite-anvil/db/schema/asset-versions";
import type { dependencyLinks } from "@sprite-anvil/db/schema/dependency-revalidation";
import type {
	familyReadinessEvidence,
	familyRequiredSetRevisions,
} from "@sprite-anvil/db/schema/family-readiness";
import type { specializedProfileContractRevisions } from "@sprite-anvil/db/schema/specialized-profile-contracts";

type Evidence = typeof familyReadinessEvidence.$inferSelect;
interface Target {
	assetRecordId: string;
	id: string;
	kind: "asset" | "unit" | "composite";
	versionIds: string[];
}
export interface HistoricalCompositionFacts {
	assetReviews: (typeof assetVersionReviewEvents.$inferSelect)[];
	compositeReviews: (typeof compositeVersionReviewEvents.$inferSelect)[];
	contracts: (typeof specializedProfileContractRevisions.$inferSelect)[];
	evidence: Evidence[];
	family: typeof assetFamilies.$inferSelect;
	integrityFailures: string[];
	links: (typeof dependencyLinks.$inferSelect)[];
	records: (typeof assetRecords.$inferSelect)[];
	revisions: (typeof familyRequiredSetRevisions.$inferSelect)[];
	selectedLinks: (typeof dependencyLinks.$inferSelect)[];
	targets: Target[];
	versions: (typeof assetVersions.$inferSelect)[];
}

function sameVersions(first: string[], second: string[]) {
	return (
		first.length === second.length && first.every((id) => second.includes(id))
	);
}

function matchingEvidence(
	input: HistoricalCompositionInput,
	facts: HistoricalCompositionFacts,
	target: Target,
	contractId: string
) {
	return facts.evidence.filter((evidence) => {
		const revision = facts.revisions.find(
			(row) => row.id === evidence.revisionId
		);
		const item = revision
			? requiredSetItemSchema
					.array()
					.parse(revision.items)
					.find((entry) => entry.id === evidence.itemId)
			: undefined;
		const targetMatches = evidence.unitVersionId
			? target.kind === "unit" && target.id === evidence.unitVersionId
			: !evidence.compositeVersionId ||
				(target.kind === "composite" &&
					target.id === evidence.compositeVersionId);
		return (
			targetMatches &&
			item?.assetRecordIds.includes(target.assetRecordId) &&
			evidence.assetFamilyId === facts.family.id &&
			evidence.contextRevisionId === input.contextRevisionId &&
			evidence.canonicalDesignVersionId === input.canonicalDesignVersionId &&
			evidence.visualWorldId === facts.family.visualWorldId &&
			evidence.useContext === facts.family.useContext &&
			sameVersions(evidence.assetVersionIds, target.versionIds) &&
			evidence.profileContractRevisionIds.every((id) => id === contractId) &&
			evidence.profileContractRevisionIds.length ===
				evidence.assetVersionIds.length
		);
	});
}

type Blocker = HistoricalCompositionReport["blockers"][number];
function blocker(
	code: Blocker["code"],
	targetId: string,
	message: string
): Blocker {
	return { code, targetId, message };
}

function reachesCanonical(
	versionId: string,
	input: HistoricalCompositionInput,
	facts: HistoricalCompositionFacts,
	visited = new Set<string>()
): boolean {
	if (visited.has(versionId)) {
		return false;
	}
	visited.add(versionId);
	if (versionId === input.canonicalDesignVersionId) {
		return true;
	}
	return facts.selectedLinks.some(
		(link) =>
			link.targetAssetVersionId === versionId &&
			link.sourceAssetVersionId &&
			reachesCanonical(link.sourceAssetVersionId, input, facts, visited)
	);
}

function dependencyBlockers(
	input: HistoricalCompositionInput,
	facts: HistoricalCompositionFacts
): Blocker[] {
	const selectedIds = new Set(facts.versions.map((version) => version.id));
	const historicalLinks = facts.links.filter(
		(link) =>
			link.sourceAssetVersionId !== null ||
			link.sourceContextRevisionId === input.contextRevisionId ||
			facts.selectedLinks.some((selected) => selected.id === link.id)
	);
	const missingLinks = historicalLinks.filter(
		(link) =>
			!facts.selectedLinks.some((selected) => selected.id === link.id) ||
			link.facets.length === 0 ||
			(link.sourceAssetVersionId
				? !selectedIds.has(link.sourceAssetVersionId)
				: link.sourceContextRevisionId !== input.contextRevisionId)
	);
	const blockers = missingLinks.map((link) =>
		blocker(
			"dependency",
			link.targetAssetVersionId,
			"Bağımlılık Bağlantısı eksik, belirsiz veya farklı bir bağlama ait."
		)
	);
	for (const version of facts.versions.filter(
		(row) => row.sourceKind === "derived"
	)) {
		if (!reachesCanonical(version.id, input, facts)) {
			blockers.push(
				blocker(
					"dependency",
					version.id,
					"Türetilmiş Varlık seçili tarihsel Ana Tasarıma bağlanmıyor."
				)
			);
		}
	}
	if (!facts.targets.some((target) => target.kind === "unit")) {
		blockers.push(
			blocker(
				"dependency",
				input.compositeVersionId,
				"Birleşik Sürümün kesin Birim Sürümleri eksik."
			)
		);
	}
	return blockers;
}

function targetIsApproved(target: Target, facts: HistoricalCompositionFacts) {
	if (target.kind === "composite") {
		return (
			facts.compositeReviews
				.filter((review) => review.compositeVersionId === target.id)
				.at(-1)?.decision === "approved"
		);
	}
	return target.versionIds.every(
		(versionId) =>
			facts.assetReviews
				.filter((review) => review.versionId === versionId)
				.at(-1)?.decision === "approved"
	);
}

function latestSelectedEvidence(evidence: Evidence[]) {
	const latest = new Map<string, Evidence>();
	for (const entry of evidence) {
		latest.set([entry.kind, entry.ruleId, entry.testId].join(":"), entry);
	}
	return [...latest.values()];
}

function validRuleEvidence(
	entry: Evidence,
	target: Target,
	contract: ReturnType<typeof specializedProfileContractSchema.parse>
) {
	const rule = contract.rules.find(
		(candidate) => candidate.id === entry.ruleId
	);
	if (!rule || rule.class !== entry.ruleClass) {
		return false;
	}
	if (entry.result !== "waived") {
		return true;
	}
	return (
		Boolean(entry.observedValue?.trim()) &&
		rule.waiverEligibility &&
		rule.class === "waivable_requirement" &&
		target.kind !== "asset" &&
		(entry.unitVersionId === target.id ||
			entry.compositeVersionId === target.id)
	);
}

function qualityBlockers(
	target: Target,
	evidence: Evidence[],
	contract: ReturnType<typeof specializedProfileContractSchema.parse>
): Blocker[] {
	const ruleResults = new Map<
		string,
		"passed" | "failed" | "inconclusive" | "waived"
	>();
	const usageResults = new Map<string, "passed" | "failed" | "inconclusive">();
	const humanResults = new Map<string, "passed" | "failed" | "inconclusive">();
	for (const entry of evidence) {
		if (entry.result === "applicable" || entry.result === "inapplicable") {
			continue;
		}
		if (
			entry.kind === "quality" &&
			entry.ruleId &&
			validRuleEvidence(entry, target, contract)
		) {
			ruleResults.set(entry.ruleId, entry.result);
		}
		if (
			entry.kind === "quality" &&
			entry.ruleId &&
			entry.ruleClass === "human_review" &&
			entry.result !== "waived"
		) {
			humanResults.set(entry.ruleId, entry.result);
		}
		if (
			entry.kind === "usage_test" &&
			entry.testId &&
			entry.result !== "waived"
		) {
			usageResults.set(entry.testId, entry.result);
		}
	}
	const assessment = assessProfileQualityReadiness(
		contract,
		ruleResults,
		usageResults,
		humanResults
	);
	return [
		...assessment.outstandingRuleIds,
		...assessment.outstandingHumanReviewIds,
		...assessment.outstandingUsageTestIds,
	].map((id) =>
		blocker("quality", target.id, `Zorunlu kalite kanıtı tamamlanmamış: ${id}`)
	);
}

function targetBlockers(
	input: HistoricalCompositionInput,
	facts: HistoricalCompositionFacts,
	target: Target
): Blocker[] {
	const blockers: Blocker[] = [];
	const record = facts.records.find((row) => row.id === target.assetRecordId);
	if (record?.availability !== "active") {
		blockers.push(
			blocker("availability", target.id, "Varlık Kaydı kullanılabilir değil.")
		);
	}
	if (!targetIsApproved(target, facts)) {
		blockers.push(
			blocker(
				"approval",
				target.id,
				"Kesin sürüm için geçmiş onay İnceleme Kaydı sabitlenmemiş."
			)
		);
	}
	const contractRow = facts.contracts.find(
		(row) => row.profileId === record?.assetCategory
	);
	if (!contractRow) {
		return [
			...blockers,
			blocker(
				"quality_contract",
				target.id,
				"Özel Profil Sözleşmesi açıkça sabitlenmemiş."
			),
		];
	}
	const contract = specializedProfileContractSchema.parse(
		contractRow.definition
	);
	const evidence = latestSelectedEvidence(
		matchingEvidence(input, facts, target, contractRow.id)
	);
	if (
		!evidence.some(
			(entry) => entry.kind === "applicability" && entry.result === "applicable"
		)
	) {
		blockers.push(
			blocker(
				"applicability",
				target.id,
				"Seçili tarihsel bağlam ve Ana Tasarım için uygunluk kanıtı eksik."
			)
		);
	}
	return [...blockers, ...qualityBlockers(target, evidence, contract)];
}

export function assessHistoricalComposition(
	input: HistoricalCompositionInput,
	facts: HistoricalCompositionFacts
): HistoricalCompositionReport {
	const blockers = [
		...facts.integrityFailures.map((id) =>
			blocker("integrity", id, "Kesin Varlık Sürümünün içeriği doğrulanamadı.")
		),
		...dependencyBlockers(input, facts),
		...facts.targets.flatMap((target) => targetBlockers(input, facts, target)),
	];
	return {
		mode: "historical",
		exportEligible: blockers.length === 0,
		blockers,
	};
}
