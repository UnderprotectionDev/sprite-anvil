import type {
	BackgroundOperation,
	BackgroundOperationKind,
} from "@sprite-anvil/api/background-operations";
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
import {
	IdempotencyConflictError,
	resolveRecordId,
} from "@sprite-anvil/api/record-publication";
import {
	OperationCancelledSignal,
	requestOperationCancel,
} from "./operation-cancellation";
import type { OperationStorage, OperationTransport } from "./operation-storage";

/** A failure worth another attempt; `message` is shown to the user. */
export class TransientOperationError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "TransientOperationError";
	}
}

/** A failure another attempt cannot fix; `message` is shown to the user. */
export class PermanentOperationError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "PermanentOperationError";
	}
}

const unexpectedFailureMessage = "The operation failed unexpectedly.";
const stalledMessage = "The operation stopped reporting progress.";
const outboxBatchSize = 100;

export interface OperationProgress {
	percent: number | null;
	step: string | null;
}

export interface OperationHandlerContext {
	/**
	 * Call at each point where the work can still be stopped safely. It throws
	 * when the user asked to cancel, which ends the operation as Cancelled.
	 * Once the work passes its irreversible boundary, stop calling it: the
	 * operation then completes and keeps its real result.
	 */
	checkpoint: () => Promise<void>;
	operation: BackgroundOperation;
	/** Records progress and a heartbeat; call it while working so a stall can be told from slow work. */
	reportProgress: (progress: OperationProgress) => Promise<void>;
}

/**
 * Does the work of one operation kind and returns the result summary the user
 * sees. A delivery can repeat and an attempt can be retried, so the handler
 * keys every output on `operation.id` and must tolerate running again.
 */
export type OperationHandler = (
	context: OperationHandlerContext
) => Promise<string>;

export type DeliveryOutcome =
	| "cancelled"
	| "completed"
	| "failed"
	| "ignored"
	| "retrying"
	| "superseded";

export interface EnqueueRequest {
	/** Same key + same content returns the first operation; no column holds it, so it derives the id. */
	idempotencyKey?: string;
	kind: BackgroundOperationKind;
	maxAttempts?: number;
	projectId: string;
	scopeSummary: string;
	scopeTargetId?: string | null;
	triggerSummary: string;
	userId: string;
}

interface LifecycleOptions {
	defaultMaxAttempts?: number;
	handlers: Partial<Record<BackgroundOperationKind, OperationHandler>>;
	now?: () => Date;
	/** A running operation without a heartbeat for this long, or a Pending one this old with no message pending, is stalled. */
	staleAfterMs?: number;
	storage: OperationStorage;
	transport: OperationTransport;
}

function attemptsText(count: number) {
	return `${count} ${count === 1 ? "attempt" : "attempts"}`;
}

function userMessage(error: unknown) {
	return error instanceof TransientOperationError ||
		error instanceof PermanentOperationError
		? error.message
		: unexpectedFailureMessage;
}

function requestDigest(request: {
	kind: string;
	projectId: string;
	scopeSummary: string;
	scopeTargetId?: string | null;
}) {
	return recordContentDigest({
		kind: request.kind,
		projectId: request.projectId,
		scopeSummary: request.scopeSummary,
		scopeTargetId: request.scopeTargetId ?? null,
	});
}

/**
 * The lifecycle of Background Operations over the authoritative record. The
 * transport only carries an operation id: every state, retry and result lives
 * in the record, so a lost, repeated or late message cannot change the
 * outcome.
 */
