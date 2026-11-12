import { sha256Hex } from "@sprite-anvil/api/export-bundle-verification";

/** Reads one stored object; the shared object storage's `get` has this shape. */
export interface ObjectReader {
	get: (
		key: string
	) => Promise<{ body: ReadableStream<Uint8Array> | null } | null>;
}

/**
 * Reads one stored object and checks its size and SHA-256. A missing object,
 * a size change and a digest change are each reported, never thrown.
 */
export async function readVerifiedObjectBytes(
	storage: ObjectReader,
	key: string,
	expected: { byteSize: number; sha256: string }
): Promise<
	| { bytes: Uint8Array; status: "ok" }
	| { status: "mismatch" }
	| { status: "missing" }
> {
	const object = await storage.get(key);
	if (!object?.body) {
		return { status: "missing" };
	}
	const bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
	if (
		bytes.byteLength !== expected.byteSize ||
		(await sha256Hex(bytes)) !== expected.sha256
	) {
		return { status: "mismatch" };
	}
	return { bytes, status: "ok" };
}
