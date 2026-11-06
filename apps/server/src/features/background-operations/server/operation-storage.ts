import type {
	BackgroundOperation,
	BackgroundOperationKind,
} from "@sprite-anvil/api/background-operations";
import type { OperationProgress } from "./background-operation-lifecycle";

/** A new Background Operation as its owning feature requests it. */
export interface NewBackgroundOperation {
	id: string;
	kind: BackgroundOperationKind;
	maxAttempts: number;
	projectId: string;
	scopeSummary: string;
	scopeTargetId: string | null;
	triggeredByUserId: string;
	triggerSummary: string;
}

export interface OutboxRecord {
	backgroundOperationId: string;
	id: string;
}

/**
 * The persistent side of the lifecycle. Every change is a compare-and-set on
 * the authoritative record, so a duplicate or late delivery changes nothing:
 * a method returns false/null when the record was not in the expected state.
 * Each method that also writes an outbox record does both in one transaction.
 */
export interface OperationStorage {
	/** Pending to Cancelled directly: no executor ever started it. */
	cancelPending: (backgroundOperationId: string, now: Date) => Promise<boolean>;
	/** Cancel Requested to Cancelled for this attempt, once the executor stopped safely. */
	cancelRequested: (
		backgroundOperationId: string,
		attemptCount: number,
		now: Date
	) => Promise<boolean>;
	/** Pending to Running (Cancel Requested when a request is already recorded) for one new attempt; null when the operation is not Pending. */
	claim: (
		backgroundOperationId: string,
		now: Date
	) => Promise<BackgroundOperation | null>;
	/** Running (or Cancel Requested, when the work could not be stopped) to Completed for this attempt. */
	complete: (
		backgroundOperationId: string,
		attemptCount: number,
		resultSummary: string,
		now: Date
	) => Promise<boolean>;
	/** Running to Failed for this attempt, keeping the user-visible failure. */
	fail: (
		backgroundOperationId: string,
		attemptCount: number,
		failureSummary: string,
		now: Date
	) => Promise<boolean>;
	get: (backgroundOperationId: string) => Promise<BackgroundOperation | null>;
	/** Inserts the operation and its outbox record together; false when the id already exists. */
	insertWithOutbox: (
		operation: NewBackgroundOperation,
		outboxId: string,
		now: Date
	) => Promise<boolean>;
	listStalledPending: (olderThan: Date) => Promise<BackgroundOperation[]>;
	listStalledRunning: (heartbeatBefore: Date) => Promise<BackgroundOperation[]>;
	listUnpublishedOutbox: (limit: number) => Promise<OutboxRecord[]>;
	markOutboxPublished: (outboxId: string, now: Date) => Promise<void>;
	/** Adds a redelivery outbox record to a Pending operation and refreshes its age. */
	redeliverPendingWithOutbox: (
		backgroundOperationId: string,
		outboxId: string,
		now: Date
	) => Promise<boolean>;
	/** Records progress and a heartbeat for this running attempt. */
	reportProgress: (
		backgroundOperationId: string,
		attemptCount: number,
		progress: OperationProgress,
		now: Date
	) => Promise<boolean>;
	/** Running to Cancel Requested; the first request stamps when it was made. */
	requestCancelRunning: (
		backgroundOperationId: string,
		now: Date
	) => Promise<boolean>;
	/** Running or Cancel Requested to Pending for another attempt, with a new outbox record; the cancel request stays recorded. */
	requeueWithOutbox: (
		backgroundOperationId: string,
		attemptCount: number,
		outboxId: string,
		now: Date
	) => Promise<boolean>;
}

/** Hands one Background Operation identity to the delivery transport; the message carries nothing else. */
export interface OperationTransport {
	send: (backgroundOperationId: string) => Promise<void>;
}
