import type {
	OfflineConflictView,
	OfflineReconcileResponse,
} from "@sprite-anvil/api/offline-conflict";
import { expect, test } from "vitest";
import type { StagedDraftRow } from "./offline-staging-store";
import { reconcileStagedDrafts } from "./reconcile-staged-drafts";
import { createResolutionKeys } from "./resolution-keys";

const draftId = "b17f5ff0-a50d-438f-8bf2-a0152b42c401";
const sourceAssetVersionId = "b17f5ff0-a50d-438f-8bf2-a0152b42c301";

function stagedRow(id: string, operations: unknown = []): StagedDraftRow {
	// `operations` may be unreadable on purpose; the row type is bypassed for that case.
	return {
		id,
		projectId: "project-1",
		stagedAt: 1,
		base: { revision: 2, sourceAssetVersionId },
		draft: {
			id,
			projectId: "project-1",
			revision: 2,
			sourceAssetVersionId,
			operations,
			appliedOperationCount: Array.isArray(operations) ? operations.length : 0,
			size: { width: 4, height: 4 },
		} as StagedDraftRow["draft"],
	};
}

const conflict = { id: "conflict-1" } as OfflineConflictView;

test("each staged draft is sent with its pinned base and local content, and the outcome is kept per draft", async () => {
	const sent: unknown[] = [];
	const results = await reconcileStagedDrafts({
		drafts: [stagedRow(draftId), stagedRow("other-draft")],
		reconcile: (request) => {
			sent.push(request);
			const response: OfflineReconcileResponse =
				request.draftId === draftId
					? {
							outcome: "base-current",
							draft: { id: draftId, revision: 3, sourceAssetVersionId },
						}
					: { outcome: "conflict", conflict };
			return Promise.resolve(response);
		},
	});

	expect(sent[0]).toEqual({
		contractVersion: "offline-conflict/1.0.0",
		draftId,
		base: { revision: 2, sourceAssetVersionId },
		local: { operations: [], appliedOperationCount: 0 },
	});
	expect(results.map((entry) => entry.kind)).toEqual([
		"base-current",
		"conflict",
	]);
	// Finalization commits the revision the server wrote the local operations at.
	expect(results[0]).toEqual({
		kind: "base-current",
		draftId,
		draft: { revision: 3 },
	});
});

test("a failed check or unreadable staged draft keeps the draft and reports why", async () => {
	const results = await reconcileStagedDrafts({
		drafts: [stagedRow(draftId), stagedRow("broken", "not-operations")],
		reconcile: () => Promise.reject(new Error("The cloud is unreachable.")),
	});
	expect(results).toEqual([
		{ kind: "failed", draftId, message: "The cloud is unreachable." },
		{
			kind: "failed",
			draftId: "broken",
			message: "This staged Working Draft could not be read; it stays staged.",
		},
	]);
});

test("a retry reuses the idempotency key of the same choice until it succeeds", () => {
	const keys = createResolutionKeys(() => `key-${Math.random()}`);
	const first = keys.keyFor("conflict-1", "create-candidate");
	expect(keys.keyFor("conflict-1", "create-candidate")).toBe(first);
	expect(keys.keyFor("conflict-1", "abandon")).not.toBe(first);
	keys.settle("conflict-1");
	expect(keys.keyFor("conflict-1", "create-candidate")).not.toBe(first);
});
