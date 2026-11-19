import { createFamilyReadinessStore } from "@sprite-anvil/api/family-readiness-store";
import { createAuth } from "@sprite-anvil/auth";
import { createDb } from "@sprite-anvil/db";
import { project } from "@sprite-anvil/db/schema/project";
import { createLocalTestDb } from "@sprite-anvil/db/testing";
import { eq } from "drizzle-orm";
import {
	createQueue,
	createStorage,
	getR2StorageConfig,
	requireCloudflareConfig,
	requireR2Config,
} from "./cloudflare";
import { createDatabaseManagedObjectReservations } from "./database-managed-object-reservations";
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
import { createGameplayMetadataStore } from "./features/gameplay-metadata/server/gameplay-metadata-store";
import { createGenerationPackageStore } from "./features/generation-packages/server/generation-package-store";
import { createDatabaseHistoricalRiskNoticeStorage } from "./features/historical-rights-risk/server/database-historical-risk-notice-storage";
import { createHistoricalRiskNoticeStore } from "./features/historical-rights-risk/server/historical-risk-notice-store";
import { withHistoricalRiskDetection } from "./features/historical-rights-risk/server/rights-record-risk-detection";
import { createIconFamilyReviewStore } from "./features/icon-profile/server/icon-family-review-store";
import { createImportInboxStore } from "./features/imports/server/import-inbox-store";
import { createSourceMetadataMappingProposalStore } from "./features/imports/server/source-metadata-mapping-store";
import { createAssetFamilyComparisonStore } from "./features/object-equipment-profile/server/asset-family-comparison-store";
import { createDatabaseErasureDeletionStorage } from "./features/permanent-erasure/server/database-erasure-deletion-storage";
import { createDatabaseErasureImpactStorage } from "./features/permanent-erasure/server/database-erasure-impact-storage";
import { createDeletionReceiptStore } from "./features/permanent-erasure/server/deletion-receipt-store";
import { createErasureImpactSourceReader } from "./features/permanent-erasure/server/erasure-impact-source-reader";
import { createErasureImpactStore } from "./features/permanent-erasure/server/erasure-impact-store";
import { createOfflineConflictStore } from "./features/pixel-editor/server/offline-conflict-store";
import { createPixelEditorStore } from "./features/pixel-editor/server/pixel-editor-store";
import { createDatabasePlatformEquivalenceStorage } from "./features/platform-equivalence/server/database-platform-equivalence-storage";
import { createPlatformEquivalenceStore } from "./features/platform-equivalence/server/platform-equivalence-store";
import { createMarketingUsageReviewStore } from "./features/portrait-marketing-profile/server/marketing-usage-review-store";
import { createPortraitIdentityReviewStore } from "./features/portrait-marketing-profile/server/portrait-identity-review-store";
import { createDatabaseMeasurementDefinitionStorage } from "./features/product-measurement/server/database-measurement-definition-storage";
import { createDatabaseMeasurementEventStorage } from "./features/product-measurement/server/database-measurement-event-storage";
import { createMeasurementDefinitionStore } from "./features/product-measurement/server/measurement-definition-store";
import { createMeasurementEventStore } from "./features/product-measurement/server/measurement-event-store";
import { createMeasurementMeasureStore } from "./features/product-measurement/server/measurement-measure-store";
import { createMeasurementPseudonymizer } from "./features/product-measurement/server/measurement-pseudonym";
import { createProductMeasurementRecorder } from "./features/product-measurement/server/measurement-workflows";
import { createProductionExperimentStore } from "./features/production-experiments/server/production-experiment-store";
import { createManagedSnapshotStore } from "./features/production-provenance/server/managed-snapshot-store";
import { createProductionRecipeStore } from "./features/production-recipes/server/production-recipe-store";
import {
	createDatabaseProjectArchiveRestoreRequestStorage,
	createDatabaseProjectArchiveRestoreStorage,
} from "./features/project-archives/server/database-project-archive-restore-storage";
import {
	createDatabaseProjectArchiveRequestStorage,
	createDatabaseProjectArchiveStorage,
} from "./features/project-archives/server/database-project-archive-storage";
import {
	createObjectFileCopier,
	createObjectFileRemover,
} from "./features/project-archives/server/object-file-copier";
import { createObjectFileVerifier } from "./features/project-archives/server/object-file-verifier";
import { createProjectArchiveCanonicalVerifier } from "./features/project-archives/server/project-archive-canonical-verification";
import { createDatabaseArchiveImportRequestStorage } from "./features/project-archives/server/project-archive-import-storage";
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
import { createUiStretchTestStore } from "./features/ui-profile/server/ui-stretch-test-store";
import { createVfxAppearanceReviewStore } from "./features/vfx-profile/server/vfx-appearance-review-store";
import { createVfxSynchronizationStore } from "./features/vfx-profile/server/vfx-synchronization-store";
import { createProjectContextScopeStore } from "./features/visual-worlds/server/project-context-scope-store";
import { createManagedObjectLegacyGuard } from "./managed-object-legacy-guard";
import { createManagedOperationServices } from "./operation-services";

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

