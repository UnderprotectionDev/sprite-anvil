import { createHash } from "node:crypto";

class ObjectIntegrityError extends Error {}

/** Reads one stored object; the shared object storage's `get` has this shape. */
export interface ObjectReader {
	get: (
		key: string
	) => Promise<{ body: ReadableStream<Uint8Array> | null } | null>;
}

/** Checks each chunk and only finishes the stream after the complete digest matches. */
export async function* verifiedObjectChunks(
	storage: ObjectReader,
	key: string,
	expected: { byteSize: number; sha256: string }
) {
	const object = await storage.get(key);
	if (!object?.body) {
		throw new ObjectIntegrityError("Archived file is missing.");
	}
	const reader = object.body.getReader();
	const hash = createHash("sha256");
	let size = 0;
	try {
		while (true) {
			// biome-ignore lint/performance/noAwaitInLoops: Each chunk depends on the preceding stream read.
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			size += value.byteLength;
			if (size > expected.byteSize) {
				throw new ObjectIntegrityError("Archived file size does not match.");
			}
			hash.update(value);
			yield value;
		}
		if (size !== expected.byteSize || hash.digest("hex") !== expected.sha256) {
			throw new ObjectIntegrityError("Archived file digest does not match.");
		}
	} finally {
		try {
			await reader.cancel();
		} finally {
			reader.releaseLock();
		}
	}
}

export async function verifyObject(
	storage: ObjectReader,
	key: string,
	expected: { byteSize: number; sha256: string }
): Promise<boolean> {
	try {
		for await (const _chunk of verifiedObjectChunks(storage, key, expected)) {
			/* verify without retaining bytes */
		}
		return true;
	} catch (error) {
		if (error instanceof ObjectIntegrityError) {
			return false;
		}
		throw error;
	}
}

/** Produces a backpressured stream and records whether the final integrity check passed. */
export function verifiedObjectStream(
	storage: ObjectReader,
	key: string,
	expected: { byteSize: number; sha256: string }
) {
	const chunks = verifiedObjectChunks(storage, key, expected);
	let complete = false;
	const body = new ReadableStream<Uint8Array>(
		{
			async pull(controller) {
				try {
					const next = await chunks.next();
					if (next.done) {
						complete = true;
						controller.close();
					} else {
						controller.enqueue(next.value);
					}
				} catch (error) {
					controller.error(error);
				}
			},
			async cancel() {
				await chunks.return(undefined);
			},
		},
		{ highWaterMark: 0 }
	);
	return {
		body,
		isComplete: () => complete,
		cancel: () => chunks.return(undefined),
	};
}