export function createBackgroundOperationLifecycle(options: LifecycleOptions) {
	const {
		defaultMaxAttempts = 3,
		handlers,
		now = () => new Date(),
		staleAfterMs = 5 * 60_000,
		storage,
		transport,
	} = options;

	async function sameRequest(
		existing: BackgroundOperation,
		request: EnqueueRequest
	) {
		const [stored, requested] = await Promise.all([
			requestDigest(existing),
			requestDigest(request),
		]);
		if (stored !== requested) {
			throw new IdempotencyConflictError("Background Operation");
		}
		return existing;
	}

	/** Records a new operation and its outbox record in one transaction. */
	async function enqueue(request: EnqueueRequest) {
		const id = await resolveRecordId(
			{
				kind: "background-operation",
				projectId: request.projectId,
				targetId: request.scopeTargetId ?? undefined,
				userId: request.userId,
			},
			request.idempotencyKey
		);
		if (request.idempotencyKey) {
			const existing = await storage.get(id);
			if (existing) {
				return sameRequest(existing, request);
			}
		}
		const inserted = await storage.insertWithOutbox(
			{
				id,
				kind: request.kind,
				maxAttempts: request.maxAttempts ?? defaultMaxAttempts,
				projectId: request.projectId,
				scopeSummary: request.scopeSummary,
				scopeTargetId: request.scopeTargetId ?? null,
				triggerSummary: request.triggerSummary,
				triggeredByUserId: request.userId,
			},
			crypto.randomUUID(),
			now()
		);
		const stored = await storage.get(id);
		if (!stored) {
			throw new Error("The Background Operation could not be re-read.");
		}
		// A lost race on the same key resolves to the winner's record.
		return inserted ? stored : sameRequest(stored, request);
	}

	/**
	 * Sends every unpublished outbox record. A record is marked published only
	 * after its send succeeded, so a failed or interrupted pass sends it again;
	 * the duplicate message is harmless because delivery claims the record.
	 */
	async function publishOutbox() {
		const pending = await storage.listUnpublishedOutbox(outboxBatchSize);
		let published = 0;
		let failed = 0;
		for (const record of pending) {
			try {
				// biome-ignore lint/performance/noAwaitInLoops: Records are sent in order, one at a time.
				await transport.send(record.operationId);
			} catch {
				failed += 1;
				continue;
			}
			await storage.markOutboxPublished(record.id, now());
			published += 1;
		}
		return { failed, published };
	}

	async function stopCancelled(
		operation: BackgroundOperation
	): Promise<DeliveryOutcome> {
		return (await storage.cancelRequested(
			operation.id,
			operation.attemptCount,
			now()
		))
			? "cancelled"
			: "superseded";
	}

	async function failAttempt(
		operation: BackgroundOperation,
		error: unknown
	): Promise<DeliveryOutcome> {
		if (error instanceof OperationCancelledSignal) {
			return stopCancelled(operation);
		}
		const message = userMessage(error);
		const exhausted = operation.attemptCount >= operation.maxAttempts;
		if (error instanceof PermanentOperationError) {
			return (await storage.fail(
				operation.id,
				operation.attemptCount,
				message,
				now()
			))
				? "failed"
				: "superseded";
		}
		// The user asked to stop and this attempt ended without a result: honour
		// the request instead of starting another attempt.
		if ((await storage.get(operation.id))?.status === "cancel_requested") {
			return stopCancelled(operation);
		}
		if (exhausted) {
			return (await storage.fail(
				operation.id,
				operation.attemptCount,
				`${message} It failed after ${attemptsText(operation.attemptCount)}.`,
				now()
			))
				? "failed"
				: "superseded";
		}
		return (await storage.requeueWithOutbox(
			operation.id,
			operation.attemptCount,
			crypto.randomUUID(),
			now()
		))
			? "retrying"
			: "superseded";
	}

	/** Handles one delivered message: only the delivery that claims a Pending operation runs it. */
	async function deliver(operationId: string): Promise<DeliveryOutcome> {
		const claimed = await storage.claim(operationId, now());
		if (!claimed) {
			return "ignored";
		}
		const handler = handlers[claimed.kind];
		if (!handler) {
			return failAttempt(
				claimed,
				new PermanentOperationError(
					`No executor is available for ${claimed.kind} operations.`
				)
			);
		}
		let summary: string;
		try {
			summary = await handler({
				checkpoint: async () => {
					if ((await storage.get(claimed.id))?.status === "cancel_requested") {
						throw new OperationCancelledSignal();
					}
				},
				operation: claimed,
				reportProgress: async (progress) => {
					await storage.reportProgress(
						claimed.id,
						claimed.attemptCount,
						{
							percent:
								progress.percent === null
									? null
									: Math.min(100, Math.max(0, Math.round(progress.percent))),
							step: progress.step,
						},
						now()
					);
				},
			});
		} catch (error) {
			return failAttempt(claimed, error);
		}
		return (await storage.complete(
			claimed.id,
			claimed.attemptCount,
			summary,
			now()
		))
			? "completed"
			: "superseded";
	}

	/**
	 * Finds operations that stopped moving. A running one with no recent
	 * heartbeat counts as a failed attempt (retried or Failed at the limit); a
	 * Pending one with no message on its way is sent again.
	 */
	async function reconcile() {
		const cutoff = new Date(now().getTime() - staleAfterMs);
		let requeued = 0;
		let failed = 0;
		let redelivered = 0;
		const stalledRunning = await storage.listStalledRunning(cutoff);
		for (const operation of stalledRunning) {
			// biome-ignore lint/performance/noAwaitInLoops: Each operation settles before the next is touched.
			const outcome = await failAttempt(
				operation,
				new TransientOperationError(stalledMessage)
			);
			if (outcome === "retrying") {
				requeued += 1;
			} else if (outcome === "failed") {
				failed += 1;
			}
		}
		const stalledPending = await storage.listStalledPending(cutoff);
		for (const operation of stalledPending) {
			// biome-ignore lint/performance/noAwaitInLoops: Each operation settles before the next is touched.
			const sent = await storage.redeliverPendingWithOutbox(
				operation.id,
				crypto.randomUUID(),
				now()
			);
			if (sent) {
				redelivered += 1;
			}
		}
		return { failed, redelivered, requeued };
	}

	/** Records a cancel request; the caller has already checked the user may act on this operation. */
	function requestCancel(operationId: string) {
		return requestOperationCancel(storage, operationId, now());
	}

	return { deliver, enqueue, publishOutbox, reconcile, requestCancel };
}
