import type {
	BackgroundOperationKind,
	BackgroundOperationStatus,
	CancelOutcome,
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

export const cancelOutcomeMessages: Record<CancelOutcome, string> = {
	cancelled: "Cancelled. The operation stopped before it finished.",
	completed_despite_request:
		"Cancel was requested, but the work could not be stopped safely, so it completed. This is not a cancel.",
	failed_after_request:
		"Cancel was requested, but the operation failed before it could stop.",
	requested: "Cancel requested. Waiting for the operation to stop safely.",
};
