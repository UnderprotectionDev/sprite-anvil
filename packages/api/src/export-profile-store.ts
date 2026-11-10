import type {
	ExportProfileCatalog,
	ExportProfileRevision,
	ExportProfileRevisionCreateInput,
} from "./export-profiles";

export type ExportProfileRevisionRejectionReason =
	| "profile_unavailable"
	| "revision_id_conflict"
	| "revision_number_conflict"
	| "unsupported_contract_version";

export type ExportProfileRevisionCreateResult =
	| { revision: ExportProfileRevision; status: "saved" }
	| { reason: ExportProfileRevisionRejectionReason; status: "rejected" };

/** Authorized, project-scoped access to Export Profiles and their immutable revisions. */
export interface ExportProfileStore {
	/** Adds a revision only; an earlier one is never rewritten. Null when the project is not found. */
	createRevision: (
		userId: string,
		input: ExportProfileRevisionCreateInput
	) => Promise<ExportProfileRevisionCreateResult | null>;
	/** Null when the project is not found. */
	list: (
		userId: string,
		projectId: string
	) => Promise<ExportProfileCatalog | null>;
}
