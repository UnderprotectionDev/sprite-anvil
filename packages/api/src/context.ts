import type { Session } from "@sprite-anvil/auth";
import type { Database } from "@sprite-anvil/db";
import type { AssetFamilyStore } from "./asset-families";
import type { ProjectContextScopeStore } from "./context-scopes";
import type { ProjectAccessStore } from "./project-access-store";
import type { ProjectContextStore } from "./project-context";

export interface Context {
	assetFamilyStore: AssetFamilyStore;
	db: Database;
	projectAccess: ProjectAccessStore;
	projectContextScopeStore: ProjectContextScopeStore;
	projectContextStore: ProjectContextStore;
	session: Session | null;
}
