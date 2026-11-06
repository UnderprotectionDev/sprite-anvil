import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import { cancelOutcome } from "@sprite-anvil/api/background-operations";
import type { Context } from "@sprite-anvil/api/context";
import { IdempotencyConflictError } from "@sprite-anvil/api/record-publication";
import { appRouter } from "@sprite-anvil/api/routers/index";
import {
	createBackgroundOperationLifecycle,
	PermanentOperationError,
	TransientOperationError,
} from "../background-operation-lifecycle";
import type { OperationTransport } from "../operation-storage";
import { createMemoryOperationStorage } from "./memory-operation-storage";

const userId = "user-1";
const projectId = "project-1";
const startedAt = new Date("2026-11-06T10:00:00.000Z");

function setup(
	options: {
		handler?: Parameters<
			typeof createBackgroundOperationLifecycle
		>[0]["handlers"]["export"];
		maxAttempts?: number;
		sendFails?: () => boolean;
	} = {}
) {
	const memory = createMemoryOperationStorage();
	const clock = { now: startedAt };
	memory.control.now = () => clock.now;
	const sent: string[] = [];
	const transport: OperationTransport = {
		send: (operationId) => {
			if (options.sendFails?.()) {
				return Promise.reject(new Error("transport down"));
			}
			sent.push(operationId);
			return Promise.resolve();
		},
	};
	let runs = 0;
	const lifecycle = createBackgroundOperationLifecycle({
		defaultMaxAttempts: options.maxAttempts ?? 3,
		handlers: {
			export:
				options.handler ??
				((context) => {
					runs += 1;
					return Promise.resolve(`Exported ${context.operation.scopeSummary}`);
				}),
		},
		now: () => clock.now,
		staleAfterMs: 60_000,
		storage: memory.storage,
		transport,
	});
	const apiContext = {
		backgroundOperationStore: memory.readStore,
		session: { user: { id: userId } },
	} as unknown as Context;
	return {
		clock,
		context: apiContext,
		lifecycle,
		memory,
		runs: () => runs,
		sent,
		read: (operationId: string) =>
			call(
				appRouter.backgroundOperations.get,
				{ operationId, projectId },
				{ context: apiContext }
			),
	};
}

function flush() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

const request = {
	kind: "export" as const,
	projectId,
	scopeSummary: "Export bundle for Ash Knight",
	triggerSummary: "Requested from the export panel",
	userId,
};

test("a requested operation is a persistent Pending record that can be re-read before any message is delivered", async () => {
	const { lifecycle, read, sent } = setup();
	const created = await lifecycle.enqueue(request);

	const record = await read(created.id);
	expect(sent).toEqual([]);
	expect(record).toMatchObject({
		attemptCount: 0,
		id: created.id,
		kind: "export",
		projectId,
		resultSummary: null,
		scopeSummary: "Export bundle for Ash Knight",
		status: "pending",
		triggerSummary: "Requested from the export panel",
		triggeredByUserId: userId,
	});
});

test("an operation runs to Completed and the final result is re-read from the record", async () => {
	const { lifecycle, read, runs, sent } = setup();
	const { id } = await lifecycle.enqueue(request);

	await lifecycle.publishOutbox();
	expect(sent).toEqual([id]);
	expect(await lifecycle.deliver(id)).toBe("completed");

	expect(await read(id)).toMatchObject({
		attemptCount: 1,
		progressPercent: 100,
		resultSummary: "Exported Export bundle for Ash Knight",
		status: "completed",
	});
	expect(runs()).toBe(1);
});

test("a duplicate or concurrent delivery produces one result", async () => {
	const { lifecycle, read, runs } = setup();
	const { id } = await lifecycle.enqueue(request);

	const outcomes = await Promise.all([
		lifecycle.deliver(id),
		lifecycle.deliver(id),
	]);
	expect(outcomes.sort()).toEqual(["completed", "ignored"]);
	expect(await lifecycle.deliver(id)).toBe("ignored");

	expect(runs()).toBe(1);
	expect(await read(id)).toMatchObject({
		attemptCount: 1,
		status: "completed",
	});
});

test("a repeated request with the same idempotency key returns the first operation, and other content under that key conflicts", async () => {
	const { lifecycle, memory } = setup();
	const first = await lifecycle.enqueue({ ...request, idempotencyKey: "k-1" });
	const second = await lifecycle.enqueue({ ...request, idempotencyKey: "k-1" });

	expect(second.id).toBe(first.id);
	expect(memory.outbox).toHaveLength(1);
	await expect(
		lifecycle.enqueue({
			...request,
			idempotencyKey: "k-1",
			scopeSummary: "Another scope",
		})
	).rejects.toBeInstanceOf(IdempotencyConflictError);
});

