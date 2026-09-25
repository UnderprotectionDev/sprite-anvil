import { createAuth } from "@sprite-anvil/auth";
import { createDb } from "@sprite-anvil/db";
import { createStorage, requireR2Config } from "./cloudflare";
import { desktopOrigins, ENV } from "./env.server";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createTestAssetVersionStorage } from "./features/asset-versions/server/test-asset-version-storage";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createProjectAccessStore } from "./features/projects/server/project-access-store";
import { createProjectContextScopeStore } from "./features/visual-worlds/server/project-context-scope-store";

export const db = createDb(ENV);
export const assetFamilyStore = createAssetFamilyStore(db);
export const assetVersionStore = createAssetVersionStore(db);
export function createServerAssetVersionStorage() {
	return ENV.NODE_ENV === "test" && ENV.CONTEXT_TEST_R2_MODE === "memory"
		? createTestAssetVersionStorage()
		: createStorage(requireR2Config(ENV));
}
export const projectContextStore = createProjectContextStore(db);
export const projectContextScopeStore = createProjectContextScopeStore(db);
export const projectAccess = createProjectAccessStore(db, projectContextStore);
export const auth = createAuth(ENV, db, desktopOrigins);
