import type {
	OfflineAbandonConfirmation,
	OfflineConflictChoice,
} from "@sprite-anvil/api/offline-conflict";
import { offlineConflictContractVersion } from "@sprite-anvil/api/offline-conflict";
import {
	skipToken,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import type { OfflineStagingStore } from "../lib/offline-staging-store";
import type { ReconcileEntry } from "../lib/reconcile-staged-drafts";
import { reconcileStagedDrafts } from "../lib/reconcile-staged-drafts";
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
	userId,
}: {
	online: boolean;
	projectId: string;
	refresh: () => Promise<unknown>;
	stagedDraftCount: number;
	store: OfflineStagingStore;
	userId: string;
}) {
	const resolutionKeysRef =
		useRef<ReturnType<typeof createResolutionKeys>>(null);
	resolutionKeysRef.current ??= createResolutionKeys();
	const resolutionKeys = resolutionKeysRef.current;
	const queryClient = useQueryClient();
	const reconcileKey = [
		"offline-staging-reconciliation",
		userId,
		projectId,
	] as const;
	const checkedEntries = useQuery<ReconcileEntry[]>({
		queryKey: reconcileKey,
		queryFn: skipToken,
		gcTime: 0,
	});
	const reconciliation = useMutation({
		...mutationMeta,
		networkMode: "always",
		mutationFn: async () => {
			const drafts = await store.listStagedDrafts(projectId);
			return reconcileStagedDrafts({
				drafts,
				reconcile: (reconcile) =>
					orpc.offlineConflicts.reconcile.call({ projectId, reconcile }),
			});
		},
		onSuccess: (result) => {
			queryClient.setQueryData(reconcileKey, result);
		},
	});
	const inFlight = useRef<Promise<unknown> | null>(null);
	const { mutateAsync: reconcileDrafts } = reconciliation;
	const checkDrafts = useCallback(() => {
		inFlight.current ??= reconcileDrafts()
			.catch(() => undefined)
			.finally(() => {
				inFlight.current = null;
			});
		return inFlight.current;
	}, [reconcileDrafts]);

	const finalize = useMutation(
		orpc.workingDrafts.commit.mutationOptions({
			...mutationMeta,
			networkMode: "always",
			onSuccess: async (_result, { draftId }) => {
				await store.removeStagedDraft(draftId);
				queryClient.setQueryData<ReconcileEntry[]>(reconcileKey, (current) =>
					current?.filter((entry) => entry.draftId !== draftId)
				);
				await refresh();
			},
		})
	);
	const confirmationMutation = useMutation(
		orpc.offlineConflicts.requestAbandonConfirmation.mutationOptions({
			...mutationMeta,
			networkMode: "always",
		})
	);
	const resolution = useMutation(
		orpc.offlineConflicts.resolve.mutationOptions({
			...mutationMeta,
			networkMode: "always",
		})
	);

	// Reconnecting compares every staged Working Draft with the cloud before anything is finalized.
	const checkedOnline = useRef(online);
	useEffect(() => {
		if (online && !checkedOnline.current && stagedDraftCount > 0) {
			void checkDrafts();
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
				confirmation: await confirmationMutation.mutateAsync({
					projectId,
					conflictId: conflict.id,
				}),
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
			const result = await resolution.mutateAsync({
				projectId,
				conflictId: conflict.id,
				contractVersion: offlineConflictContractVersion,
				choice,
				idempotencyKey: resolutionKeys.keyFor(conflict.id, choice),
				...confirmation,
			});
			resolutionKeys.settle(conflict.id);
			queryClient.setQueryData<ReconcileEntry[]>(reconcileKey, (entries) =>
				entries?.map((entry) =>
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

	let message: string | null = null;
	if (finalize.isError) {
		message = messageOf(finalize.error, "Finalizing the draft failed.");
	} else if (finalize.data) {
		message = `Candidate Version ${finalize.data.assetVersionId} was created from the staged Working Draft. Nothing is approved.`;
	} else if (reconciliation.isError) {
		message = messageOf(
			reconciliation.error,
			"The staged drafts could not be checked."
		);
	}

	return {
		checkDrafts,
		finalizeDraft: (draftId: string, revision: number) =>
			finalize
				.mutateAsync({ projectId, draftId, expectedRevision: revision })
				.catch(() => undefined),
		isChecking: reconciliation.isPending,
		message,
		reconciled: checkedEntries.data ?? [],
		requestAbandon,
		resolveConflict,
	};
}
