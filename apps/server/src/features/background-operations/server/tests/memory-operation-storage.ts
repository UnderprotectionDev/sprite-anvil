import type {
	BackgroundOperation,
	BackgroundOperationStore,
} from "@sprite-anvil/api/background-operations";
import type {
	NewBackgroundOperation,
	OperationStorage,
	OutboxRecord,
} from "../operation-storage";

interface OutboxEntry extends OutboxRecord {
	publishedAt: Date | null;
}

/**
 * An in-memory OperationStorage with the same compare-and-set rules as the
 * database store. `failNextPublishMark` simulates a crash between sending a
 * message and recording it as published.
 */
export function createMemoryOperationStorage() {
	const operations = new Map<string, BackgroundOperation>();
	const outbox: OutboxEntry[] = [];
	const heartbeats = new Map<string, Date>();
	const control = { failNextPublishMark: false };

	function update(id: string, patch: Partial<BackgroundOperation>, now: Date) {
		const current = operations.get(id);
		if (!current) {
			return null;
		}
		const next = { ...current, ...patch, updatedAt: now.toISOString() };
		operations.set(id, next);
		return next;
	}

	const storage: OperationStorage = {
		claim(id, now) {
			const current = operations.get(id);
			if (current?.status !== "pending") {
				return Promise.resolve(null);
			}
			heartbeats.set(id, now);
			return Promise.resolve(
				update(
					id,
					{
						attemptCount: current.attemptCount + 1,
						startedAt: current.startedAt ?? now.toISOString(),
						status: "running",
					},
					now
				)
			);
		},
		complete(id, attemptCount, resultSummary, now) {
			const current = operations.get(id);
			if (
				current?.status !== "running" ||
				current.attemptCount !== attemptCount
			) {
				return Promise.resolve(false);
			}
			update(
				id,
				{
					finishedAt: now.toISOString(),
					progressPercent: 100,
					resultSummary,
					status: "completed",
				},
				now
			);
			return Promise.resolve(true);
		},
		fail(id, attemptCount, failureSummary, now) {
			const current = operations.get(id);
			if (
				current?.status !== "running" ||
				current.attemptCount !== attemptCount
			) {
				return Promise.resolve(false);
			}
			update(
				id,
				{
					failureSummary,
					finishedAt: now.toISOString(),
					status: "failed",
				},
				now
			);
			return Promise.resolve(true);
		},
		get: (id) => Promise.resolve(operations.get(id) ?? null),
		insertWithOutbox(operation: NewBackgroundOperation, outboxId, now) {
			if (operations.has(operation.id)) {
				return Promise.resolve(false);
			}
			operations.set(operation.id, {
				...operation,
				attemptCount: 0,
				createdAt: now.toISOString(),
				failureSummary: null,
				finishedAt: null,
				progressPercent: null,
				progressStep: null,
				resultSummary: null,
				startedAt: null,
				status: "pending",
				updatedAt: now.toISOString(),
			});
			outbox.push({
				id: outboxId,
				operationId: operation.id,
				publishedAt: null,
			});
			return Promise.resolve(true);
		},
		listStalledPending: (olderThan) =>
			Promise.resolve(
				[...operations.values()].filter(
					(operation) =>
						operation.status === "pending" &&
						Date.parse(operation.updatedAt) < olderThan.getTime() &&
						!outbox.some(
							(entry) =>
								entry.operationId === operation.id && entry.publishedAt === null
						)
				)
			),
		listStalledRunning: (heartbeatBefore) =>
			Promise.resolve(
				[...operations.values()].filter(
					(operation) =>
						operation.status === "running" &&
						(heartbeats.get(operation.id) ?? new Date(0)) < heartbeatBefore
				)
			),
		listUnpublishedOutbox: (limit) =>
			Promise.resolve(
				outbox
					.filter((entry) => entry.publishedAt === null)
					.slice(0, limit)
					.map(({ id, operationId }) => ({ id, operationId }))
			),
		markOutboxPublished(outboxId, now) {
			if (control.failNextPublishMark) {
				control.failNextPublishMark = false;
				return Promise.reject(new Error("crashed before recording publish"));
			}
			const entry = outbox.find((item) => item.id === outboxId);
			if (entry) {
				entry.publishedAt = now;
			}
			return Promise.resolve();
		},
		redeliverPendingWithOutbox(id, outboxId, now) {
			if (operations.get(id)?.status !== "pending") {
				return Promise.resolve(false);
			}
			update(id, {}, now);
			outbox.push({ id: outboxId, operationId: id, publishedAt: null });
			return Promise.resolve(true);
		},
		reportProgress(id, attemptCount, progress, now) {
			const current = operations.get(id);
			if (
				current?.status !== "running" ||
				current.attemptCount !== attemptCount
			) {
				return Promise.resolve(false);
			}
			heartbeats.set(id, now);
			update(
				id,
				{ progressPercent: progress.percent, progressStep: progress.step },
				now
			);
			return Promise.resolve(true);
		},
		requeueWithOutbox(id, attemptCount, outboxId, now) {
			const current = operations.get(id);
			if (
				current?.status !== "running" ||
				current.attemptCount !== attemptCount
			) {
				return Promise.resolve(false);
			}
			update(id, { status: "pending" }, now);
			outbox.push({ id: outboxId, operationId: id, publishedAt: null });
			return Promise.resolve(true);
		},
	};

	/** Reads like the API store does: authoritative record only, project-scoped. */
	const readStore: BackgroundOperationStore = {
		get: (_userId, projectId, operationId) => {
			const operation = operations.get(operationId);
			return Promise.resolve(
				operation?.projectId === projectId ? operation : null
			);
		},
		list: (_userId, projectId) =>
			Promise.resolve(
				[...operations.values()].filter(
					(operation) => operation.projectId === projectId
				)
			),
	};

	return { control, outbox, readStore, storage };
}
