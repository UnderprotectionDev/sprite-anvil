import { z } from "zod";

const idSchema = z.string().trim().min(1).max(128);

export const backgroundOperationKinds = [
	"archive",
	"restore",
	"export",
	"verification",
	"deletion",
] as const;

export const backgroundOperationStatuses = [
	"pending",
	"running",
	"completed",
	"failed",
	"cancel_requested",
	"cancelled",
] as const;

export type BackgroundOperationKind = (typeof backgroundOperationKinds)[number];
export type BackgroundOperationStatus =
	(typeof backgroundOperationStatuses)[number];

/** Statuses an operation never leaves: its result is final. */
export const finalBackgroundOperationStatuses = [
	"completed",
	"failed",
	"cancelled",
] as const satisfies readonly BackgroundOperationStatus[];

/** Allowed status changes. Cancellation itself is delivered by Safe Cancellation; the states are part of the record. */
const transitions: Record<
	BackgroundOperationStatus,
	readonly BackgroundOperationStatus[]
> = {
	pending: ["running", "cancel_requested", "cancelled", "failed"],
	running: ["pending", "completed", "failed", "cancel_requested"],
	cancel_requested: ["pending", "cancelled", "completed", "failed"],
	completed: [],
	failed: [],
	cancelled: [],
};

export function canTransitionBackgroundOperation(
	from: BackgroundOperationStatus,
	to: BackgroundOperationStatus
) {
	return transitions[from].includes(to);
}

export function isBackgroundOperationActive(status: BackgroundOperationStatus) {
	return !(finalBackgroundOperationStatuses as readonly string[]).includes(
		status
	);
}

/** Only a Pending or Running operation takes a new cancel request; every other status already has its answer. */
export function canRequestCancel(status: BackgroundOperationStatus) {
	return status === "pending" || status === "running";
}

/** An action that has not answered within this time shows its progress (OPS-05). */
export const operationProgressDelayMs = 1000;

export const backgroundOperationSchema = z
	.object({
		id: idSchema,
		projectId: idSchema,
		kind: z.enum(backgroundOperationKinds),
		scopeSummary: z.string().min(1).max(500),
		scopeTargetId: idSchema.nullable(),
		triggerSummary: z.string().min(1).max(500),
		triggeredByUserId: idSchema,
		status: z.enum(backgroundOperationStatuses),
		attemptCount: z.number().int().min(0),
		maxAttempts: z.number().int().min(1),
		progressPercent: z.number().int().min(0).max(100).nullable(),
		progressStep: z.string().max(200).nullable(),
		resultSummary: z.string().max(1000).nullable(),
		failureSummary: z.string().max(1000).nullable(),
		createdAt: z.string().datetime(),
		updatedAt: z.string().datetime(),
		startedAt: z.string().datetime().nullable(),
		finishedAt: z.string().datetime().nullable(),
		cancelRequestedAt: z.string().datetime().nullable(),
	})
	.strict();

export type BackgroundOperation = z.infer<typeof backgroundOperationSchema>;

/**
 * Progress is shown once an active operation has waited at least the delay
 * since it was requested; an operation that answers sooner shows none.
 */
export function shouldShowOperationProgress(
	operation: Pick<BackgroundOperation, "createdAt" | "status">,
	nowMs: number
) {
	return (
		isBackgroundOperationActive(operation.status) &&
		nowMs - Date.parse(operation.createdAt) >= operationProgressDelayMs
	);
}

/**
 * What the user is told about a cancel request. A request is never a
 * successful cancel by itself: only the Cancelled status is, and an operation
 * that finished anyway reports its real result.
 */
export type CancelOutcome =
	| "cancelled"
	| "completed_despite_request"
	| "failed_after_request"
	| "requested";

export function cancelOutcome(
	operation: Pick<BackgroundOperation, "cancelRequestedAt" | "status">
): CancelOutcome | null {
	switch (operation.status) {
		case "cancelled":
			return "cancelled";
		case "cancel_requested":
			return "requested";
		case "completed":
			return operation.cancelRequestedAt ? "completed_despite_request" : null;
		case "failed":
			return operation.cancelRequestedAt ? "failed_after_request" : null;
		default:
			return null;
	}
}

export const backgroundOperationListInputSchema = z
	.object({ projectId: idSchema })
	.strict();

export const backgroundOperationCancelInputSchema = z
	.object({ id: idSchema, projectId: idSchema })
	.strict();

export const backgroundOperationListSchema = z
	.object({ operations: z.array(backgroundOperationSchema) })
	.strict();

export type CancelRequestResult =
	| { operation: BackgroundOperation; outcome: "accepted" }
	| { operation: BackgroundOperation; outcome: "finished" }
	| { outcome: "not_found" };

/** Authorized, project-scoped access to the authoritative record. Other writes are made by the owning features through the lifecycle. */
export interface BackgroundOperationStore {
	list: (
		userId: string,
		projectId: string
	) => Promise<BackgroundOperation[] | null>;
	/** Asks to cancel: accepted (idempotently) while the operation is active or already Cancelled, `finished` once it Completed or Failed. */
	requestCancel: (
		userId: string,
		projectId: string,
		backgroundOperationId: string
	) => Promise<CancelRequestResult>;
}
