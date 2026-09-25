import { createHash } from "node:crypto";
import sharp from "sharp";

type AssetVersionContentType = "image/png" | "image/webp";

export class AssetVersionIntegrityError extends Error {
	constructor() {
		super("Asset Version content failed integrity validation");
		this.name = "AssetVersionIntegrityError";
	}
}

export class AssetVersionContentLengthError extends Error {
	constructor() {
		super("Asset Version content length mismatch");
		this.name = "AssetVersionContentLengthError";
	}
}

function invalidImage(): never {
	throw new AssetVersionIntegrityError();
}

interface ImageValidator {
	abort: () => void;
	finish: () => Promise<void>;
	write: (chunk: Uint8Array) => Promise<void>;
}

const pngSignature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const webpSignature = Uint8Array.of(82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80);

class DecodableImageValidator implements ImageValidator {
	private readonly decoder = sharp({
		animated: true,
		failOn: "warning",
	})
		.resize({ width: 1, height: 1, fit: "inside" })
		.png();
	private readonly decoderFinished: Promise<void>;
	private readonly signature: Uint8Array;
	private readonly signatureLength: number;
	private signatureVerified = false;
	private decoderError: Error | undefined;
	private didFinish = false;
	private readonly prefix = new Uint8Array(12);
	private prefixLength = 0;

	constructor(contentType: AssetVersionContentType) {
		this.signature = contentType === "image/png" ? pngSignature : webpSignature;
		this.signatureLength = this.signature.length;
		this.decoder.on("data", () => {
			// Consuming decoded chunks keeps the image decoder in flowing mode.
		});
		this.decoderFinished = new Promise((resolve) => {
			this.decoder.once("end", () => {
				this.didFinish = true;
				resolve();
			});
			this.decoder.once("error", (error: Error) => {
				this.decoderError = error;
				resolve();
			});
		});
	}

	async write(chunk: Uint8Array) {
		if (this.decoderError || this.didFinish) {
			this.abort();
			invalidImage();
		}
		this.verifySignaturePrefix(chunk);
		const write = new Promise<void>((resolve, reject) => {
			try {
				this.decoder.write(
					Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength),
					(error?: Error | null) => {
						if (error) {
							reject(error);
						} else {
							resolve();
						}
					}
				);
			} catch (error) {
				reject(error);
			}
		});

		try {
			const result = await Promise.race([
				write.then(() => "written" as const),
				this.decoderFinished.then(() => "finished" as const),
			]);
			if (result !== "written" || this.decoderError) {
				invalidImage();
			}
		} catch {
			this.abort();
			invalidImage();
		}
	}

	async finish() {
		if (!this.signatureVerified || this.decoderError || this.didFinish) {
			this.abort();
			invalidImage();
		}
		try {
			this.decoder.end();
			await this.decoderFinished;
		} catch {
			invalidImage();
		}
		if (this.decoderError || !this.didFinish) {
			invalidImage();
		}
	}

	abort() {
		if (!this.didFinish) {
			this.decoder.destroy();
		}
	}

	private verifySignaturePrefix(chunk: Uint8Array) {
		if (this.signatureVerified) {
			return;
		}
		const amount = Math.min(
			this.signatureLength - this.prefixLength,
			chunk.byteLength
		);
		this.prefix.set(chunk.subarray(0, amount), this.prefixLength);
		this.prefixLength += amount;
		if (this.prefixLength < this.signatureLength) {
			return;
		}
		const matchesSignature =
			this.signature === webpSignature
				? [0, 1, 2, 3, 8, 9, 10, 11].every(
						(index) => this.signature[index] === this.prefix[index]
					)
				: this.signature.every((byte, index) => byte === this.prefix[index]);
		if (!matchesSignature) {
			this.abort();
			invalidImage();
		}
		this.signatureVerified = true;
	}
}

export function createAssetVersionIntegrityTransform(
	contentType: AssetVersionContentType,
	expectedLength: number
) {
	const imageValidator = new DecodableImageValidator(contentType);
	const hash = createHash("sha256");
	let receivedLength = 0;
	let contentDigest: string | undefined;
	const body = new TransformStream<Uint8Array, Uint8Array>({
		async transform(chunk, controller) {
			receivedLength += chunk.byteLength;
			if (
				!Number.isSafeInteger(receivedLength) ||
				receivedLength > expectedLength
			) {
				imageValidator.abort();
				throw new AssetVersionContentLengthError();
			}
			hash.update(chunk);
			try {
				await imageValidator.write(chunk);
			} catch (error) {
				imageValidator.abort();
				throw error;
			}
			controller.enqueue(chunk);
		},
		async flush() {
			if (receivedLength !== expectedLength) {
				imageValidator.abort();
				throw new AssetVersionContentLengthError();
			}
			try {
				await imageValidator.finish();
				contentDigest = hash.digest("hex");
			} catch (error) {
				imageValidator.abort();
				throw error;
			}
		},
	});
	return {
		body,
		getContentDigest: () => contentDigest,
	};
}

export function verifyAssetVersionStream(
	body: ReadableStream<Uint8Array>,
	contentType: AssetVersionContentType,
	contentLength: number,
	contentDigest: string
) {
	const integrityStream = createAssetVersionIntegrityTransform(
		contentType,
		contentLength
	);
	const checkedBody = body.pipeThrough(integrityStream.body);
	return {
		body: checkedBody.pipeThrough(
			new TransformStream<Uint8Array, Uint8Array>({
				flush() {
					if (integrityStream.getContentDigest() !== contentDigest) {
						throw new AssetVersionIntegrityError();
					}
				},
			})
		),
	};
}
