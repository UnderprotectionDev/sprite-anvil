import type { Session } from "@sprite-anvil/auth";
import type { Database } from "@sprite-anvil/db";
import type { AssetRecordTrackingStore } from "./asset-record-tracking";
import type { AssetRecordStore } from "./asset-records";
import type { ProjectContextScopeStore } from "./context-scopes";
import type { ProjectAccessStore } from "./project-access-store";
import type { ProjectContextStore } from "./project-context";

export interface Context {
	assetRecordStore: AssetRecordStore;
	assetRecordTrackingStore: AssetRecordTrackingStore;
	db: Database;
	projectAccess: ProjectAccessStore;
	projectContextScopeStore: ProjectContextScopeStore;
	projectContextStore: ProjectContextStore;
	session: Session | null;
}
