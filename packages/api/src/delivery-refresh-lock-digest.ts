import { byPath } from "./delivery-path-schemas";
import { exportBundleSha256 } from "./export-bundle-manifest";

/** Shared digest of the exact bundle/profile binding and the owned paths. */
export function deliveryRefreshLockDigest(
	lock: {
		bundleId: string;
		bundleManifestDigest: string;
		contractVersion: string;
		profileId: string;
		profileRevisionId: string;
	},
	files: { path: string; sha256: string; byteSize: number }[]
) {
	return exportBundleSha256(
		JSON.stringify({
			bundleId: lock.bundleId,
			bundleManifestDigest: lock.bundleManifestDigest,
			contractVersion: lock.contractVersion,
			files: [...files]
				.sort(byPath)
				.map((file) => [file.path, file.sha256, file.byteSize]),
			profileId: lock.profileId,
			profileRevisionId: lock.profileRevisionId,
		})
	);
}
