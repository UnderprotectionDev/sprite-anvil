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
import { createBackgroundOperationStore } from "./features/background-operations/server/background-operation-store";
import { createDatabaseOperationStorage } from "./features/background-operations/server/database-operation-storage";
import { createBackgroundLayerLayoutStore } from "./features/background-parallax-profile/server/background-layer-layout-store";
import { createBackgroundScrollingTestStore } from "./features/background-parallax-profile/server/background-scrolling-test-store";
import { createAnimationTimingReviewStore } from "./features/character-animation-profile/server/animation-timing-review-store";
import { createDirectionalReviewStore } from "./features/character-animation-profile/server/directional-review-store";
import { createCollectionStore } from "./features/collections/server/collection-store";
import { createDatabaseDeliveryFulfilmentStorage } from "./features/delivery-fulfilment/server/database-delivery-fulfilment-storage";
import { createDatabaseFulfilmentMappingStorage } from "./features/delivery-fulfilment/server/database-fulfilment-mapping-storage";
import { createDeliveryFulfilmentStore } from "./features/delivery-fulfilment/server/delivery-fulfilment-store";
import { createFulfilmentMappingStore } from "./features/delivery-fulfilment/server/fulfilment-mapping-store";
import { createDatabaseDeliveryPlanningStorage } from "./features/delivery-planning/server/database-delivery-planning-storage";
import { createDeliveryTargetStore } from "./features/delivery-planning/server/delivery-target-store";
import { createDatabaseDeliveryRefreshLockStorage } from "./features/delivery-refresh-locks/server/database-delivery-refresh-lock-storage";
import { createDeliveryRefreshLockStore } from "./features/delivery-refresh-locks/server/delivery-refresh-lock-store";
import { createDependencyRevalidationStore } from "./features/dependency-revalidation/server/dependency-revalidation-store";
import { createDatabaseExportBundleStorage } from "./features/export-bundles/server/database-export-bundle-storage";
import { createExportBundleSourceReader } from "./features/export-bundles/server/export-bundle-source-reader";
import { createExportBundleStore } from "./features/export-bundles/server/export-bundle-store";
import { createDatabaseExportProfileStorage } from "./features/export-profiles/server/database-export-profile-storage";
import { createExportProfileStore } from "./features/export-profiles/server/export-profile-store";
import { createFamilyReadinessStore } from "./features/family-readiness/server/family-readiness-store";
import { createGameplayMetadataStore } from "./features/gameplay-metadata/server/gameplay-metadata-store";
import { createGenerationPackageStore } from "./features/generation-packages/server/generation-package-store";
import { createDatabaseHistoricalRiskNoticeStorage } from "./features/historical-rights-risk/server/database-historical-risk-notice-storage";
import { createHistoricalRiskNoticeStore } from "./features/historical-rights-risk/server/historical-risk-notice-store";
import { withHistoricalRiskDetection } from "./features/historical-rights-risk/server/rights-record-risk-detection";
import { createIconFamilyReviewStore } from "./features/icon-profile/server/icon-family-review-store";
import { createImportInboxStore } from "./features/imports/server/import-inbox-store";
import { createSourceMetadataMappingProposalStore } from "./features/imports/server/source-metadata-mapping-store";
import { createAssetFamilyComparisonStore } from "./features/object-equipment-profile/server/asset-family-comparison-store";
import { createDatabaseErasureImpactStorage } from "./features/permanent-erasure/server/database-erasure-impact-storage";
import { createErasureImpactSourceReader } from "./features/permanent-erasure/server/erasure-impact-source-reader";
import { createErasureImpactStore } from "./features/permanent-erasure/server/erasure-impact-store";
import { createOfflineConflictStore } from "./features/pixel-editor/server/offline-conflict-store";
import { createPixelEditorStore } from "./features/pixel-editor/server/pixel-editor-store";
import { createMarketingUsageReviewStore } from "./features/portrait-marketing-profile/server/marketing-usage-review-store";
import { createPortraitIdentityReviewStore } from "./features/portrait-marketing-profile/server/portrait-identity-review-store";
import { createProductionExperimentStore } from "./features/production-experiments/server/production-experiment-store";
import { createManagedSnapshotStore } from "./features/production-provenance/server/managed-snapshot-store";
import { createProductionRecipeStore } from "./features/production-recipes/server/production-recipe-store";
import { createDatabaseProjectArchiveRestoreStorage } from "./features/project-archives/server/database-project-archive-restore-storage";
import { createDatabaseProjectArchiveStorage } from "./features/project-archives/server/database-project-archive-storage";
import {
	createObjectFileCopier,
	createObjectFileRemover,
} from "./features/project-archives/server/object-file-copier";
import { createObjectFileVerifier } from "./features/project-archives/server/object-file-verifier";
import { createProjectArchiveRestoreStore } from "./features/project-archives/server/project-archive-restore-store";
import { createProjectArchiveSourceReader } from "./features/project-archives/server/project-archive-source-reader";
import { createProjectArchiveStore } from "./features/project-archives/server/project-archive-store";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createProjectAccessStore } from "./features/projects/server/project-access-store";
import { createProviderGenerationRecordStore } from "./features/provider-generation-records/server/provider-generation-record-store";
import { createSpecializedProfileContractStore } from "./features/quality-evidence/server/specialized-profile-contract-store";
import { createDatabaseReadinessPlanStorage } from "./features/readiness-plans/server/database-readiness-plan-storage";
import { createReadinessPlanStore } from "./features/readiness-plans/server/readiness-plan-store";
import { createReferenceProductionStore } from "./features/reference-production/server/reference-production-store";
import { createRightsRecordStore } from "./features/rights-evidence/server/rights-record-store";
import { createDatabaseRuntimeValidationStorage } from "./features/runtime-validation/server/database-runtime-validation-storage";
import { createRuntimeValidationStore } from "./features/runtime-validation/server/runtime-validation-store";
import { createSceneQaStore } from "./features/scene-qa-playground/server/scene-qa-store";
import { createTextureRepetitionReviewStore } from "./features/tileset-texture-profile/server/texture-repetition-review-store";
import { createTilesetAdjacencyReviewStore } from "./features/tileset-texture-profile/server/tileset-adjacency-review-store";
import { createUiStateComparisonStore } from "./features/ui-profile/server/ui-state-comparison-store";
import { createVfxAppearanceReviewStore } from "./features/vfx-profile/server/vfx-appearance-review-store";
import { createVfxSynchronizationStore } from "./features/vfx-profile/server/vfx-synchronization-store";
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
export const vfxSynchronizationStore = createVfxSynchronizationStore(db);
export const vfxAppearanceReviewStore = createVfxAppearanceReviewStore(db);
export const animationTimingReviewStore = createAnimationTimingReviewStore(db);
export const directionalReviewStore = createDirectionalReviewStore(db);
export const textureRepetitionReviewStore =
	createTextureRepetitionReviewStore(db);
