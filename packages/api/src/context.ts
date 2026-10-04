import type { Session } from "@sprite-anvil/auth";
import type { Database } from "@sprite-anvil/db";
import type { AssetFamilyStore } from "./asset-families";
import type { AssetRecordTrackingStore } from "./asset-record-tracking";
import type { AssetRecordStore } from "./asset-records";
import type { AssetVersionStore } from "./asset-versions";
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
import type { ProjectAccessStore } from "./project-access-store";
import type { ProjectContextStore } from "./project-context";
import type { ProviderGenerationRecordStore } from "./provider-generation-records";
import type { ReferenceProductionStore } from "./reference-production";
import type { RightsRecordStore } from "./rights-records";
import type { SpecializedProfileContractStore } from "./specialized-profile-contracts";

export interface Context {
	assetFamilyStore: AssetFamilyStore;
	assetRecordStore: AssetRecordStore;
	assetRecordTrackingStore: AssetRecordTrackingStore;
	assetVersionStore: AssetVersionStore;
	collectionStore: CollectionStore;
	db: Database;
	dependencyRevalidationStore?: DependencyRevalidationStore;
	directionalReviewStore?: DirectionalReviewStore;
	familyReadinessStore?: FamilyReadinessStore;
	gameplayMetadataStore?: GameplayMetadataStore;
	generationPackageStore?: GenerationPackageStore;
	projectAccess: ProjectAccessStore;
	projectContextScopeStore: ProjectContextScopeStore;
	projectContextStore: ProjectContextStore;
	providerGenerationRecordStore?: ProviderGenerationRecordStore;
	readGameplayMetadataPackageTarget?: GameplayMetadataPackageTargetReader;
	referenceProductionStore?: ReferenceProductionStore;
	reviewGameplayMetadata?: GameplayMetadataReviewHandler;
	rightsRecordStore?: RightsRecordStore;
	session: Session | null;
	specializedProfileContractStore?: SpecializedProfileContractStore;
	verifyAssetVersionContent?: (
		userId: string,
		projectId: string,
		assetVersionId: string
	) => Promise<boolean>;
}
