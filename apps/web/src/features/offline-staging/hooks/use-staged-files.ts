import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef } from "react";
import { mutationMeta } from "@/utils/mutation-meta";
import { uploadStagedFileToImportInbox } from "../lib/offline-staging-api";
import type { OfflineStagingStore } from "../lib/offline-staging-store";
import { sendStagedFiles } from "../lib/send-staged-files";

const refusalText = {
	"not-png": "Only PNG files can be staged.",
	"too-large": "This file is too large to stage in the browser.",
} as const;

/** Staging PNG files in the browser and handing them to the Import Inbox when online. */
export function useStagedFiles({
	online,
	projectId,
	refresh,
	stagedFileCount,
	store,
}: {
	online: boolean;
	projectId: string;
	refresh: () => Promise<unknown>;
	stagedFileCount: number;
	store: OfflineStagingStore;
}) {
	const sending = useRef(false);
	const sendWork = useMutation({
		...mutationMeta,
		networkMode: "always",
		mutationFn: () =>
			sendStagedFiles({
				projectId,
				store,
				upload: uploadStagedFileToImportInbox(projectId),
			}),
		onSuccess: refresh,
	});
	const stage = useMutation({
		...mutationMeta,
		networkMode: "always",
		gcTime: 0,
		mutationFn: async (file: File) => {
			const result = await store.stageFile(projectId, {
				name: file.name,
				data: file,
			});
			return result.ok
				? `${file.name} is staged in this browser. It enters the Import Inbox when you are online.`
				: refusalText[result.reason];
		},
		onSuccess: refresh,
	});
	const { mutateAsync: sendBatch } = sendWork;

	const send = useCallback(async () => {
		if (sending.current) {
			return;
		}
		sending.current = true;
		try {
			await sendBatch();
		} finally {
			sending.current = false;
		}
	}, [sendBatch]);

	// Reconnecting hands staged files to the Import Inbox; the staged id keeps retries idempotent.
	const wasOnline = useRef(online);
	useEffect(() => {
		if (online && !wasOnline.current && stagedFileCount > 0) {
			send().catch(() => undefined);
		}
		wasOnline.current = online;
	}, [online, stagedFileCount, send]);

	function stageFile(event: ChangeEvent<HTMLInputElement>) {
		const input = event.currentTarget;
		const file = input.files?.[0];
		input.value = "";
		if (file) {
			stage.mutate(file);
		}
	}

	async function removeFile(id: string) {
		await store.removeStagedFile(id);
		await refresh();
	}

	const result = sendWork.data;
	let sendMessage: string | null = null;
	if (result?.failed.length) {
		sendMessage = `${result.failed.length} staged file(s) stay staged: ${result.failed[0]?.message}`;
	} else if (result?.sent.length) {
		sendMessage = `${result.sent.length} staged file(s) entered the Import Inbox. Nothing is approved.`;
	} else if (sendWork.isError) {
		sendMessage =
			"Staged files could not be sent. Check the Import Inbox and try again.";
	}
	const stageMessage = stage.isError
		? "The file could not be staged in this browser."
		: (stage.data ?? null);
	const message =
		sendWork.submittedAt >= stage.submittedAt && sendMessage
			? sendMessage
			: stageMessage;
	return {
		isSending: sendWork.isPending,
		message,
		removeFile,
		send,
		stageFile,
	};
}
