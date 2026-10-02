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
		blockers.push("Dosya bütünlüğü doğrulanmadı.");
	}
	if (version.productionEvidence.evidenceLevel === "incomplete") {
		blockers.push("Zorunlu üretim kanıtı eksik.");
	}
	if (
		version.productionSource === "connected_provider" &&
		!version.providerGenerationRecord
	) {
		blockers.push("Sağlayıcı Üretim Kaydı eksik.");
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
					message: "Varlık Sürümü bulunamadı.",
				});
			}
			const blockers: string[] = [];
			if (version.reviewDisposition === input.decision) {
				blockers.push("Varlık Sürümünün güncel inceleme kararı zaten bu.");
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
					blockers.push("Saklanan dosya bütünlük doğrulamasından geçmedi.");
				}
				const qualityBlockers =
					await context.assetVersionStore.readReviewBlockers(
						userId,
						input.projectId,
						assetVersionId
					);
				blockers.push(...(qualityBlockers ?? ["Kalite kanıtı okunamadı."]));
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
