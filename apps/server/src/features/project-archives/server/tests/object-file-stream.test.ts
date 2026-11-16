import { expect, test } from "bun:test";
import { sha256Hex } from "@sprite-anvil/api/export-bundle-verification";
import { createObjectFileCopier } from "../object-file-copier";
import { createObjectFileVerifier } from "../object-file-verifier";

async function fixture(
	options: { corruptRead?: number; failPut?: boolean; cancelPut?: boolean } = {}
) {
	const bytes = new Uint8Array(64 * 1024).fill(42);
	const sha256 = await sha256Hex(bytes);
	let reads = 0;
	let secondChunks = 0;
	let secondCancelled = false;
	let chunksAtPutStart = -1;
	let writes = 0;
	const storage = {
		get: () => {
			reads += 1;
			const read = reads;
			let offset = 0;
			return Promise.resolve({
				body: new ReadableStream<Uint8Array>(
					{
						pull(controller) {
							if (offset >= bytes.length) {
								controller.close();
								return;
							}
							const chunk = bytes.slice(offset, offset + 1024);
							if (options.corruptRead === read && offset === 0) {
								chunk[0] = 0;
							}
							if (read === 2) {
								secondChunks += 1;
							}
							offset += chunk.length;
							controller.enqueue(chunk);
						},
						cancel() {
							if (read === 2) {
								secondCancelled = true;
							}
						},
					},
					{ highWaterMark: 0 }
				),
			});
		},
		put: async (_key: string, stream: ReadableStream<Uint8Array>) => {
			writes += 1;
			chunksAtPutStart = secondChunks;
			const reader = stream.getReader();
			if (options.cancelPut) {
				await reader.read();
				await reader.cancel();
				throw new Error("cancelled");
			}
			if (options.failPut) {
				await reader.read();
				throw new Error("put failed");
			}
			// biome-ignore lint/performance/noAwaitInLoops: A stream must be consumed in order.
			while (!(await reader.read()).done) {
				/* consume without buffering */
			}
		},
	};
	return {
		storage,
		file: {
			from: "source",
			to: "target",
			objectKey: "source",
			byteSize: bytes.length,
			sha256,
			contentType: "image/png",
		},
		counts: () => ({
			reads,
			secondChunks,
			secondCancelled,
			chunksAtPutStart,
			writes,
		}),
	};
}

test("copies a verified object in two streaming passes with backpressure", async () => {
	const { storage, file, counts } = await fixture();
	await createObjectFileCopier(storage)(file);
	expect(counts()).toMatchObject({
		reads: 2,
		writes: 1,
		chunksAtPutStart: 0,
		secondChunks: 64,
	});
});

test("rejects corrupt preflight and detects a changed second read", async () => {
	const first = await fixture({ corruptRead: 1 });
	expect(await createObjectFileVerifier(first.storage)(first.file)).toBe(false);
	const copyFirst = await fixture({ corruptRead: 1 });
	await expect(
		createObjectFileCopier(copyFirst.storage)(copyFirst.file)
	).rejects.toThrow();
	expect(copyFirst.counts().writes).toBe(0);
	const second = await fixture({ corruptRead: 2 });
	await expect(
		createObjectFileCopier(second.storage)(second.file)
	).rejects.toThrow();
});

test("cancels source reads on failed or cancelled PUT without deleting a possibly owned target", async () => {
	for (const options of [{ failPut: true }, { cancelPut: true }]) {
		// biome-ignore lint/performance/noAwaitInLoops: Exercise each failure case separately.
		const { storage, file, counts } = await fixture(options);
		await expect(createObjectFileCopier(storage)(file)).rejects.toThrow();
		expect(counts().secondCancelled).toBe(true);
		expect(counts().secondChunks).toBeLessThan(64);
	}
});

test("propagates storage outages instead of classifying them as corrupt content", async () => {
	const { file } = await fixture();
	const unavailable = {
		get: () => Promise.reject(new Error("storage offline")),
	};
	await expect(createObjectFileVerifier(unavailable)(file)).rejects.toThrow(
		"storage offline"
	);
});
