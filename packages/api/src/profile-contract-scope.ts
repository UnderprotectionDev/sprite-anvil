import { isDeepStrictEqual } from "node:util";
import type {
	SpecializedProfileContract,
	SpecializedProfileId,
} from "@sprite-anvil/api/specialized-profile-contracts";
import { specializedProfileContractSchema } from "@sprite-anvil/api/specialized-profile-contracts";
import type { Database } from "@sprite-anvil/db";
import {
	projectSpecializedProfileContracts,
	specializedProfileContractRevisions,
} from "@sprite-anvil/db/schema/specialized-profile-contracts";
import { eq } from "drizzle-orm";

export interface ProfileContractSnapshot {
	contract: SpecializedProfileContract;
	profileId: SpecializedProfileId;
	revisionId: string;
}

export interface ProjectProfileContracts {
	activeByProfile: Map<SpecializedProfileId, ProfileContractSnapshot>;
	byRevisionId: Map<string, ProfileContractSnapshot>;
}

type QualityEvidenceRuleClass =
	| SpecializedProfileContract["rules"][number]["class"]
	| "human_review";

function toSnapshot(
	row: typeof specializedProfileContractRevisions.$inferSelect
) {
	const contract = specializedProfileContractSchema.parse(row.definition);
	const revisionId = `${contract.profileId}@${contract.version}`;
	if (
		row.profileId !== contract.profileId ||
		row.contractSchemaVersion !== contract.contractSchemaVersion ||
		row.contractVersion !== contract.version ||
		row.id !== revisionId
	) {
		throw new Error("Stored Specialized Profile Contract revision is invalid");
	}
	return { contract, profileId: contract.profileId, revisionId };
}

export async function readProjectProfileContracts(
	db: Database,
	projectId: string
): Promise<ProjectProfileContracts> {
	const [revisionRows, activeRows] = await Promise.all([
		db.select().from(specializedProfileContractRevisions),
		db
			.select({
				profileId: projectSpecializedProfileContracts.profileId,
				contractRevisionId:
					projectSpecializedProfileContracts.contractRevisionId,
			})
			.from(projectSpecializedProfileContracts)
			.where(eq(projectSpecializedProfileContracts.projectId, projectId)),
	]);
	const byRevisionId = new Map(
		revisionRows.map((row) => {
			const snapshot = toSnapshot(row);
			return [snapshot.revisionId, snapshot];
		})
	);
	const activeByProfile = new Map<
		SpecializedProfileId,
		ProfileContractSnapshot
	>();
	for (const active of activeRows) {
		const snapshot = byRevisionId.get(active.contractRevisionId);
		if (snapshot?.profileId === active.profileId) {
			activeByProfile.set(active.profileId, snapshot);
		}
	}
	return { activeByProfile, byRevisionId };
}

function sameContractEntry(
	kind: "quality" | "usage_test",
	ruleClass: QualityEvidenceRuleClass | null | undefined,
	pinnedRevisionId: string,
	activeRevisionId: string,
	entryId: string,
	contracts: ProjectProfileContracts
) {
	const pinned = contracts.byRevisionId.get(pinnedRevisionId);
	const active = contracts.byRevisionId.get(activeRevisionId);
	if (!(pinned && active) || pinned.profileId !== active.profileId) {
		return false;
	}
	const findEntry = (contract: SpecializedProfileContract) => {
		if (kind === "usage_test") {
			return contract.usageTests.find((test) => test.id === entryId);
		}
		if (ruleClass === "human_review") {
			return contract.humanReviews.find((review) => review.id === entryId);
		}
		return contract.rules.find((rule) => rule.id === entryId);
	};
	const pinnedEntry = findEntry(pinned.contract);
	const activeEntry = findEntry(active.contract);
	return Boolean(
		pinnedEntry && activeEntry && isDeepStrictEqual(pinnedEntry, activeEntry)
	);
}

export function areContractPinsCompatible(input: {
	activeRevisionIds: (string | null)[];
	contracts: ProjectProfileContracts;
	entryId: string;
	kind: "quality" | "usage_test";
	pinnedRevisionIds: (string | null)[];
	profileIds: (SpecializedProfileId | null)[];
	ruleClass?: QualityEvidenceRuleClass | null;
}) {
	if (
		input.activeRevisionIds.length !== input.pinnedRevisionIds.length ||
		input.activeRevisionIds.length !== input.profileIds.length
	) {
		return false;
	}
	return input.activeRevisionIds.every((activeRevisionId, index) => {
		const pinnedRevisionId = input.pinnedRevisionIds[index];
		if (activeRevisionId === pinnedRevisionId) {
			return true;
		}
		if (!(activeRevisionId && pinnedRevisionId && input.profileIds[index])) {
			return false;
		}
		return sameContractEntry(
			input.kind,
			input.ruleClass,
			pinnedRevisionId,
			activeRevisionId,
			input.entryId,
			input.contracts
		);
	});
}
