export type AssetVersionContentType = "image/png" | "image/webp";

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
