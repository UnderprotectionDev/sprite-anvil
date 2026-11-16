import { ORPCError } from "@orpc/server";
import type {
	AssetVersionBatchReviewPreview,
	AssetVersionCatalog,
} from "./asset-versions";
import type { Context } from "./context";

function productionBlockers(
	version: AssetVersionCatalog["assetVersions"][number]
) {
	const blockers: string[] = [];
	if (!(version.integrityVerified && version.contentDigest)) {
		blockers.push("File integrity has not been verified.");
	}
	if (version.productionEvidence.evidenceLevel === "incomplete") {
		blockers.push("Required production evidence is missing.");
	}
	if (
		version.productionSource === "connected_provider" &&
		!version.providerGenerationRecord
	) {
		blockers.push("Provider Generation Record is missing.");
	}
	return blockers;
}

export async function previewBatchReview(
	context: Context,
	input: {
		projectId: string;
		assetVersionIds: string[];
		decision: "approved" | "candidate" | "rejected";
	},
	catalog: AssetVersionCatalog
): Promise<AssetVersionBatchReviewPreview> {
	const userId = context.session?.user.id ?? "";
	const items = await Promise.all(
		input.assetVersionIds.map(async (assetVersionId) => {
			const version = catalog.assetVersions.find(
				(entry) => entry.id === assetVersionId
			);
			if (!version) {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Version not found.",
				});
			}
			const blockers: string[] = [];
			if (version.reviewDisposition === input.decision) {
				blockers.push(
					"This is already the current Asset Version review decision."
				);
			}
			if (input.decision === "approved") {
				blockers.push(...productionBlockers(version));
				if (
					!(await context.verifyAssetVersionContent?.(
						userId,
						input.projectId,
						assetVersionId
					))
				) {
					blockers.push("The stored file failed integrity verification.");
				}
				const qualityBlockers =
					await context.assetVersionStore.readReviewBlockers(
						userId,
						input.projectId,
						assetVersionId
					);
				blockers.push(
					...(qualityBlockers ?? ["Quality evidence could not be read."])
				);
			}
			return {
				assetVersionId,
				expectedReviewEventId: version.reviewEvents.at(-1)?.id ?? null,
				blockers,
			};
		})
	);
	return { items };
}
