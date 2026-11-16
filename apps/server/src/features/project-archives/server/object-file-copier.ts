import {
	type ObjectReader,
	verifiedObjectStream,
	verifyObject,
} from "./object-file-bytes";

type StoredContentType =
	| "application/octet-stream"
	| "image/png"
	| "image/webp";

/** The shared object storage's `get` and `put` have this shape. */
interface ObjectStorage extends ObjectReader {
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
		if (!(await verifyObject(storage, file.from, file))) {
			throw new Error(
				"The archived file is missing or no longer matches its digest."
			);
		}
		const { body, isComplete, cancel } = verifiedObjectStream(
			storage,
			file.from,
			file
		);
		try {
			await storage.put(
				file.to,
				body,
				storedContentType(file.contentType),
				file.byteSize
			);
			if (!isComplete()) {
				throw new Error(
					"The restored file stream did not complete verification."
				);
			}
		} catch (error) {
			await cancel().catch(() => undefined);
			throw error;
		}
	};
}

/** Deletes one stored object; used to undo the copies of a restore that did not complete. */
export function createObjectFileRemover(storage: {
	delete: (key: string) => Promise<void>;
}) {
	return (key: string): Promise<void> => storage.delete(key);
}
