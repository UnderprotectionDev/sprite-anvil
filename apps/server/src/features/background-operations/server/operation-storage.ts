import type {
	BackgroundOperation,
	BackgroundOperationKind,
} from "@sprite-anvil/api/background-operations";

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
	id: string;
	operationId: string;
}

/**
 * The persistent side of the lifecycle. Every change is a compare-and-set on
 * the authoritative record, so a duplicate or late delivery changes nothing:
 * a method returns false/null when the record was not in the expected state.
 * Each method that also writes an outbox record does both in one transaction.
 */
export interface OperationStorage {
	/** Pending to Running for one new attempt; null when the operation is not Pending. */
	claim: (
		operationId: string,
		now: Date
	) => Promise<BackgroundOperation | null>;
	/** Running to Completed for this attempt. */
	complete: (
		operationId: string,
		attemptCount: number,
		resultSummary: string,
		now: Date
	) => Promise<boolean>;
	/** Running to Failed for this attempt, keeping the user-visible failure. */
	fail: (
		operationId: string,
		attemptCount: number,
		failureSummary: string,
		now: Date
	) => Promise<boolean>;
	get: (operationId: string) => Promise<BackgroundOperation | null>;
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
		operationId: string,
		outboxId: string,
		now: Date
	) => Promise<boolean>;
	/** Records progress and a heartbeat for this running attempt. */
	reportProgress: (
		operationId: string,
		attemptCount: number,
		progress: { percent: number | null; step: string | null },
		now: Date
	) => Promise<boolean>;
	/** Running to Pending for another attempt, with a new outbox record. */
	requeueWithOutbox: (
		operationId: string,
		attemptCount: number,
		outboxId: string,
		now: Date
	) => Promise<boolean>;
}

/** Hands one operation id to the delivery transport; the message carries nothing else. */
export interface OperationTransport {
	send: (operationId: string) => Promise<void>;
}
