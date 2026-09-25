interface StoredAssetVersionObject {
	bytes: Uint8Array;
	contentLength: number;
	contentType: "image/png" | "image/webp";
}

const objects = new Map<string, StoredAssetVersionObject>();

export function createTestAssetVersionStorage() {
	return {
		async put(
			key: string,
			body: ReadableStream<Uint8Array>,
			contentType: "image/png" | "image/webp",
			contentLength: number
		) {
			const bytes = new Uint8Array(await new Response(body).arrayBuffer());
			const length = bytes.byteLength;
			if (length !== contentLength) {
				throw new Error("Asset Version content length mismatch");
			}
			objects.set(key, { bytes, contentLength, contentType });
		},
		get(key: string) {
			const object = objects.get(key);
			if (!object) {
				return Promise.resolve(null);
			}
			return Promise.resolve({
				body: new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(object.bytes.slice());
						controller.close();
					},
				}),
				contentLength: object.contentLength,
				contentType: object.contentType,
			});
		},
		delete(key: string) {
			return Promise.resolve().then(() => {
				objects.delete(key);
			});
		},
	};
}