export const uiStretchTestStore = createUiStretchTestStore(db);
export const backgroundLayerLayoutStore = createBackgroundLayerLayoutStore(db);
export const portraitIdentityReviewStore =
	createPortraitIdentityReviewStore(db);
export const uiStateComparisonStore = createUiStateComparisonStore(db);
export const iconFamilyReviewStore = createIconFamilyReviewStore(db);
export const gameplayMetadataStore = createGameplayMetadataStore(db);
const measurementDefinitionStorage =
	createDatabaseMeasurementDefinitionStorage(db);
export const measurementDefinitionStore = createMeasurementDefinitionStore({
	storage: measurementDefinitionStorage,
});
const measurementPseudonymize = createMeasurementPseudonymizer(
	ENV.BETTER_AUTH_SECRET
);
const measurementEventStorage = createDatabaseMeasurementEventStorage(db);
export const measurementEventStore = createMeasurementEventStore({
	definitionStorage: measurementDefinitionStorage,
	ownsProject: async (userId, projectId) =>
		(await projectAccess.getProject(userId, projectId)) !== null,
	pseudonymize: measurementPseudonymize,
	storage: measurementEventStorage,
});
export const measurementMeasureStore = createMeasurementMeasureStore({
	definitionStorage: measurementDefinitionStorage,
	eventStorage: measurementEventStorage,
	pseudonymize: measurementPseudonymize,
});
export const productMeasurementRecorder = createProductMeasurementRecorder({
	definitionStore: measurementDefinitionStore,
	eventStore: measurementEventStore,
	storage: measurementEventStorage,
});
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
export const readinessPlanStore = createReadinessPlanStore({
	deliveryTargets: deliveryTargetStore,
	policyEvidence: {
		assetVersions: assetVersionStore,
		generationPackages: generationPackageStore,
		tracking: assetRecordTrackingStore,
		rights: persistedRightsRecordStore,
		references: referenceProductionStore,
	},
	dependencies: dependencyRevalidationStore,
	familyReadiness: familyReadinessStore,
	fulfilments: deliveryFulfilmentStorage,
	storage: createDatabaseReadinessPlanStorage(db),
});
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
export const deletionReceiptStore = createDeletionReceiptStore({
	db,
	storage: createDatabaseErasureDeletionStorage(db),
});
/** No backup retention schedule is published yet (OV-08), so reports claim no clean-up time. */
export const erasureImpactStore = createErasureImpactStore({
	db,
	sourceReader: createErasureImpactSourceReader(db),
	storage: createDatabaseErasureImpactStorage(db),
});
const credentialNamePattern = /SECRET|TOKEN|KEY|PASSWORD/iu;
export const archiveObjectStorage =
	testAssetVersionStorage ?? (r2Config ? createStorage(r2Config) : null);
