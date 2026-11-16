import type { Database } from "@sprite-anvil/db";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetRecordStore } from "./features/asset-records/server/asset-record-store";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createProjectArchiveCanonicalVerifier } from "./features/project-archives/server/project-archive-canonical-verification";
import { createProjectArchiveSourceReader } from "./features/project-archives/server/project-archive-source-reader";

export function canonicalDatabaseVerifier(db: Database) {
	return createProjectArchiveCanonicalVerifier(
		createProjectArchiveSourceReader({
			db,
			assetFamilies: createAssetFamilyStore(db),
			assetRecords: createAssetRecordStore(db),
			assetVersions: createAssetVersionStore(db),
		})
	);
}
