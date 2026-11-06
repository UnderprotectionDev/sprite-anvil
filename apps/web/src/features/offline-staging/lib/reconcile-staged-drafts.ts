import {
	type OfflineConflictView,
	type OfflineReconcileInput,
	type OfflineReconcileResponse,
	offlineConflictContractVersion,
	offlineConflictLocalSchema,
} from "@sprite-anvil/api/offline-conflict";
import type { StagedDraftRow } from "./offline-staging-store";

export type ReconcileEntry =
	| {
			base: { revision: number; sourceAssetVersionId: string };
			draftId: string;
			kind: "base-current";
	  }
	| { conflict: OfflineConflictView; draftId: string; kind: "conflict" }
	| { draftId: string; kind: "failed"; message: string };

/**
 * Reconnect check of every staged Working Draft against the cloud. The check
 * only reads and records: a draft is never removed or sent anywhere else here,
 * so a failed or unreadable check leaves the staged draft where it is.
 */
export async function reconcileStagedDrafts({
	drafts,
	reconcile,
}: {
	drafts: StagedDraftRow[];
	reconcile: (
		request: OfflineReconcileInput
	) => Promise<OfflineReconcileResponse>;
}): Promise<ReconcileEntry[]> {
	const entries: ReconcileEntry[] = [];
	for (const row of drafts) {
		const draftId = row.draft.id;
		const local = offlineConflictLocalSchema.safeParse(row.draft);
		if (!local.success) {
			entries.push({
				kind: "failed",
				draftId,
				message:
					"This staged Working Draft could not be read; it stays staged.",
			});
			continue;
		}
		try {
			// biome-ignore lint/performance/noAwaitInLoops: Drafts are checked in staging order.
			const response = await reconcile({
				contractVersion: offlineConflictContractVersion,
				draftId,
				base: {
					revision: row.base.revision,
					sourceAssetVersionId: row.base.sourceAssetVersionId,
				},
				local: {
					operations: local.data.operations,
					appliedOperationCount: local.data.appliedOperationCount,
				},
			});
			entries.push(
				response.outcome === "conflict"
					? { kind: "conflict", draftId, conflict: response.conflict }
					: { kind: "base-current", draftId, base: row.base }
			);
		} catch (error) {
			entries.push({
				kind: "failed",
				draftId,
				message: error instanceof Error ? error.message : "The check failed.",
			});
		}
	}
	return entries;
}
