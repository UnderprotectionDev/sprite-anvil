import type {
	OfflineAbandonConfirmation,
	OfflineConflictChoice,
} from "@sprite-anvil/api/offline-conflict";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	finalizeStagedDraft,
	reconcileStagedDraft,
	requestAbandonConfirmation,
	resolveOfflineConflict,
} from "../lib/offline-conflict-api";
import type { OfflineStagingStore } from "../lib/offline-staging-store";
import {
	type ReconcileEntry,
	reconcileStagedDrafts,
} from "../lib/reconcile-staged-drafts";
import { createResolutionKeys } from "../lib/resolution-keys";

export interface AbandonConfirmationInput {
	confirmAbandon: true;
	confirmationToken: string;
}

function messageOf(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

/**
 * Reconnect check of staged Working Drafts and what follows from it: finalizing
 * a draft whose base is still current, or resolving an Offline Conflict Record.
 * A staged draft leaves the browser only after the cloud recorded the outcome.
 */
export function useOfflineReconcile({
	online,
	projectId,
	refresh,
	stagedDraftCount,
	store,
}: {
	online: boolean;
	projectId: string;
	refresh: () => Promise<unknown>;
	stagedDraftCount: number;
	store: OfflineStagingStore;
}) {
	const [reconciled, setReconciled] = useState<ReconcileEntry[]>([]);
	const [isChecking, setIsChecking] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const checking = useRef(false);
	const [resolutionKeys] = useState(createResolutionKeys);

	const checkDrafts = useCallback(async () => {
		if (checking.current) {
			return;
		}
		checking.current = true;
		setIsChecking(true);
		try {
			const drafts = await store.listStagedDrafts(projectId);
			setReconciled(
				await reconcileStagedDrafts({
					drafts,
					reconcile: reconcileStagedDraft(projectId),
				})
			);
		} finally {
			checking.current = false;
			setIsChecking(false);
		}
	}, [projectId, store]);

	// Reconnecting compares every staged Working Draft with the cloud before anything is finalized.
	const checkedOnline = useRef(online);
	useEffect(() => {
		if (online && !checkedOnline.current && stagedDraftCount > 0) {
			checkDrafts().catch(() => undefined);
		}
		checkedOnline.current = online;
	}, [online, stagedDraftCount, checkDrafts]);

	/** What abandoning would discard, served by the cloud with the token that confirms it. */
	async function requestAbandon(conflict: {
		id: string;
	}): Promise<
		| { confirmation: OfflineAbandonConfirmation; ok: true }
		| { message: string; ok: false }
	> {
		try {
			return {
				ok: true,
				confirmation: await requestAbandonConfirmation(projectId, conflict.id),
			};
		} catch (error) {
			return {
				ok: false,
				message: messageOf(error, "The local content could not be read."),
			};
		}
	}

	async function resolveConflict(
		conflict: { draftId: string; id: string },
		choice: OfflineConflictChoice,
		confirmation?: AbandonConfirmationInput
	) {
		try {
			const result = await resolveOfflineConflict(projectId, conflict.id, {
				choice,
				idempotencyKey: resolutionKeys.keyFor(conflict.id, choice),
				...confirmation,
			});
			resolutionKeys.settle(conflict.id);
			setReconciled((entries) =>
				entries.map((entry) =>
					entry.kind === "conflict" && entry.conflict.id === conflict.id
						? { ...entry, conflict: result.conflict }
						: entry
				)
			);
			if (choice !== "keep-cloud-retain-draft") {
				try {
					await store.removeStagedDraft(conflict.draftId);
					await refresh();
				} catch {
					// The server already recorded the resolution; only local cleanup failed.
					return "The resolution was recorded, but the staged draft could not be removed from this browser. Remove it manually.";
				}
			}
			return null;
		} catch (error) {
			return messageOf(error, "The resolution failed.");
		}
	}

	async function finalizeDraft(draftId: string, revision: number) {
		try {
			const result = await finalizeStagedDraft(projectId, draftId, revision);
			await store.removeStagedDraft(draftId);
			setReconciled((entries) =>
				entries.filter((entry) => entry.draftId !== draftId)
			);
			setMessage(
				`Candidate Version ${result.assetVersionId} was created from the staged Working Draft. Nothing is approved.`
			);
			await refresh();
		} catch (error) {
			setMessage(messageOf(error, "Finalizing the draft failed."));
		}
	}

	return {
		checkDrafts,
		finalizeDraft,
		isChecking,
		message,
		reconciled,
		requestAbandon,
		resolveConflict,
	};
}