test("a transient failure is retried, and the result is a single Completed record", async () => {
	let attempts = 0;
	const { lifecycle, memory, read } = setup({
		handler: () => {
			attempts += 1;
			if (attempts === 1) {
				return Promise.reject(new TransientOperationError("Storage was busy."));
			}
			return Promise.resolve("Exported on retry");
		},
	});
	const { id } = await lifecycle.enqueue(request);

	expect(await lifecycle.deliver(id)).toBe("retrying");
	expect(await read(id)).toMatchObject({ attemptCount: 1, status: "pending" });
	expect(memory.outbox).toHaveLength(2);

	expect(await lifecycle.deliver(id)).toBe("completed");
	expect(await read(id)).toMatchObject({
		attemptCount: 2,
		resultSummary: "Exported on retry",
		status: "completed",
	});
});

test("exceeding the retry limit moves the operation to Failed with a visible result, not a leaked exception", async () => {
	const { lifecycle, read } = setup({
		handler: () => Promise.reject(new Error("ECONNRESET secret-host:5432")),
		maxAttempts: 2,
	});
	const { id } = await lifecycle.enqueue(request);

	expect(await lifecycle.deliver(id)).toBe("retrying");
	expect(await lifecycle.deliver(id)).toBe("failed");

	const record = await read(id);
	expect(record).toMatchObject({
		attemptCount: 2,
		resultSummary: null,
		status: "failed",
	});
	expect(record.failureSummary).toContain("2 attempts");
	expect(record.failureSummary).not.toContain("secret-host");
	// A failed operation is final: another delivery changes nothing.
	expect(await lifecycle.deliver(id)).toBe("ignored");
});

test("a permanent failure is not retried and shows its reason", async () => {
	const { lifecycle, read } = setup({
		handler: () =>
			Promise.reject(new PermanentOperationError("The bundle is empty.")),
	});
	const { id } = await lifecycle.enqueue(request);

	expect(await lifecycle.deliver(id)).toBe("failed");
	expect(await read(id)).toMatchObject({
		attemptCount: 1,
		failureSummary: "The bundle is empty.",
		status: "failed",
	});
});

test("an operation kind without an executor fails visibly instead of waiting forever", async () => {
	const { lifecycle, read } = setup();
	const { id } = await lifecycle.enqueue({ ...request, kind: "archive" });

	expect(await lifecycle.deliver(id)).toBe("failed");
	expect((await read(id)).failureSummary).toContain("archive");
});

test("progress reported while running is read back from the record", async () => {
	let observed: unknown = null;
	const setupResult = setup({
		handler: async (context) => {
			await context.reportProgress({ percent: 40, step: "Packing frames" });
			observed = await setupResult.read(context.operation.id);
			return "done";
		},
	});
	const { id } = await setupResult.lifecycle.enqueue(request);
	await setupResult.lifecycle.deliver(id);

	expect(observed).toMatchObject({
		progressPercent: 40,
		progressStep: "Packing frames",
		status: "running",
	});
});

test("an outbox record that was not published is redelivered, and a crash after sending still yields one result", async () => {
	let down = true;
	const { lifecycle, memory, runs, sent } = setup({ sendFails: () => down });
	const { id } = await lifecycle.enqueue(request);

	expect(await lifecycle.publishOutbox()).toEqual({ failed: 1, published: 0 });
	expect(memory.outbox[0]?.publishedAt).toBeNull();

	down = false;
	memory.control.failNextPublishMark = true;
	await expect(lifecycle.publishOutbox()).rejects.toThrow("crashed");
	expect(sent).toEqual([id]);

	// The unmarked record is sent again: two messages for one operation.
	expect(await lifecycle.publishOutbox()).toEqual({ failed: 0, published: 1 });
	expect(sent).toEqual([id, id]);
	expect(await lifecycle.publishOutbox()).toEqual({ failed: 0, published: 0 });

	await Promise.all(sent.map((operationId) => lifecycle.deliver(operationId)));
	expect(runs()).toBe(1);
});

