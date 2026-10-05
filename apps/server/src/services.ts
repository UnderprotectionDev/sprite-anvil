import { createAuth } from "@sprite-anvil/auth";
import { createDb } from "@sprite-anvil/db";
import { createLocalTestDb } from "@sprite-anvil/db/testing";
import {
	createStorage,
	getR2StorageConfig,
	requireR2Config,
} from "./cloudflare";
import { desktopOrigins, ENV } from "./env.server";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetRecordStore } from "./features/asset-records/server/asset-record-store";
import { createAssetRecordTrackingStore } from "./features/asset-records/server/asset-record-tracking-store";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createTestAssetVersionStorage } from "./features/asset-versions/server/test-asset-version-storage";
import { createAnimationTimingReviewStore } from "./features/character-animation-profile/server/animation-timing-review-store";
import { createDirectionalReviewStore } from "./features/character-animation-profile/server/directional-review-store";
import { createCollectionStore } from "./features/collections/server/collection-store";
import { createDependencyRevalidationStore } from "./features/dependency-revalidation/server/dependency-revalidation-store";
import { createFamilyReadinessStore } from "./features/family-readiness/server/family-readiness-store";
import { createGameplayMetadataStore } from "./features/gameplay-metadata/server/gameplay-metadata-store";
import { createGenerationPackageStore } from "./features/generation-packages/server/generation-package-store";
import { createIconFamilyReviewStore } from "./features/icon-profile/server/icon-family-review-store";
import { createImportInboxStore } from "./features/imports/server/import-inbox-store";
import { createSourceMetadataMappingProposalStore } from "./features/imports/server/source-metadata-mapping-store";
import { createManagedSnapshotStore } from "./features/production-provenance/server/managed-snapshot-store";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createProjectAccessStore } from "./features/projects/server/project-access-store";
import { createProviderGenerationRecordStore } from "./features/provider-generation-records/server/provider-generation-record-store";
import { createSpecializedProfileContractStore } from "./features/quality-evidence/server/specialized-profile-contract-store";
import { createReferenceProductionStore } from "./features/reference-production/server/reference-production-store";
import { createRightsRecordStore } from "./features/rights-evidence/server/rights-record-store";
import { createProjectContextScopeStore } from "./features/visual-worlds/server/project-context-scope-store";

function usesLoopbackTestDatabase(databaseUrl: string): boolean {
	if (ENV.NODE_ENV !== "test") {
		return false;
	}
	try {
		const target = new URL(databaseUrl);
		return (
			(target.protocol === "postgres:" || target.protocol === "postgresql:") &&
			target.hostname === "127.0.0.1"
		);
	} catch {
		return false;
	}
}

export const db = usesLoopbackTestDatabase(ENV.DATABASE_URL)
	? createLocalTestDb(ENV)
	: createDb(ENV);
export const animationTimingReviewStore = createAnimationTimingReviewStore(db);
export const directionalReviewStore = createDirectionalReviewStore(db);
export const iconFamilyReviewStore = createIconFamilyReviewStore(db);
export const gameplayMetadataStore = createGameplayMetadataStore(db);
export const assetFamilyStore = createAssetFamilyStore(db);
export const familyReadinessStore = createFamilyReadinessStore(db);
export const dependencyRevalidationStore =
	createDependencyRevalidationStore(db);
export const collectionStore = createCollectionStore(db);
export const generationPackageStore = createGenerationPackageStore(db);
export const importInboxStore = createImportInboxStore(db);
export const sourceMetadataMappingProposalStore =
	createSourceMetadataMappingProposalStore(db);
export const assetVersionStore = createAssetVersionStore(db);
export const providerGenerationRecordStore =
	createProviderGenerationRecordStore(db);
export const assetRecordStore = createAssetRecordStore(db);
const r2Config = getR2StorageConfig(ENV);
const testAssetVersionStorage =
	ENV.NODE_ENV === "test" && ENV.CONTEXT_TEST_R2_MODE === "memory"
		? createTestAssetVersionStorage()
		: null;
export const assetRecordTrackingStore = createAssetRecordTrackingStore(
	db,
	testAssetVersionStorage ?? (r2Config ? createStorage(r2Config) : null)
);
export function createServerAssetVersionStorage() {
	return testAssetVersionStorage ?? createStorage(requireR2Config(ENV));
}
export const projectContextStore = createProjectContextStore(db);
export const referenceProductionStore = createReferenceProductionStore(db);
export const rightsRecordStore = createRightsRecordStore(db);
export const managedSnapshotStore = createManagedSnapshotStore(db);
export const projectContextScopeStore = createProjectContextScopeStore(db);
export const specializedProfileContractStore =
	createSpecializedProfileContractStore(db);
export const projectAccess = createProjectAccessStore(db, projectContextStore);
export const auth = createAuth(ENV, db, desktopOrigins);
