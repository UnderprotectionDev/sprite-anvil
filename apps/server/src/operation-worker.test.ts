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
	expect(settled).toEqual([{ acks: [], retries: ["failed", "invalid"] }]);
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
