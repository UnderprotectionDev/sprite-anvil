interface StoredAssetVersionObject {
	bytes: Uint8Array;
	contentLength: number;
	contentType: "application/octet-stream" | "image/png" | "image/webp";
}

const objects = new Map<string, StoredAssetVersionObject>();

export function createTestAssetVersionStorage() {
	return {
		async put(
			key: string,
			body: ReadableStream<Uint8Array>,
			contentType: "application/octet-stream" | "image/png" | "image/webp",
			contentLength?: number
		) {
			const bytes = new Uint8Array(await new Response(body).arrayBuffer());
			const length = bytes.byteLength;
			if (contentLength !== undefined && length !== contentLength) {
				throw new Error("Asset Version content length mismatch");
			}
			objects.set(key, { bytes, contentLength: length, contentType });
		},
		get(key: string, range?: { offset: number; length: number }) {
			const object = objects.get(key);
			if (!object) {
				return Promise.resolve(null);
			}
			const bytes = range
				? object.bytes.slice(range.offset, range.offset + range.length)
				: object.bytes.slice();
			return Promise.resolve({
				body: new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(bytes);
						controller.close();
					},
				}),
				contentLength: bytes.length,
				contentType: object.contentType,
			});
		},
		list(prefix: string) {
			return Promise.resolve(
				[...objects.keys()].filter((key) => key.startsWith(prefix))
			);
		},
		delete(key: string) {
			return Promise.resolve().then(() => {
				objects.delete(key);
			});
		},
	};
}