export const tilesetAdjacencyReviewStore =
	createTilesetAdjacencyReviewStore(db);

import { createUiStretchTestStore } from "./features/ui-profile/server/ui-stretch-test-store";
export const uiStretchTestStore = createUiStretchTestStore(db);
export const backgroundLayerLayoutStore = createBackgroundLayerLayoutStore(db);
export const portraitIdentityReviewStore =
	createPortraitIdentityReviewStore(db);
export const uiStateComparisonStore = createUiStateComparisonStore(db);
export const iconFamilyReviewStore = createIconFamilyReviewStore(db);
export const gameplayMetadataStore = createGameplayMetadataStore(db);
export const assetFamilyStore = createAssetFamilyStore(db);
export const assetFamilyComparisonStore = createAssetFamilyComparisonStore(db);
export const familyReadinessStore = createFamilyReadinessStore(db);
export const deliveryTargetStore = createDeliveryTargetStore(
	db,
	createDatabaseDeliveryPlanningStorage(db)
);
export const dependencyRevalidationStore =
	createDependencyRevalidationStore(db);
const deliveryFulfilmentStorage = createDatabaseDeliveryFulfilmentStorage(db);
export const readinessPlanStore = createReadinessPlanStore({
	deliveryTargets: deliveryTargetStore,
	dependencies: dependencyRevalidationStore,
	familyReadiness: familyReadinessStore,
	fulfilments: deliveryFulfilmentStorage,
	storage: createDatabaseReadinessPlanStorage(db),
});
export const exportProfileStore = createExportProfileStore(
	db,
	createDatabaseExportProfileStorage(db)
);
export const collectionStore = createCollectionStore(db);
export const backgroundOperationStore = createBackgroundOperationStore(
	db,
	createDatabaseOperationStorage(db)
);
export const generationPackageStore = createGenerationPackageStore(db);
export const productionExperimentStore = createProductionExperimentStore(db);
export const productionRecipeStore = createProductionRecipeStore(db);
export const importInboxStore = createImportInboxStore(db);
export const pixelEditorStore = createPixelEditorStore(db);
export const offlineConflictStore = createOfflineConflictStore(db);
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
const persistedRightsRecordStore = createRightsRecordStore(db);
export const exportBundleStore = createExportBundleStore(db, {
	profiles: exportProfileStore,
	sourceReader: createExportBundleSourceReader({
		animationTimingReviews: animationTimingReviewStore,
		assetFamilies: assetFamilyStore,
		assetVersions: assetVersionStore,
		familyReadiness: familyReadinessStore,
		gameplayMetadata: gameplayMetadataStore,
		projectContext: projectContextStore,
		rights: persistedRightsRecordStore,
		tilesetAdjacencyReviews: tilesetAdjacencyReviewStore,
		uiStretchTests: uiStretchTestStore,
	}),
	storage: createDatabaseExportBundleStorage(db),
});
/** No backup retention schedule is published yet (OV-08), so reports claim no clean-up time. */
export const erasureImpactStore = createErasureImpactStore({
	db,
	sourceReader: createErasureImpactSourceReader(db),
	storage: createDatabaseErasureImpactStorage(db),
});
const credentialNamePattern = /SECRET|TOKEN|KEY|PASSWORD/i;
const archiveObjectStorage =
	testAssetVersionStorage ?? (r2Config ? createStorage(r2Config) : null);
