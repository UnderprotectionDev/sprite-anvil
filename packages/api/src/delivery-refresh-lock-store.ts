import type {
	DeliveryRefreshLock,
	DeliveryRefreshLockApplyInput,
	DeliveryRefreshLockCatalog,
} from "./delivery-refresh-locks";

export type DeliveryRefreshLockRejection =
	| { reason: "bundle_unavailable" }
	| { paths: string[]; reason: "written_digest_mismatch" }
	| { paths: string[]; reason: "written_files_incomplete" }
	| { paths: string[]; reason: "written_path_not_in_bundle" };

export type DeliveryRefreshLockApplyResult =
	| { lock: DeliveryRefreshLock; status: "created" | "replayed" }
	| ({ status: "rejected" } & DeliveryRefreshLockRejection);

/** Authorized, project-scoped access to Delivery Refresh Locks. */
export interface DeliveryRefreshLockStore {
	/** Null when the project is not found. */
	apply: (
		userId: string,
		input: DeliveryRefreshLockApplyInput
	) => Promise<DeliveryRefreshLockApplyResult | null>;
	/** Null when the project or lock is not found. */
	get: (
		userId: string,
		projectId: string,
		lockId: string
	) => Promise<DeliveryRefreshLock | null>;
	/** Null when the project is not found. */
	list: (
		userId: string,
		projectId: string
	) => Promise<DeliveryRefreshLockCatalog | null>;
}
