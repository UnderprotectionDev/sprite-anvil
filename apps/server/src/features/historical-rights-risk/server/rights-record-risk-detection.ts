import type { HistoricalRiskNoticeStore } from "@sprite-anvil/api/historical-risk-notices";
import type {
	RightsRecordCreateResult,
	RightsRecordStore,
} from "@sprite-anvil/api/rights-records";

/**
 * Wraps a Rights Record store so every new result-level revision is evaluated
 * against past Delivery Fulfilments once it is saved. The revision itself is
 * saved first and unchanged. A failed evaluation surfaces as an error; the
 * client's retry replays the same revision and evaluates it again, and a
 * notice is only ever written once per Fulfilment and revision.
 */
export function withHistoricalRiskDetection(
	rights: RightsRecordStore,
	notices: Pick<HistoricalRiskNoticeStore, "detect">
): RightsRecordStore {
	async function detect(userId: string, result: RightsRecordCreateResult) {
		// Bundles pin result-level evidence only; a reference-level revision has no Fulfilment usage to show.
		if (result.ok && !result.record.referenceId) {
			await notices.detect(userId, {
				assetRecordId: result.record.assetRecordId,
				projectId: result.record.projectId,
				rightsRecordId: result.record.id,
			});
		}
		return result;
	}
	return {
		...rights,
		async createRevision(userId, input) {
			return detect(userId, await rights.createRevision(userId, input));
		},
		async createRevisionWithEvidenceFile(userId, input) {
			return detect(
				userId,
				await rights.createRevisionWithEvidenceFile(userId, input)
			);
		},
	};
}
