import { sha256Hex } from "@sprite-anvil/api/export-bundle-verification";

type StoredContentType =
	| "application/octet-stream"
	| "image/png"
	| "image/webp";

/** The shared object storage's `get` and `put` have this shape. */
interface ObjectStorage {
	get: (
		key: string
	) => Promise<{ body: ReadableStream<Uint8Array> | null } | null>;
	put: (
		key: string,
		body: ReadableStream<Uint8Array>,
		contentType: StoredContentType,
		contentLength?: number
	) => Promise<void>;
}

function storedContentType(contentType: string | null): StoredContentType {
	return contentType === "image/png" || contentType === "image/webp"
		? contentType
		: "application/octet-stream";
}

/**
 * Copies one archived file to its new location in the restored project. The
 * bytes are read, checked against the archived size and SHA-256, and only
 * then written, so a file that rotted since the archive was made is never
 * copied under a digest it no longer has. The source object is left alone.
 */
export function createObjectFileCopier(storage: ObjectStorage) {
	return async (file: {
		byteSize: number;
		contentType: string | null;
		from: string;
		sha256: string;
		to: string;
	}): Promise<void> => {
		const object = await storage.get(file.from);
		if (!object?.body) {
			throw new Error(`The archived file ${file.from} is missing.`);
		}
		const bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
		if (
			bytes.byteLength !== file.byteSize ||
			(await sha256Hex(bytes)) !== file.sha256
		) {
			throw new Error(
				`The archived file ${file.from} no longer matches its digest.`
			);
		}
		const { body } = new Response(bytes);
		if (!body) {
			throw new Error("The restored file could not be streamed.");
		}
		await storage.put(
			file.to,
			body,
			storedContentType(file.contentType),
			bytes.byteLength
		);
	};
}