export const projectArchiveStorage = createDatabaseProjectArchiveStorage(db);
const projectArchiveSourceReader = createProjectArchiveSourceReader({
	assetFamilies: assetFamilyStore,
	assetRecords: assetRecordStore,
	assetVersions: assetVersionStore,
	db,
});
export const projectArchiveStore = createProjectArchiveStore(db, {
	/** Every configured credential value; an archive holding one is refused. */
	secretValues: () =>
		Object.entries(ENV)
			.filter(
				([name, value]) =>
					credentialNamePattern.test(name) && typeof value === "string"
			)
			.map(([, value]) => value as string),
	sourceReader: projectArchiveSourceReader,
	storage: projectArchiveStorage,
	fileAvailable: async (objectKey) => {
		if (!archiveObjectStorage) {
			return false;
		}
		const object = await archiveObjectStorage.get(objectKey);
		if (!object?.body) {
			return false;
		}
		await object.body.cancel();
		return true;
	},
	verifyFile: archiveObjectStorage
		? createObjectFileVerifier(archiveObjectStorage)
		: () => Promise.resolve(false),
});
/** Restoring copies files, so it needs object storage; without it restore is unavailable. */
export const projectArchiveRestoreStore = archiveObjectStorage
	? createProjectArchiveRestoreStore(db, {
			reservations: createDatabaseManagedObjectReservations(db),
			archives: createDatabaseProjectArchiveStorage(db),
			verifyCanonical: createProjectArchiveCanonicalVerifier(
				projectArchiveSourceReader
			),
			files: {
				copy: createObjectFileCopier(archiveObjectStorage),
				remove: createObjectFileRemover(archiveObjectStorage),
				verify: createObjectFileVerifier(archiveObjectStorage),
			},
			storage: createDatabaseProjectArchiveRestoreStorage(
				db,
				(transaction, record) =>
					createProjectArchiveCanonicalVerifier(
						createProjectArchiveSourceReader({
							db: transaction,
							assetFamilies: createAssetFamilyStore(transaction),
							assetRecords: createAssetRecordStore(transaction),
							assetVersions: createAssetVersionStore(transaction),
						})
					)(record)
			),
		})
	: undefined;
export const platformEquivalenceStore = createPlatformEquivalenceStore(db, {
	bundles: exportBundleStore,
	storage: createDatabasePlatformEquivalenceStorage(db),
});
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
	evidence: {
		bundles: exportBundleStore,
		runtimeValidation: runtimeValidationStore,
	},
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

/** Creates the configured API or worker composition against the same durable records. */
const archiveManifestLimit = Number(
	ENV.PROJECT_ARCHIVE_IMPORT_MANIFEST_MAX_BYTES
);
export const projectArchiveImportManifestLimit =
	Number.isSafeInteger(archiveManifestLimit) && archiveManifestLimit > 0
		? archiveManifestLimit
		: undefined;

export function createServerOperationServices(
	transport: import("./features/background-operations/server/operation-storage").OperationTransport
) {
	return createManagedOperationServices({
		db,
		storage: createDatabaseOperationStorage(db),
		transport,
		archiveOptions: {
			requests: createDatabaseProjectArchiveRequestStorage(db),
			store: projectArchiveStore,
		},
		restoreOptions: projectArchiveRestoreStore
			? {
					requests: createDatabaseProjectArchiveRestoreRequestStorage(db),
					store: projectArchiveRestoreStore,
				}
			: undefined,
		importOptions:
			archiveObjectStorage && projectArchiveRestoreStore
				? {
						requests: createDatabaseArchiveImportRequestStorage(db),
						reservations: createDatabaseManagedObjectReservations(db),
						maxManifestBytes: projectArchiveImportManifestLimit,
						objects: archiveObjectStorage,
						store: projectArchiveRestoreStore,
					}
				: undefined,
		erasureOptions: archiveObjectStorage
			? {
					managedObjects: createDatabaseManagedObjectReservations(db),
					registerHistoricalImports: createManagedObjectLegacyGuard({
						listOwner: createDatabaseManagedObjectReservations(db).listOwner,
						reserve: createDatabaseManagedObjectReservations(db).reserve,
						listOwnerProjectIds: async (ownerUserId) =>
							(
								await db
									.select({ id: project.id })
									.from(project)
									.where(eq(project.ownerUserId, ownerUserId))
							).map((row) => row.id),
						listObjects: (prefix) => archiveObjectStorage.list(prefix),
					}),
					db,
					impactStore: erasureImpactStore,
					sourceReader: createErasureImpactSourceReader(db),
					storage: createDatabaseErasureDeletionStorage(db),
					objects: createServerAssetVersionStorage(),
				}
			: undefined,
	});
}
function configuredOperationServices() {
	let config: ReturnType<typeof requireCloudflareConfig>;
	try {
		config = requireCloudflareConfig(ENV);
	} catch {
		return;
	}
	const queue = createQueue(config);
	return createServerOperationServices({ send: queue.sendOperation });
}
export const managedOperationServices = configuredOperationServices();
