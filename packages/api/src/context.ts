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
import type { BackgroundScrollingTestStore } from "./background-scrolling-tests";
import type { CollectionStore } from "./collections";
import type { ProjectContextScopeStore } from "./context-scopes";
import type { DependencyRevalidationStore } from "./dependency-revalidation";
import type { DirectionalReviewStore } from "./directional-reviews";
import type { FamilyReadinessStore } from "./family-readiness";
import type {
	GameplayMetadataReviewHandler,
	GameplayMetadataStore,
} from "./gameplay-metadata";
import type { GameplayMetadataPackageTargetReader } from "./gameplay-metadata-package";
import type { GenerationPackageStore } from "./generation-packages";
import type { IconFamilyReviewStore } from "./icon-family-reviews";
import type { ProjectAccessStore } from "./project-access-store";
import type { ProjectContextStore } from "./project-context";
import type { ProviderGenerationRecordStore } from "./provider-generation-records";
import type { ReferenceProductionStore } from "./reference-production";
import type { RightsRecordStore } from "./rights-records";
import type { SceneQaStore } from "./scene-qa";
import type { SpecializedProfileContractStore } from "./specialized-profile-contracts";
import type {
	TextureAtlasRegion,
	TextureEdgeCheck,
	TextureRepetitionReviewStore,
} from "./texture-repetition-reviews";
import type { TilesetAdjacencyReviewStore } from "./tileset-adjacency-reviews";
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
	backgroundScrollingTestStore?: BackgroundScrollingTestStore;
	checkTextureEdges?: (
		userId: string,
		projectId: string,
		assetVersionId: string,
		region: TextureAtlasRegion,
		axes: ("x" | "y")[]
	) => Promise<TextureEdgeCheck | null>;
	collectionStore: CollectionStore;
	db: Database;
	dependencyRevalidationStore?: DependencyRevalidationStore;
	directionalReviewStore?: DirectionalReviewStore;
	familyReadinessStore?: FamilyReadinessStore;
	gameplayMetadataStore?: GameplayMetadataStore;
	generationPackageStore?: GenerationPackageStore;
	iconFamilyReviewStore?: IconFamilyReviewStore;
	projectAccess: ProjectAccessStore;
	projectContextScopeStore: ProjectContextScopeStore;
	projectContextStore: ProjectContextStore;
	providerGenerationRecordStore?: ProviderGenerationRecordStore;
	readAnimationMetadataPackageTarget?: AnimationMetadataPackageTargetReader;
	readGameplayMetadataPackageTarget?: GameplayMetadataPackageTargetReader;
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
	specializedProfileContractStore?: SpecializedProfileContractStore;
	textureRepetitionReviewStore?: TextureRepetitionReviewStore;
	tilesetAdjacencyReviewStore?: TilesetAdjacencyReviewStore;
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