test("reconciliation fails over a stalled running operation and redelivers a stalled pending one", async () => {
	let hang = true;
	const { clock, lifecycle, memory, read } = setup({
		handler: () => {
			if (hang) {
				hang = false;
				// The worker dies mid-run: the outcome is never reported.
				return new Promise(() => undefined);
			}
			return Promise.resolve("Recovered");
		},
		maxAttempts: 2,
	});
	const stalledRunning = await lifecycle.enqueue(request);
	const stalledPending = await lifecycle.enqueue({
		...request,
		scopeSummary: "Other export",
	});
	await lifecycle.publishOutbox();
	void lifecycle.deliver(stalledRunning.id);
	await flush();

	expect(await lifecycle.reconcile()).toEqual({
		failed: 0,
		redelivered: 0,
		requeued: 0,
	});

	clock.now = new Date(startedAt.getTime() + 120_000);
	await lifecycle.publishOutbox();
	expect(await lifecycle.reconcile()).toEqual({
		failed: 0,
		redelivered: 1,
		requeued: 1,
	});
	expect(await read(stalledRunning.id)).toMatchObject({
		attemptCount: 1,
		status: "pending",
	});
	expect(
		memory.outbox.filter((entry) => entry.publishedAt === null)
	).toHaveLength(2);

	await lifecycle.publishOutbox();
	expect(await lifecycle.deliver(stalledRunning.id)).toBe("completed");
	expect(await lifecycle.deliver(stalledPending.id)).toBe("completed");
});

test("reconciliation fails a stalled operation whose retry limit is spent", async () => {
	const { clock, lifecycle, read } = setup({
		handler: () => new Promise(() => undefined),
		maxAttempts: 1,
	});
	const { id } = await lifecycle.enqueue(request);
	void lifecycle.deliver(id);
	await flush();

	clock.now = new Date(startedAt.getTime() + 120_000);
	expect(await lifecycle.reconcile()).toMatchObject({ failed: 1 });
	const record = await read(id);
	expect(record.status).toBe("failed");
	expect(record.failureSummary).toContain("1 attempt");
});

