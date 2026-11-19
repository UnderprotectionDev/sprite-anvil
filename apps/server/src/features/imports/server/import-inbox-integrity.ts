import { createHash } from "node:crypto";
import { ImportInboxContentLengthError } from "./import-inbox-content-length-error";
import { ImportInboxIntegrityError } from "./import-inbox-integrity-error";

export function createImportInboxIntegrityTransform(expectedLength: number) {
	let contentLength = 0;
	let sha256: string | null = null;
	const hash = createHash("sha256");
	const body = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			contentLength += chunk.byteLength;
			if (contentLength > expectedLength) {
				throw new ImportInboxContentLengthError();
			}
			hash.update(chunk);
			controller.enqueue(chunk);
		},
		flush() {
			if (contentLength !== expectedLength) {
				throw new ImportInboxContentLengthError();
			}
			sha256 = hash.digest("hex");
		},
	});
	return {
		body,
		getSha256: () => sha256,
	};
}

export function verifyImportInboxStream(
	body: ReadableStream<Uint8Array>,
	expectedLength: number,
	expectedSha256: string
) {
	const integrity = createImportInboxIntegrityTransform(expectedLength);
	return body.pipeThrough(integrity.body).pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			flush() {
				if (integrity.getSha256() !== expectedSha256) {
					throw new ImportInboxIntegrityError();
				}
			},
		})
	);
}
