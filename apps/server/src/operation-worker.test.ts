import { expect, test } from "bun:test";
import { createOperationWorker } from "./operation-worker";

test("dispatches operation identities and settles only after delivery", async () => {
	const calls: string[] = [];
	const worker = createOperationWorker({
		lifecycle: {
			reconcile: () => {
				calls.push("reconcile");
				return Promise.resolve();
			},
			publishOutbox: () => {
				calls.push("publish");
				return Promise.resolve();
			},
			deliver: (id: string) => {
				calls.push(id);
				return Promise.resolve();
			},
		},
		queue: {
			pull: async () => [
				{
					lease_id: "lease",
					body: {
						version: 3,
						kind: "background-operation",
						backgroundOperationId: "op",
					},
				},
			],
			settle: (acks: string[], retries: string[]) => {
				calls.push(JSON.stringify({ acks, retries }));
				return Promise.resolve();
			},
		},
		handleUpload: () => Promise.reject(new Error("wrong message")),
	});
	await worker.poll();
	expect(calls).toEqual([
		"reconcile",
		"publish",
		"op",
		'{"acks":["lease"],"retries":[]}',
	]);
});

test("retries a lease when delivery fails and preserves upload handling", async () => {
	const settled: unknown[] = [];
	const worker = createOperationWorker({
		lifecycle: {
			reconcile: () => Promise.resolve(),
			publishOutbox: () => Promise.resolve(),
			deliver: () => Promise.reject(new Error("database unavailable")),
		},
		queue: {
			pull: () =>
				Promise.resolve([
					{
						lease_id: "failed",
						body: JSON.stringify({
							version: 3,
							kind: "background-operation",
							backgroundOperationId: "op",
						}),
					},
					{ lease_id: "invalid", body: {} },
				]),
			settle: (acks, retries) => {
				settled.push({ acks, retries });
				return Promise.resolve();
			},
		},
		handleUpload: () => Promise.resolve(),
	});
	await worker.poll();
	expect(settled).toEqual([
		{ acks: [], retries: ["invalid"] },
		{ acks: [], retries: ["failed"] },
	]);
});

test("retries settled import cleanup before reporting a successful worker poll", async () => {
	let failure = true;
	let published = 0;
	const worker = createOperationWorker({
		lifecycle: {
			reconcile: () => Promise.resolve(),
			publishOutbox: () => {
				published += 1;
				return Promise.resolve();
			},
			deliver: () => Promise.resolve(),
		},
		reconcileManagedObjects: () =>
			failure ? Promise.reject(new Error("cleanup failed")) : Promise.resolve(),
		queue: { pull: () => Promise.resolve([]), settle: () => Promise.resolve() },
		handleUpload: () => Promise.resolve(),
	});
	await expect(worker.poll()).rejects.toThrow("cleanup failed");
	expect(published).toBe(1);
	failure = false;
	await worker.poll();
	expect(published).toBe(2);
});

test("maintenance continues while a delivery is stuck", async () => {
	let reconciliations = 0;
	const worker = createOperationWorker({
		lifecycle: {
			reconcile: () => {
				reconciliations += 1;
				return Promise.resolve();
			},
			publishOutbox: () => Promise.resolve(),
			deliver: () =>
				new Promise(() => {
					/* Intentionally stalled delivery. */
				}),
		},
		queue: {
			pull: async () => [
				{
					lease_id: "stuck",
					body: {
						version: 3,
						kind: "background-operation",
						backgroundOperationId: "op",
					},
				},
			],
			settle: () => Promise.resolve(),
		},
		handleUpload: () => Promise.resolve(),
	});
	void worker.consume();
	await worker.maintain();
	await worker.maintain();
	expect(reconciliations).toBe(2);
});

test("settles a later completed lease while an earlier delivery is stuck", async () => {
	const settled: string[] = [];
	let signal: () => void = () => {
		/* Assigned by the promise. */
	};
	const done = new Promise<void>((resolve) => {
		signal = resolve;
	});
	const worker = createOperationWorker({
		lifecycle: {
			reconcile: () => Promise.resolve(),
			publishOutbox: () => Promise.resolve(),
			deliver: (id) =>
				id === "stuck"
					? new Promise(() => {
							/* Intentionally stalled delivery. */
						})
					: Promise.resolve(),
		},
		queue: {
			pull: async () =>
				["stuck", "fast"].map((id) => ({
					lease_id: id,
					body: {
						version: 3,
						kind: "background-operation",
						backgroundOperationId: id,
					},
				})),
			settle: (acks) => {
				settled.push(...acks);
				signal();
				return Promise.resolve();
			},
		},
		handleUpload: () => Promise.resolve(),
	});
	void worker.poll();
	await Promise.race([done, new Promise((resolve) => setTimeout(resolve, 50))]);
	expect(settled).toEqual(["fast"]);
});
