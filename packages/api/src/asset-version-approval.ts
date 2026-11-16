import type { FamilyReadiness } from "@sprite-anvil/api/family-readiness";
import { createFamilyReadinessStore } from "@sprite-anvil/api/family-readiness-store";
import { readProjectProfileContracts } from "@sprite-anvil/api/profile-contract-scope";
import { specializedProfileIdSchema } from "@sprite-anvil/api/specialized-profile-contracts";
import type { Database } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import type { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { and, eq } from "drizzle-orm";

function hasMissingRequiredEvidence(requirement: {
	required: boolean;
	isCurrent: boolean;
	result: string;
}) {
	return (
		requirement.required &&
		(!requirement.isCurrent || requirement.result === "not_assessed")
	);
}

function itemApprovalBlockers(item: FamilyReadiness["items"][number]) {
	const blockers = item.blockers.includes("quality_contract")
		? ["Active Specialized Profile Contract is missing"]
		: [];
	blockers.push(
		...item.qualityRequirements
			.filter(
				(requirement) =>
					hasMissingRequiredEvidence(requirement) ||
					(requirement.required &&
						requirement.class === "integrity_gate" &&
						requirement.result !== "passed") ||
					(requirement.required &&
						requirement.class === "waivable_requirement" &&
						requirement.result !== "passed" &&
						requirement.result !== "waived")
			)
			.map((requirement) => requirement.id)
	);
	blockers.push(
		...[...item.humanReviewRequirements, ...item.usageRequirements]
			.filter(hasMissingRequiredEvidence)
			.map((requirement) => requirement.id)
	);
	if (
		item.item.kind === "usage_test" &&
		item.item.disposition === "required" &&
		!item.latestEvidence.some(
			(evidence) =>
				evidence.kind === "usage_test" &&
				evidence.testId === item.item.testId &&
				evidence.isCurrent
		)
	) {
		blockers.push(item.item.testId ?? item.item.id);
	}
	return blockers;
}

export async function readAssetVersionApprovalBlockers(
	db: Database,
	userId: string,
	version: typeof assetVersions.$inferSelect
): Promise<string[]> {
	if (!version.assetFamilyId) {
		return ["Asset Family not found"];
	}
	const readiness = await createFamilyReadinessStore(db).list(
		userId,
		version.projectId,
		version.assetFamilyId,
		version.id
	);
	if (!readiness) {
		return ["Quality evidence could not be read"];
	}
	const items = readiness.items.filter((entry) =>
		entry.item.assetRecordIds.includes(version.assetRecordId)
	);
	if (items.length === 0) {
		const [record] = await db
			.select({ assetCategory: assetRecords.assetCategory })
			.from(assetRecords)
			.where(
				and(
					eq(assetRecords.projectId, version.projectId),
					eq(assetRecords.id, version.assetRecordId)
				)
			)
			.limit(1);
		const profile = specializedProfileIdSchema.safeParse(record?.assetCategory);
		const contracts = await readProjectProfileContracts(db, version.projectId);
		return profile.success && contracts.activeByProfile.has(profile.data)
			? [
					"A Required Set link is missing for the active profile's required evidence",
				]
			: [];
	}
	return [...new Set(items.flatMap(itemApprovalBlockers))];
}
