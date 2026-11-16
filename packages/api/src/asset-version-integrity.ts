export type AssetVersionContentType = "image/png" | "image/webp";

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

export type CreateAssetVersionIntegrityTransform = (
	contentType: AssetVersionContentType,
	expectedLength: number
) => {
	body: TransformStream<Uint8Array, Uint8Array>;
	getContentDigest: () => string | undefined;
};

export type VerifyAssetVersionStream = (
	body: ReadableStream<Uint8Array>,
	contentType: AssetVersionContentType,
	contentLength: number,
	contentDigest: string
) => { body: ReadableStream<Uint8Array> };
