import { sha256Hex } from "@sprite-anvil/api/export-bundle-verification";

/** Reads one stored object; the shared object storage's `get` has this shape. */
interface ObjectReader {
	get: (
		key: string
	) => Promise<{ body: ReadableStream<Uint8Array> | null } | null>;
}

/**
 * Confirms a stored file still has the recorded size and SHA-256 before it
 * is pinned in an archive. A missing object, a size change or a digest change
 * all fail the check.
 */
export function createObjectFileVerifier(storage: ObjectReader) {
	return async (file: {
		byteSize: number;
		objectKey: string;
		sha256: string;
	}): Promise<boolean> => {
		const object = await storage.get(file.objectKey);
		if (!object?.body) {
			return false;
		}
		const bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
		return (
			bytes.byteLength === file.byteSize &&
			(await sha256Hex(bytes)) === file.sha256
		);
	};
}
