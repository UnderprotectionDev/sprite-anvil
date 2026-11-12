import {
	type ObjectReader,
	readVerifiedObjectBytes,
} from "./object-file-bytes";

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
	}): Promise<boolean> =>
		(await readVerifiedObjectBytes(storage, file.objectKey, file)).status ===
		"ok";
}
