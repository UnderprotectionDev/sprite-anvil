import type {
	ExportProfileRevisionCreateResult,
	ExportProfileStore,
} from "@sprite-anvil/api/export-profile-store";
import {
	contractMajorOf,
	type ExportProfile,
	type ExportProfileCatalog,
	type ExportProfileRevision,
	type ExportProfileRevisionCreateInput,
	exportProfileCatalogSchema,
	exportProfileRevisionSchema,
	supportedExportProfileContractMajor,
} from "@sprite-anvil/api/export-profiles";
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import type {
	ExportProfileStorage,
	StoredExportProfileRevision,
} from "./export-profile-storage";

const maxRevisionAttempts = 3;

export interface ExportProfileStoreOptions {
	/** Resolves a project the user owns; defaults to the shared project access lookup. */
	getProjectForUser?: (userId: string, projectId: string) => Promise<unknown>;
	now?: () => Date;
}

/** The digest covers the contract version and the definition, so equal inputs give equal digests whatever the profile or time. */
function revisionDigest(
	input: Pick<
		ExportProfileRevisionCreateInput,
		"contractVersion" | "definition"
	>
) {
	return recordContentDigest({
		contractVersion: input.contractVersion,
		definition: input.definition,
	});
}

function toRevision(
	revision: StoredExportProfileRevision
): ExportProfileRevision {
	return exportProfileRevisionSchema.parse({
		contentDigest: revision.contentDigest,
		contractVersion: revision.contractVersion,
		createdAt: revision.createdAt.toISOString(),
		definition: revision.definition,
		id: revision.id,
		revisionNumber: revision.revisionNumber,
	});
}

export function createExportProfileStore(
	db: Database,
	storage: ExportProfileStorage,
	options: ExportProfileStoreOptions = {}
): ExportProfileStore {
	const lookupProject =
		options.getProjectForUser ??
		((userId: string, projectId: string) =>
			getProjectForUser(db, userId, projectId));
	const now = options.now ?? (() => new Date());

	/** The revision already stored under the id: the same profile and content replay it, anything else conflicts. */
	function resolveExisting(
		existing: StoredExportProfileRevision,
		profileId: string,
		digest: string
	): ExportProfileRevisionCreateResult {
		if (existing.profileId !== profileId || existing.contentDigest !== digest) {
			return { reason: "revision_id_conflict", status: "rejected" };
		}
		return { revision: toRevision(existing), status: "saved" };
	}

	return {
		async createRevision(userId, input) {
			if ((await lookupProject(userId, input.projectId)) === null) {
				return null;
			}
			if (
				contractMajorOf(input.contractVersion) !==
				supportedExportProfileContractMajor
			) {
				return { reason: "unsupported_contract_version", status: "rejected" };
			}
			const digest = await revisionDigest(input);

			const attempt = async (
				attemptsLeft: number
			): Promise<ExportProfileRevisionCreateResult> => {
				const existing = await storage.findRevision(
					input.projectId,
					input.revisionId
				);
				if (existing) {
					return resolveExisting(existing, input.profileId, digest);
				}
				if (attemptsLeft === 0) {
					return { reason: "revision_number_conflict", status: "rejected" };
				}
				const known = await storage.findProfile(
					input.projectId,
					input.profileId
				);
				const result = await storage.insertRevision(
					known ?? {
						createdByUserId: userId,
						id: input.profileId,
						name: input.name,
						projectId: input.projectId,
					},
					{
						contentDigest: digest,
						contractVersion: input.contractVersion,
						createdAt: now(),
						createdByUserId: userId,
						definition: input.definition,
						id: input.revisionId,
						profileId: input.profileId,
						projectId: input.projectId,
					}
				);
				if (result.status === "inserted") {
					return { revision: toRevision(result.revision), status: "saved" };
				}
				if (result.status === "profile_in_other_project") {
					return { reason: "profile_unavailable", status: "rejected" };
				}
				return attempt(attemptsLeft - 1);
			};
			return attempt(maxRevisionAttempts);
		},

		async list(userId, projectId): Promise<ExportProfileCatalog | null> {
			if ((await lookupProject(userId, projectId)) === null) {
				return null;
			}
			const [profiles, revisions] = await Promise.all([
				storage.listProfiles(projectId),
				storage.listRevisions(projectId),
			]);
			return exportProfileCatalogSchema.parse({
				profiles: profiles.map(
					(profile): ExportProfile => ({
						id: profile.id,
						name: profile.name,
						revisions: revisions
							.filter((revision) => revision.profileId === profile.id)
							.sort((left, right) => left.revisionNumber - right.revisionNumber)
							.map(toRevision),
					})
				),
			});
		},
	};
}
