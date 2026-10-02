import type { Session } from "@sprite-anvil/auth";
import type { Database } from "@sprite-anvil/db";
import type { AssetFamilyStore } from "./asset-families";
import type { AssetRecordTrackingStore } from "./asset-record-tracking";
import type { AssetRecordStore } from "./asset-records";
import type { AssetVersionStore } from "./asset-versions";
import type { CollectionStore } from "./collections";
import type { ProjectContextScopeStore } from "./context-scopes";
import type { DependencyRevalidationStore } from "./dependency-revalidation";
import type { FamilyReadinessStore } from "./family-readiness";
import type { GameplayMetadataStore } from "./gameplay-metadata";
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
	familyReadinessStore?: FamilyReadinessStore;
	gameplayMetadataStore?: GameplayMetadataStore;
	generationPackageStore?: GenerationPackageStore;
	projectAccess: ProjectAccessStore;
	projectContextScopeStore: ProjectContextScopeStore;
	projectContextStore: ProjectContextStore;
	providerGenerationRecordStore?: ProviderGenerationRecordStore;
	referenceProductionStore?: ReferenceProductionStore;
	rightsRecordStore?: RightsRecordStore;
	session: Session | null;
	specializedProfileContractStore?: SpecializedProfileContractStore;
	verifyAssetVersionContent?: (
		userId: string,
		projectId: string,
		assetVersionId: string
	) => Promise<boolean>;
}
