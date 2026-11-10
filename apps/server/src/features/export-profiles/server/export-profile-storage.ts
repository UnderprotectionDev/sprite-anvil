export interface StoredExportProfile {
	createdByUserId: string;
	id: string;
	name: string;
	projectId: string;
}

export interface StoredExportProfileRevision {
	contentDigest: string;
	contractVersion: string;
	createdAt: Date;
	createdByUserId: string;
	definition: Record<string, unknown>;
	id: string;
	profileId: string;
	projectId: string;
	revisionNumber: number;
}

export type NewExportProfileRevision = Omit<
	StoredExportProfileRevision,
	"revisionNumber"
>;

export type InsertExportProfileRevisionResult =
	| { revision: StoredExportProfileRevision; status: "inserted" }
	| { status: "conflict" }
	| { status: "profile_in_other_project" };

/** The persistent side of Export Profiles. Revisions are only ever inserted. */
export interface ExportProfileStorage {
	findProfile: (
		projectId: string,
		profileId: string
	) => Promise<StoredExportProfile | null>;
	findRevision: (
		projectId: string,
		revisionId: string
	) => Promise<StoredExportProfileRevision | null>;
	/** Records the profile when it is new, then the profile's next revision number, together. A conflict means the revision id or the number was taken concurrently. */
	insertRevision: (
		profile: StoredExportProfile,
		revision: NewExportProfileRevision
	) => Promise<InsertExportProfileRevisionResult>;
	listProfiles: (projectId: string) => Promise<StoredExportProfile[]>;
	listRevisions: (projectId: string) => Promise<StoredExportProfileRevision[]>;
}
