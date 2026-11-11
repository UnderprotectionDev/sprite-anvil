import type {
	DeliveryRefreshLock,
	DeliveryRefreshLockApplyInput,
	DeliveryRefreshLockCatalog,
	DeliveryRefreshLockRefreshInput,
	DeliveryRefreshLockRefreshResult,
} from "./delivery-refresh-locks";

export type DeliveryRefreshLockRejection =
	| { reason: "bundle_unavailable" }
	| { paths: string[]; reason: "decision_not_applicable" }
	| { paths: string[]; reason: "diverged_path_not_released" }
	| { reason: "lock_malformed" }
	| { reason: "lock_version_unsupported"; version: string }
	| { reason: "no_files_applied" }
	| { reason: "previous_lock_unavailable" }
	| { paths: string[]; reason: "written_path_not_expected" }
	| { paths: string[]; reason: "written_digest_mismatch" }
	| { paths: string[]; reason: "written_files_incomplete" }
	| { paths: string[]; reason: "written_path_not_in_bundle" };

export type DeliveryRefreshLockApplyResult =
	| { lock: DeliveryRefreshLock; status: "created" | "replayed" }
	| ({ status: "rejected" } & DeliveryRefreshLockRejection);

export type DeliveryRefreshLockRefreshOutcome =
	| DeliveryRefreshLockRefreshResult
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
	/** Null when the project is not found. The previous lock and its bundle are never changed. */
	refresh: (
		userId: string,
		input: DeliveryRefreshLockRefreshInput
	) => Promise<DeliveryRefreshLockRefreshOutcome | null>;
}