test("an operation outside the requesting member's project is not readable", async () => {
	const { context, lifecycle } = setup();
	const { id } = await lifecycle.enqueue(request);
	const list = await call(
		appRouter.backgroundOperations.list,
		{ projectId: "other-project" },
		{ context }
	);

	expect(list.operations).toEqual([]);
	await expect(
		call(
			appRouter.backgroundOperations.get,
			{ operationId: id, projectId: "other-project" },
			{ context }
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

function cancel(
	setupResult: ReturnType<typeof setup>,
	operationId: string,
	overrides: { projectId?: string } = {}
) {
	return call(
		appRouter.backgroundOperations.cancel,
		{ operationId, projectId: overrides.projectId ?? projectId },
		{ context: setupResult.context }
	);
}

function gate() {
	let release: () => void = () => undefined;
	const promise = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { promise, release };
}

test("cancelling a Pending operation makes it Cancelled directly, and a later delivery never runs it", async () => {
	const s = setup();
	const { id } = await s.lifecycle.enqueue(request);

	expect(await cancel(s, id)).toMatchObject({
		cancelRequestedAt: startedAt.toISOString(),
		status: "cancelled",
	});
	expect(await s.read(id)).toMatchObject({ status: "cancelled" });

	await s.lifecycle.publishOutbox();
	expect(await s.lifecycle.deliver(id)).toBe("ignored");
	expect(s.runs()).toBe(0);
	expect(await s.read(id)).toMatchObject({
		attemptCount: 0,
		status: "cancelled",
	});
});

test("a Running operation moves to Cancel Requested, then Cancelled when the executor stops safely at a checkpoint", async () => {
	const hold = gate();
	let afterCheckpoint = false;
	const s = setup({
		handler: async (context) => {
			await context.reportProgress({ percent: 30, step: "Packing" });
			await hold.promise;
			await context.checkpoint();
			afterCheckpoint = true;
			return "done";
		},
	});
	const { id } = await s.lifecycle.enqueue(request);
	const delivery = s.lifecycle.deliver(id);
	await flush();

	expect(await cancel(s, id)).toMatchObject({ status: "cancel_requested" });
	// A second request is idempotent.
	expect(await cancel(s, id)).toMatchObject({
		cancelRequestedAt: startedAt.toISOString(),
		status: "cancel_requested",
	});
	expect(await s.read(id)).toMatchObject({ status: "cancel_requested" });

	hold.release();
	expect(await delivery).toBe("cancelled");
	expect(afterCheckpoint).toBe(false);
	expect(await s.read(id)).toMatchObject({
		resultSummary: null,
		status: "cancelled",
	});
	expect(await s.lifecycle.deliver(id)).toBe("ignored");
});

test("work past the irreversible boundary completes, stores the real result, and is never shown as a successful cancel", async () => {
	const hold = gate();
	const s = setup({
		handler: async () => {
			// Past the boundary: the executor no longer checks for a stop.
			await hold.promise;
			return "Deleted 12 files";
		},
	});
	const { id } = await s.lifecycle.enqueue(request);
	const delivery = s.lifecycle.deliver(id);
	await flush();
	await cancel(s, id);

	hold.release();
	expect(await delivery).toBe("completed");
	const record = await s.read(id);
	expect(record).toMatchObject({
		cancelRequestedAt: startedAt.toISOString(),
		resultSummary: "Deleted 12 files",
		status: "completed",
	});
	expect(cancelOutcome(record)).toBe("completed_despite_request");
	expect(cancelOutcome({ ...record, cancelRequestedAt: null })).toBeNull();
});

test("a transient failure after a cancel request is never a successful cancel: it retries, keeps the request visible, and ends Cancelled only at a checkpoint", async () => {
	const hold = gate();
	let attempt = 0;
	const s = setup({
		handler: async (context) => {
			attempt += 1;
			if (attempt === 1) {
				await hold.promise;
				throw new TransientOperationError("Storage was busy.");
			}
			await context.checkpoint();
			return "done";
		},
	});
	const { id } = await s.lifecycle.enqueue(request);
	const delivery = s.lifecycle.deliver(id);
	await flush();
	await cancel(s, id);

	hold.release();
	expect(await delivery).toBe("retrying");
	expect(await s.read(id)).toMatchObject({
		cancelRequestedAt: startedAt.toISOString(),
		status: "pending",
	});

	expect(await s.lifecycle.deliver(id)).toBe("cancelled");
	expect(await s.read(id)).toMatchObject({ status: "cancelled" });
});

test("a cancel-requested operation whose attempts run out fails and never claims a cancel", async () => {
	const hold = gate();
	const s = setup({
		handler: async () => {
			await hold.promise;
			throw new TransientOperationError("Storage was busy.");
		},
		maxAttempts: 1,
	});
	const { id } = await s.lifecycle.enqueue(request);
	const delivery = s.lifecycle.deliver(id);
	await flush();
	await cancel(s, id);

	hold.release();
	expect(await delivery).toBe("failed");
	const record = await s.read(id);
	expect(record).toMatchObject({ status: "failed" });
	expect(cancelOutcome(record)).toBe("failed_after_request");
});

test("cancelling a Completed or Failed operation is rejected with a descriptive error, and its result is untouched", async () => {
	const s = setup();
	const done = await s.lifecycle.enqueue(request);
	await s.lifecycle.deliver(done.id);
	const failed = await s.lifecycle.enqueue({
		...request,
		kind: "archive",
		scopeSummary: "Archive Forest Quest",
	});
	await s.lifecycle.deliver(failed.id);

	await expect(cancel(s, done.id)).rejects.toMatchObject({
		code: "CONFLICT",
		message: "This operation already completed and can no longer be cancelled.",
	});
	await expect(cancel(s, failed.id)).rejects.toMatchObject({
		code: "CONFLICT",
		message: "This operation already failed and can no longer be cancelled.",
	});
	expect(await s.read(done.id)).toMatchObject({
		cancelRequestedAt: null,
		status: "completed",
	});
});

test("a repeated cancel of a Cancelled operation is idempotent", async () => {
	const s = setup();
	const { id } = await s.lifecycle.enqueue(request);
	await cancel(s, id);

	expect(await cancel(s, id)).toMatchObject({ status: "cancelled" });
});

test("cancelling an unknown operation or one in another project is NOT_FOUND", async () => {
	const s = setup();
	const { id } = await s.lifecycle.enqueue(request);

	await expect(cancel(s, "missing")).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	await expect(
		cancel(s, id, { projectId: "other-project" })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	expect(await s.read(id)).toMatchObject({ status: "pending" });
});

test("a stalled Cancel Requested operation is retried, not cancelled, by reconciliation", async () => {
	const s = setup({ handler: () => new Promise(() => undefined) });
	const { id } = await s.lifecycle.enqueue(request);
	void s.lifecycle.deliver(id);
	await flush();
	await cancel(s, id);

	s.clock.now = new Date(startedAt.getTime() + 120_000);
	expect(await s.lifecycle.reconcile()).toMatchObject({ requeued: 1 });
	expect(await s.read(id)).toMatchObject({
		cancelRequestedAt: startedAt.toISOString(),
		status: "pending",
	});
});

test("a stalled Cancel Requested operation out of attempts fails instead of cancelling", async () => {
	const s = setup({
		handler: () => new Promise(() => undefined),
		maxAttempts: 1,
	});
	const { id } = await s.lifecycle.enqueue(request);
	void s.lifecycle.deliver(id);
	await flush();
	await cancel(s, id);

	s.clock.now = new Date(startedAt.getTime() + 120_000);
	expect(await s.lifecycle.reconcile()).toMatchObject({ failed: 1 });
	const record = await s.read(id);
	expect(record).toMatchObject({ status: "failed" });
	expect(cancelOutcome(record)).toBe("failed_after_request");
});
