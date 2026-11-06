import type {
	BackgroundOperationKind,
	BackgroundOperationStatus,
} from "@sprite-anvil/api/background-operations";

export const statusLabels: Record<BackgroundOperationStatus, string> = {
	cancel_requested: "Cancel Requested",
	cancelled: "Cancelled",
	completed: "Completed",
	failed: "Failed",
	pending: "Pending",
	running: "Running",
};

export const kindLabels: Record<BackgroundOperationKind, string> = {
	archive: "Archive",
	deletion: "Deletion",
	export: "Export",
	restore: "Restore",
	verification: "Verification",
};

export function attemptText(attemptCount: number, maxAttempts: number) {
	return `Attempt ${Math.max(attemptCount, 1)} of ${maxAttempts}`;
}
