import { createHash } from "node:crypto";
import type { CreateAssetVersionIntegrityTransform } from "../src/asset-version-integrity";

// Consumer tests exercise publication and routing with a deterministic verifier port.
export const createTestAssetVersionIntegrityTransform: CreateAssetVersionIntegrityTransform =
	() => {
		const hash = createHash("sha256");
		let digest: string | undefined;
		return {
			body: new TransformStream<Uint8Array, Uint8Array>({
				transform(chunk, controller) {
					hash.update(chunk);
					controller.enqueue(chunk);
				},
				flush() {
					digest = hash.digest("hex");
				},
			}),
			getContentDigest: () => digest,
		};
	};
