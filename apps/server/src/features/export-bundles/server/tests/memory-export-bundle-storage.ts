import type {
	ExportBundleStorage,
	StoredExportBundle,
	StoredExportBundleFile,
} from "../export-bundle-storage";

/** An in-memory ExportBundleStorage with the same all-or-nothing insert as the database store. */
export function createMemoryExportBundleStorage(): ExportBundleStorage {
	const bundles = new Map<
		string,
		{ bundle: StoredExportBundle; files: StoredExportBundleFile[] }
	>();
	const markers = new Map<string, string>();

	return {
		findBundle: (projectId, bundleId) => {
			const found = bundles.get(bundleId);
			return Promise.resolve(
				found?.bundle.projectId === projectId ? structuredClone(found) : null
			);
		},
		findLatestBundleId: (projectId) =>
			Promise.resolve(markers.get(projectId) ?? null),
		insertBundle: (bundle, files) => {
			if (bundles.has(bundle.id)) {
				return Promise.resolve({ status: "conflict" });
			}
			bundles.set(bundle.id, structuredClone({ bundle, files }));
			markers.set(bundle.projectId, bundle.id);
			return Promise.resolve({ status: "inserted" });
		},
		listBundles: (projectId) =>
			Promise.resolve(
				[...bundles.values()]
					.map((entry) => entry.bundle)
					.filter((bundle) => bundle.projectId === projectId)
			),
	};
}
