import type { Session } from "@sprite-anvil/auth";
import type { Database } from "@sprite-anvil/db";
import type { AnimationMetadataPackageTargetReader } from "./animation-metadata-package";
import type { AnimationTimingReviewStore } from "./animation-timing-reviews";
import type { AssetFamilyStore } from "./asset-families";
import type { AssetFamilyComparisonStore } from "./asset-family-comparisons";
import type { AssetRecordTrackingStore } from "./asset-record-tracking";
import type { AssetRecordStore } from "./asset-records";
import type { AssetVersionStore } from "./asset-versions";
import type { BackgroundLayerLayoutStore } from "./background-layer-layouts";
import type { BackgroundOperationStore } from "./background-operations";
import type { BackgroundScrollingTestStore } from "./background-scrolling-tests";
import type { CollectionStore } from "./collections";
import type { ProjectContextScopeStore } from "./context-scopes";
import type { DeliveryTargetStore } from "./delivery-planning-store";
import type { DependencyRevalidationStore } from "./dependency-revalidation";
import type { DirectionalReviewStore } from "./directional-reviews";
import type { FamilyReadinessStore } from "./family-readiness";
import type {
	GameplayMetadataReviewHandler,
	GameplayMetadataStore,
} from "./gameplay-metadata";
import type { GameplayMetadataPackageTargetReader } from "./gameplay-metadata-package";
import type {
	GenerationPackageStore,
	PixelDraftCoordinateSpace,
} from "./generation-packages";
import type { IconFamilyReviewStore } from "./icon-family-reviews";
import type { ImportInboxStore } from "./import-inbox";
import type { MarketingUsageReviewStore } from "./marketing-usage-reviews";
import type { PortraitIdentityReviewStore } from "./portrait-identity-reviews";
import type { ProductionExperimentStore } from "./production-experiments";
import type { ProductionRecipeStore } from "./production-recipes";
import type { ProjectAccessStore } from "./project-access-store";
import type { ProjectContextStore } from "./project-context";
import type { ProviderGenerationRecordStore } from "./provider-generation-records";
import type { ReferenceProductionStore } from "./reference-production";
import type { RightsRecordStore } from "./rights-records";
import type { SceneQaStore } from "./scene-qa";
import type {
	SourceMetadataMappingFinalizer,
	SourceMetadataMappingProposalCreator,
	SourceMetadataMappingProposalStore,
} from "./source-metadata-mapping";
import type { SpecializedProfileContractStore } from "./specialized-profile-contracts";
import type {
	TextureAtlasRegion,
	TextureEdgeCheck,
	TextureRepetitionReviewStore,
} from "./texture-repetition-reviews";
import type { TilesetAdjacencyReviewStore } from "./tileset-adjacency-reviews";
import type { UiStateComparisonStore } from "./ui-state-comparisons";
import type { UiStretchTestStore } from "./ui-stretch-tests";
import type {
	VfxAppearanceFrame,
	VfxAppearanceReviewStore,
} from "./vfx-appearance-reviews";
import type { VfxSynchronizationStore } from "./vfx-synchronization";
export interface Context {
	animationTimingReviewStore?: AnimationTimingReviewStore;
	assetFamilyComparisonStore?: AssetFamilyComparisonStore;
	assetFamilyStore: AssetFamilyStore;
	assetRecordStore: AssetRecordStore;
	assetRecordTrackingStore: AssetRecordTrackingStore;
	assetVersionStore: AssetVersionStore;
	backgroundLayerLayoutStore?: BackgroundLayerLayoutStore;
	backgroundOperationStore?: BackgroundOperationStore;
	backgroundScrollingTestStore?: BackgroundScrollingTestStore;
	checkTextureEdges?: (
		userId: string,
		projectId: string,
		assetVersionId: string,
		region: TextureAtlasRegion,
		axes: ("x" | "y")[]
	) => Promise<TextureEdgeCheck | null>;
	collectionStore: CollectionStore;
	createSourceMetadataMappingProposal?: SourceMetadataMappingProposalCreator;
	db: Database;
	deliveryTargetStore?: DeliveryTargetStore;
	dependencyRevalidationStore?: DependencyRevalidationStore;
	directionalReviewStore?: DirectionalReviewStore;
	familyReadinessStore?: FamilyReadinessStore;
	finalizeSourceMetadataMapping?: SourceMetadataMappingFinalizer;
	gameplayMetadataStore?: GameplayMetadataStore;
	generationPackageStore?: GenerationPackageStore;
	iconFamilyReviewStore?: IconFamilyReviewStore;
	importInboxStore?: ImportInboxStore;
	marketingUsageReviewStore?: MarketingUsageReviewStore;
	portraitIdentityReviewStore?: PortraitIdentityReviewStore;
	productionExperimentStore?: ProductionExperimentStore;
	productionRecipeStore?: ProductionRecipeStore;
	projectAccess: ProjectAccessStore;
	projectContextScopeStore: ProjectContextScopeStore;
	projectContextStore: ProjectContextStore;
	providerGenerationRecordStore?: ProviderGenerationRecordStore;
	readAnimationMetadataPackageTarget?: AnimationMetadataPackageTargetReader;
	readGameplayMetadataPackageTarget?: GameplayMetadataPackageTargetReader;
	/** Size and revision of a Working Draft, derived on the server by the pixel editor. */
	readPixelDraftCoordinateSpace?: (
		userId: string,
		projectId: string,
		draftId: string
	) => Promise<PixelDraftCoordinateSpace | null>;
	readVfxImageDimensions?: (
		userId: string,
		projectId: string,
		assetVersionId: string
	) => Promise<{ width: number; height: number; hasAlpha: boolean } | null>;
	referenceProductionStore?: ReferenceProductionStore;
	reviewGameplayMetadata?: GameplayMetadataReviewHandler;
	rightsRecordStore?: RightsRecordStore;
	sceneQaStore?: SceneQaStore;
	session: Session | null;
	sourceMetadataMappingProposalStore?: SourceMetadataMappingProposalStore;
	specializedProfileContractStore?: SpecializedProfileContractStore;
	textureRepetitionReviewStore?: TextureRepetitionReviewStore;
	tilesetAdjacencyReviewStore?: TilesetAdjacencyReviewStore;
	uiStateComparisonStore?: UiStateComparisonStore;
	uiStretchTestStore?: UiStretchTestStore;
	verifyAssetVersionContent?: (
		userId: string,
		projectId: string,
		assetVersionId: string
	) => Promise<boolean>;
	verifyVfxFrameContent?: (
		userId: string,
		projectId: string,
		frame: VfxAppearanceFrame
	) => Promise<boolean>;
	vfxAppearanceReviewStore?: VfxAppearanceReviewStore;
	vfxSynchronizationStore?: VfxSynchronizationStore;
}
