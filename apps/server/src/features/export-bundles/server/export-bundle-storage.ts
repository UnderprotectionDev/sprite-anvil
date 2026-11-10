export interface StoredExportBundle {
	adapterVersion: string | null;
	contextRevisionId: string;
	contractVersion: string;
	createdAt: Date;
	createdByUserId: string;
	deliveryTargetRevisionId: string | null;
	id: string;
	manifestDigest: string;
	profileId: string;
	profileRevisionId: string;
	projectId: string;
	/** Digest of the create request, so a repeated key with other content is a conflict. */
	requestDigest: string;
}

export interface StoredExportBundleFile {
	assetVersionId: string | null;
	byteSize: number;
	/** Text of a generated file; null for an asset file kept in storage. */
	content: string | null;
	path: string;
	sha256: string;
}

export type InsertExportBundleResult =
	| { status: "inserted" }
	/** The bundle id already exists, or the files could not be written together. */
	| { status: "conflict" };

/** The persistent side of Export Bundles. Bundles and their files are only ever inserted. */
export interface ExportBundleStorage {
	findBundle: (
		projectId: string,
		bundleId: string
	) => Promise<{
		bundle: StoredExportBundle;
		files: StoredExportBundleFile[];
	} | null>;
	/** The id the movable latest-bundle marker points at. */
	findLatestBundleId: (projectId: string) => Promise<string | null>;
	/** Writes the bundle, all of its files and the latest marker in one transaction, or none of them. */
	insertBundle: (
		bundle: StoredExportBundle,
		files: StoredExportBundleFile[]
	) => Promise<InsertExportBundleResult>;
	/** Oldest first. */
	listBundles: (projectId: string) => Promise<StoredExportBundle[]>;
}
