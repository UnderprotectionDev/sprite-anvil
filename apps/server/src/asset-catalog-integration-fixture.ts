import type { Database } from "@sprite-anvil/db";
import { assetFamilyRelationships } from "@sprite-anvil/db/schema/asset-families";
import {
	legacyAssetAttestations,
	manualImportEvidence,
} from "@sprite-anvil/db/schema/asset-production-history";
import {
	assetFamilies,
	assetRecords,
	subjectIdentities,
} from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersionQualityEvidence,
	assetVersionReviewEvents,
	assetVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { collections } from "@sprite-anvil/db/schema/collections";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { generationPackages } from "@sprite-anvil/db/schema/generation-packages";
import { project } from "@sprite-anvil/db/schema/project";
import { eq, inArray } from "drizzle-orm";

export async function removeAssetCatalogFixture(db: Database, userId: string) {
	const owned = eq(project.ownerUserId, userId);
	const projectIds = db.select({ id: project.id }).from(project).where(owned);

	await db.batch([
		db.delete(collections).where(inArray(collections.projectId, projectIds)),
		db
			.delete(legacyAssetAttestations)
			.where(inArray(legacyAssetAttestations.projectId, projectIds)),
		db
			.delete(manualImportEvidence)
			.where(inArray(manualImportEvidence.projectId, projectIds)),
		db
			.delete(generationPackages)
			.where(inArray(generationPackages.projectId, projectIds)),
		db
			.delete(assetVersionQualityEvidence)
			.where(inArray(assetVersionQualityEvidence.projectId, projectIds)),
		db
			.delete(assetVersionReviewEvents)
			.where(inArray(assetVersionReviewEvents.projectId, projectIds)),
		db
			.delete(assetFamilyRelationships)
			.where(inArray(assetFamilyRelationships.projectId, projectIds)),
		db
			.delete(assetVersions)
			.where(inArray(assetVersions.projectId, projectIds)),
		db.delete(assetRecords).where(inArray(assetRecords.projectId, projectIds)),
		db
			.delete(assetFamilies)
			.where(inArray(assetFamilies.projectId, projectIds)),
		db
			.delete(subjectIdentities)
			.where(inArray(subjectIdentities.projectId, projectIds)),
		db.delete(visualWorlds).where(inArray(visualWorlds.projectId, projectIds)),
		db.delete(project).where(owned),
		db.delete(user).where(eq(user.id, userId)),
	]);
}
