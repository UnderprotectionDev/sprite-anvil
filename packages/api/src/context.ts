import type { Session } from "@sprite-anvil/auth";
import type { Database } from "@sprite-anvil/db";
import type { AssetFamilyStore } from "./asset-families";
import type { AssetRecordTrackingStore } from "./asset-record-tracking";
import type { AssetRecordStore } from "./asset-records";
import type { AssetVersionStore } from "./asset-versions";
import type { CollectionStore } from "./collections";
import type { ProjectContextScopeStore } from "./context-scopes";
import type { ProjectAccessStore } from "./project-access-store";
import type { ProjectContextStore } from "./project-context";
import type { ReferenceProductionStore } from "./reference-production";

export interface Context {
	assetFamilyStore: AssetFamilyStore;
	assetRecordStore: AssetRecordStore;
	assetRecordTrackingStore: AssetRecordTrackingStore;
	assetVersionStore: AssetVersionStore;
	collectionStore: CollectionStore;
	db: Database;
	projectAccess: ProjectAccessStore;
	projectContextScopeStore: ProjectContextScopeStore;
	projectContextStore: ProjectContextStore;
	referenceProductionStore?: ReferenceProductionStore;
	session: Session | null;
	verifyAssetVersionContent?: (
		userId: string,
		projectId: string,
		assetVersionId: string
	) => Promise<boolean>;
}
