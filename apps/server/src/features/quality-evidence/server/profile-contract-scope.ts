import type { SpecializedProfileId } from "@sprite-anvil/api/specialized-profile-contracts";
import { specializedProfileContractSchema } from "@sprite-anvil/api/specialized-profile-contracts";
import type { Database } from "@sprite-anvil/db";
import {
	specializedProfileContractHeads,
	specializedProfileContractRevisions,
} from "@sprite-anvil/db/schema/specialized-profile-contracts";
import { eq } from "drizzle-orm";

export interface ProfileContractSnapshot {
	contract: ReturnType<typeof specializedProfileContractSchema.parse>;
	profileId: SpecializedProfileId;
	revisionId: string;
	revisionNumber: number;
}

export interface ProjectProfileContracts {
	activeByProfile: Map<SpecializedProfileId, ProfileContractSnapshot>;
	byRevisionId: Map<string, ProfileContractSnapshot>;
}

export async function readProjectProfileContracts(
	db: Database,
	projectId: string
): Promise<ProjectProfileContracts> {
	const [revisionRows, headRows] = await Promise.all([
		db
			.select()
			.from(specializedProfileContractRevisions)
			.where(eq(specializedProfileContractRevisions.projectId, projectId)),
		db
			.select()
			.from(specializedProfileContractHeads)
			.where(eq(specializedProfileContractHeads.projectId, projectId)),
	]);
	const byRevisionId = new Map(
		revisionRows.map((row) => [
			row.id,
			{
				revisionId: row.id,
				profileId: row.profileId,
				revisionNumber: row.revisionNumber,
				contract: specializedProfileContractSchema.parse(row.contract),
			},
		])
	);
	const activeByProfile = new Map<
		SpecializedProfileId,
		ProfileContractSnapshot
	>();
	for (const head of headRows) {
		const activeRevision = byRevisionId.get(head.activeRevisionId ?? "");
		if (activeRevision?.profileId === head.profileId) {
			activeByProfile.set(head.profileId, activeRevision);
		}
	}
	return { activeByProfile, byRevisionId };
}

function sameContractEntry(
	kind: "quality" | "usage_test",
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
	const pinnedEntry =
		kind === "quality"
			? pinned.contract.rules.find((rule) => rule.id === entryId)
			: pinned.contract.usageTests.find((test) => test.id === entryId);
	const activeEntry =
		kind === "quality"
			? active.contract.rules.find((rule) => rule.id === entryId)
			: active.contract.usageTests.find((test) => test.id === entryId);
	return Boolean(
		pinnedEntry &&
			activeEntry &&
			JSON.stringify(pinnedEntry) === JSON.stringify(activeEntry)
	);
}

export function areContractPinsCompatible(input: {
	activeRevisionIds: (string | null)[];
	contracts: ProjectProfileContracts;
	entryId: string;
	kind: "quality" | "usage_test";
	pinnedRevisionIds: (string | null)[];
	profileIds: (SpecializedProfileId | null)[];
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
			pinnedRevisionId,
			activeRevisionId,
			input.entryId,
			input.contracts
		);
	});
}
