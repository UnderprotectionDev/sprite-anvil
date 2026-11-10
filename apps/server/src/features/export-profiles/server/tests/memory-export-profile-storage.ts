import type {
	ExportProfileStorage,
	StoredExportProfile,
	StoredExportProfileRevision,
} from "../export-profile-storage";

/** An in-memory ExportProfileStorage with the same uniqueness rules as the database store. */
export function createMemoryExportProfileStorage(): ExportProfileStorage {
	const profiles = new Map<string, StoredExportProfile>();
	const revisions: StoredExportProfileRevision[] = [];

	return {
		findProfile: (projectId, profileId) => {
			const profile = profiles.get(profileId);
			return Promise.resolve(profile?.projectId === projectId ? profile : null);
		},
		findRevision: (projectId, revisionId) =>
			Promise.resolve(
				revisions.find(
					(revision) =>
						revision.projectId === projectId && revision.id === revisionId
				) ?? null
			),
		insertRevision: (profile, revision) => {
			const known = profiles.get(profile.id);
			if (known && known.projectId !== profile.projectId) {
				return Promise.resolve({ status: "profile_in_other_project" });
			}
			if (revisions.some((existing) => existing.id === revision.id)) {
				return Promise.resolve({ status: "conflict" });
			}
			if (!known) {
				profiles.set(profile.id, profile);
			}
			const stored = {
				...revision,
				revisionNumber:
					Math.max(
						0,
						...revisions
							.filter((existing) => existing.profileId === revision.profileId)
							.map((existing) => existing.revisionNumber)
					) + 1,
			};
			revisions.push(stored);
			return Promise.resolve({ revision: stored, status: "inserted" });
		},
		listProfiles: (projectId) =>
			Promise.resolve(
				[...profiles.values()].filter(
					(profile) => profile.projectId === projectId
				)
			),
		listRevisions: (projectId) =>
			Promise.resolve(
				revisions.filter((revision) => revision.projectId === projectId)
			),
	};
}