export const projectArchiveStore = createProjectArchiveStore(db, {
	/** Every configured credential value; an archive holding one is refused. */
	secretValues: () =>
		Object.entries(ENV)
			.filter(
				([name, value]) =>
					credentialNamePattern.test(name) && typeof value === "string"
			)
			.map(([, value]) => value as string),
	sourceReader: createProjectArchiveSourceReader({
		assetFamilies: assetFamilyStore,
		assetRecords: assetRecordStore,
		assetVersions: assetVersionStore,
		db,
	}),
	storage: createDatabaseProjectArchiveStorage(db),
	verifyFile: archiveObjectStorage
		? createObjectFileVerifier(archiveObjectStorage)
		: undefined,
});
/** Restoring copies files, so it needs object storage; without it restore is unavailable. */
export const projectArchiveRestoreStore = archiveObjectStorage
	? createProjectArchiveRestoreStore(db, {
			archives: createDatabaseProjectArchiveStorage(db),
			files: {
				copy: createObjectFileCopier(archiveObjectStorage),
				remove: createObjectFileRemover(archiveObjectStorage),
				verify: createObjectFileVerifier(archiveObjectStorage),
			},
			storage: createDatabaseProjectArchiveRestoreStorage(db),
		})
	: undefined;
export const runtimeValidationStore = createRuntimeValidationStore(db, {
	getBundle: (userId, projectId, bundleId) =>
		exportBundleStore.get(userId, projectId, bundleId),
	storage: createDatabaseRuntimeValidationStorage(db),
});
const fulfilmentMappingStorage = createDatabaseFulfilmentMappingStorage(db);
export const fulfilmentMappingStore = createFulfilmentMappingStore({
	bundles: exportBundleStore,
	deliveryTargets: deliveryTargetStore,
	readinessPlans: readinessPlanStore,
	runtimeValidation: runtimeValidationStore,
	storage: fulfilmentMappingStorage,
});
export const deliveryFulfilmentStore = createDeliveryFulfilmentStore({
	deliveryTargets: deliveryTargetStore,
	drafts: fulfilmentMappingStorage,
	readinessPlans: readinessPlanStore,
	storage: deliveryFulfilmentStorage,
});
export const historicalRiskNoticeStore = createHistoricalRiskNoticeStore({
	bundles: exportBundleStore,
	deliveryTargets: deliveryTargetStore,
	fulfilments: deliveryFulfilmentStore,
	rights: persistedRightsRecordStore,
	storage: createDatabaseHistoricalRiskNoticeStorage(db),
});
/** Every new Rights Record revision is evaluated against past Delivery Fulfilments once saved. */
export const rightsRecordStore = withHistoricalRiskDetection(
	persistedRightsRecordStore,
	historicalRiskNoticeStore
);
export const deliveryRefreshLockStore = createDeliveryRefreshLockStore(db, {
	bundles: exportBundleStore,
	storage: createDatabaseDeliveryRefreshLockStorage(db),
});
export const managedSnapshotStore = createManagedSnapshotStore(db);
export const projectContextScopeStore = createProjectContextScopeStore(db);
export const specializedProfileContractStore =
	createSpecializedProfileContractStore(db);
export const projectAccess = createProjectAccessStore(db, projectContextStore);
export const auth = createAuth(ENV, db, desktopOrigins);

export const backgroundScrollingTestStore =
	createBackgroundScrollingTestStore(db);

export const sceneQaStore = createSceneQaStore(db);
export const marketingUsageReviewStore = createMarketingUsageReviewStore(db);
