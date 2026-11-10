import type { ExportBundleSource } from "./export-bundle-manifest";
import type {
	ExportBundle,
	ExportBundleCatalog,
	ExportBundleCreateInput,
} from "./export-bundles";

export type ExportBundleRejection =
	| { assetVersionIds: string[]; reason: "asset_digest_missing" }
	| { assetVersionIds: string[]; reason: "selection_unavailable" }
	| { assetFamilyIds: string[]; reason: "family_unavailable" }
	| {
			blockers: ExportBundleSource["blockers"];
			reason: "not_ready";
	  }
	| { paths: string[]; reason: "path_collision" }
	| { placeholder: string; reason: "unknown_naming_placeholder" }
	| { reason: "profile_revision_unavailable" }
	| { reason: "unsupported_profile_contract_version" };

export type ExportBundleCreateResult =
	| { bundle: ExportBundle; status: "created" | "replayed" }
	| ({ status: "rejected" } & ExportBundleRejection);

/** Resolves the exact persisted records a bundle pins, for the user's project. */
export interface ExportBundleSourceReader {
	/** Null when the project is not found. */
	read: (
		userId: string,
		input: { assetFamilyIds: string[]; projectId: string }
	) => Promise<
		| { source: ExportBundleSource; status: "resolved" }
		| { assetFamilyIds: string[]; status: "family_unavailable" }
		| null
	>;
}

/** Authorized, project-scoped access to immutable Export Bundles. */
export interface ExportBundleStore {
	/** Null when the project is not found. */
	create: (
		userId: string,
		input: ExportBundleCreateInput
	) => Promise<ExportBundleCreateResult | null>;
	/** Null when the project or bundle is not found. */
	get: (
		userId: string,
		projectId: string,
		bundleId: string
	) => Promise<ExportBundle | null>;
	/** Null when the project is not found. */
	list: (
		userId: string,
		projectId: string
	) => Promise<ExportBundleCatalog | null>;
}
