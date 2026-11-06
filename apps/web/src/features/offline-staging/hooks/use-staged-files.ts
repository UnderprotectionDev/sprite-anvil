import {
	type ChangeEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
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
	const [message, setMessage] = useState<string | null>(null);
	const [isSending, setIsSending] = useState(false);
	const sending = useRef(false);

	const send = useCallback(async () => {
		if (sending.current) {
			return;
		}
		sending.current = true;
		setIsSending(true);
		try {
			const result = await sendStagedFiles({
				projectId,
				store,
				upload: uploadStagedFileToImportInbox(projectId),
			});
			if (result.sent.length > 0) {
				setMessage(
					`${result.sent.length} staged file(s) entered the Import Inbox. Nothing is approved.`
				);
			}
			if (result.failed.length > 0) {
				setMessage(
					`${result.failed.length} staged file(s) stay staged: ${result.failed[0]?.message}`
				);
			}
			await refresh();
		} finally {
			sending.current = false;
			setIsSending(false);
		}
	}, [projectId, refresh, store]);

	// Reconnecting hands staged files to the Import Inbox; the staged id keeps retries idempotent.
	const wasOnline = useRef(online);
	useEffect(() => {
		if (online && !wasOnline.current && stagedFileCount > 0) {
			send().catch(() => undefined);
		}
		wasOnline.current = online;
	}, [online, stagedFileCount, send]);

	async function stageFile(event: ChangeEvent<HTMLInputElement>) {
		const input = event.currentTarget;
		const file = input.files?.[0];
		input.value = "";
		if (!file) {
			return;
		}
		const result = await store.stageFile(projectId, {
			name: file.name,
			data: file,
		});
		setMessage(
			result.ok
				? `${file.name} is staged in this browser. It enters the Import Inbox when you are online.`
				: refusalText[result.reason]
		);
		await refresh();
	}

	async function removeFile(id: string) {
		await store.removeStagedFile(id);
		await refresh();
	}

	return { isSending, message, removeFile, send, stageFile };
}
