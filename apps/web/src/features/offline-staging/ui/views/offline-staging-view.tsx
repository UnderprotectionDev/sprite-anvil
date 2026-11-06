import type { OfflineConflictChoice } from "@sprite-anvil/api/offline-conflict";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	type ChangeEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { orpc } from "@/utils/orpc";
import { useOnlineStatus } from "../../hooks/use-online-status";
import {
	finalizeStagedDraft,
	reconcileStagedDraft,
	resolveOfflineConflict,
} from "../../lib/offline-conflict-api";
import { uploadStagedFileToImportInbox } from "../../lib/offline-staging-api";
import { getDefaultOfflineStagingStore } from "../../lib/offline-staging-store";
import {
	type ReconcileEntry,
	reconcileStagedDrafts,
} from "../../lib/reconcile-staged-drafts";
import { createResolutionKeys } from "../../lib/resolution-keys";
import { sendStagedFiles } from "../../lib/send-staged-files";
import { cachedProjectNameSchema } from "../../schemas";
import { OfflineConflictPanel } from "../components/offline-conflict-panel";

const refusalText = {
	"not-png": "Only PNG files can be staged.",
	"too-large": "This file is too large to stage in the browser.",
} as const;

export function OfflineStagingView({ projectId }: { projectId: string }) {
	const store = getDefaultOfflineStagingStore();
	const queryClient = useQueryClient();
	const online = useOnlineStatus();
	const [message, setMessage] = useState<string | null>(null);
	const [isSending, setIsSending] = useState(false);
	const sending = useRef(false);
	const [reconciled, setReconciled] = useState<ReconcileEntry[]>([]);
	const [isChecking, setIsChecking] = useState(false);
	const checking = useRef(false);
	const resolutionKeys = useRef(createResolutionKeys());
	const stagedKey = useMemo(() => ["offline-staging", projectId], [projectId]);

	const projectQuery = useQuery({
		...orpc.projects.get.queryOptions({ input: { projectId } }),
		meta: { errorPresentation: "inline", suppressGlobalErrorToast: true },
		retry: false,
	});
	const staged = useQuery({
		queryKey: stagedKey,
		queryFn: async () => ({
			cachedProject: await store.readCachedProject(projectId),
			drafts: await store.listStagedDrafts(projectId),
			files: await store.listStagedFiles(projectId),
		}),
		networkMode: "always",
		staleTime: 0,
	});

	// A visit while online refreshes the cached project that offline viewing reads.
	useEffect(() => {
		if (projectQuery.data) {
			store
				.cacheProject(projectId, projectQuery.data)
				.then(() => queryClient.invalidateQueries({ queryKey: stagedKey }))
				.catch(() => undefined);
		}
	}, [projectQuery.data, projectId, queryClient, stagedKey, store]);

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
			await queryClient.invalidateQueries({ queryKey: stagedKey });
		} finally {
			sending.current = false;
			setIsSending(false);
		}
	}, [projectId, queryClient, stagedKey, store]);

	const stagedFileCount = staged.data?.files.length ?? 0;
	// Reconnecting hands staged files to the Import Inbox; the staged id keeps retries idempotent.
	const wasOnline = useRef(online);
	useEffect(() => {
		if (online && !wasOnline.current && stagedFileCount > 0) {
			send().catch(() => undefined);
		}
		wasOnline.current = online;
	}, [online, stagedFileCount, send]);

	const stagedDraftCount = staged.data?.drafts.length ?? 0;
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

	async function resolveConflict(
		conflict: { draftId: string; id: string },
		choice: OfflineConflictChoice,
		confirmation?: { confirmAbandon: true; shownLocalDigest: string }
	) {
		try {
			const result = await resolveOfflineConflict(projectId, conflict.id, {
				choice,
				idempotencyKey: resolutionKeys.current.keyFor(conflict.id, choice),
				...confirmation,
			});
			resolutionKeys.current.settle(conflict.id);
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
					await queryClient.invalidateQueries({ queryKey: stagedKey });
				} catch {
					// The server already recorded the resolution; only local cleanup failed.
					return "The resolution was recorded, but the staged draft could not be removed from this browser. Remove it manually.";
				}
			}
			return null;
		} catch (error) {
			return error instanceof Error ? error.message : "The resolution failed.";
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
			await queryClient.invalidateQueries({ queryKey: stagedKey });
		} catch (error) {
			setMessage(
				error instanceof Error ? error.message : "Finalizing the draft failed."
			);
		}
	}

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
		await queryClient.invalidateQueries({ queryKey: stagedKey });
	}

	async function removeFile(id: string) {
		await store.removeStagedFile(id);
		await queryClient.invalidateQueries({ queryKey: stagedKey });
	}

	const cachedName = cachedProjectNameSchema.safeParse(
		staged.data?.cachedProject?.project
	);
	const projectName =
		projectQuery.data?.name ??
		(cachedName.success ? cachedName.data.name : null);
	const usingCache = !projectQuery.data && cachedName.success;

	return (
		<main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
			<header className="space-y-2">
				<h1 className="font-semibold text-2xl">Offline staging</h1>
				<p className="text-muted-foreground text-sm">
					Staged work lives only in this browser. The cloud record stays
					authoritative; nothing staged is approved, activated or exported.
				</p>
				<p role="status">{online ? "Online" : "Offline"}</p>
			</header>

			<section aria-labelledby="offline-project" className="space-y-2">
				<h2 className="font-medium text-lg" id="offline-project">
					Project
				</h2>
				{projectName ? (
					<p>
						{projectName}
						{usingCache && staged.data?.cachedProject
							? ` (cached copy from ${new Date(staged.data.cachedProject.cachedAt).toLocaleString()})`
							: null}
					</p>
				) : (
					<p>
						{projectQuery.isPending
							? "Loading the project…"
							: "This project is not cached yet. Open it once while online."}
					</p>
				)}
				<Link
					className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
					params={{ projectId }}
					to="/projects/$projectId/import-inbox"
				>
					Open the Import Inbox
				</Link>
			</section>

			<section aria-labelledby="offline-files" className="space-y-3">
				<h2 className="font-medium text-lg" id="offline-files">
					Staged files
				</h2>
				<div className="space-y-2">
					<Label htmlFor="offline-file-input">Stage a PNG file</Label>
					<Input
						accept="image/png"
						id="offline-file-input"
						onChange={stageFile}
						type="file"
					/>
				</div>
				{message ? <p role="status">{message}</p> : null}
				{stagedFileCount === 0 ? (
					<p className="text-muted-foreground text-sm">No staged files.</p>
				) : (
					<ul className="space-y-2">
						{staged.data?.files.map((file) => (
							<li
								className="flex flex-wrap items-center gap-3 rounded-md border p-3"
								key={file.id}
							>
								<span className="min-w-0 break-all">{file.name}</span>
								<span className="text-muted-foreground text-sm">
									{file.size} bytes, waiting for the Import Inbox
								</span>
								<Button
									aria-label={`Remove ${file.name} from staging`}
									onClick={() => removeFile(file.id)}
									type="button"
									variant="outline"
								>
									Remove
								</Button>
							</li>
						))}
					</ul>
				)}
				<Button
					disabled={!online || isSending || stagedFileCount === 0}
					onClick={() => send()}
					type="button"
				>
					Send staged files to the Import Inbox
				</Button>
			</section>

			<section aria-labelledby="offline-drafts" className="space-y-3">
				<h2 className="font-medium text-lg" id="offline-drafts">
					Staged Working Drafts
				</h2>
				{staged.data?.drafts.length ? (
					<ul className="space-y-2">
						{staged.data.drafts.map((entry) => (
							<li className="space-y-1 rounded-md border p-3" key={entry.id}>
								<p>Source Asset Version {entry.base.sourceAssetVersionId}</p>
								<p className="text-muted-foreground text-sm">
									Pinned base revision {entry.base.revision}; saved draft at
									revision {entry.draft.revision}, kept recoverable in this
									browser.
								</p>
								<Link
									className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
									params={{
										projectId,
										assetVersionId: entry.base.sourceAssetVersionId,
									}}
									to="/projects/$projectId/pixel-editor/$assetVersionId"
								>
									Open in the Pixel Editor
								</Link>
							</li>
						))}
					</ul>
				) : (
					<p className="text-muted-foreground text-sm">
						No staged Working Drafts. Stage one from the Pixel Editor while
						online.
					</p>
				)}
				<Button
					disabled={!online || isChecking || stagedDraftCount === 0}
					onClick={() => checkDrafts()}
					type="button"
					variant="outline"
				>
					Check staged Working Drafts against the cloud
				</Button>
			</section>

			{reconciled.length > 0 ? (
				<section aria-labelledby="offline-reconcile" className="space-y-4">
					<h2 className="font-medium text-lg" id="offline-reconcile">
						Reconnect check
					</h2>
					{reconciled.map((entry) => {
						if (entry.kind === "conflict") {
							return (
								<OfflineConflictPanel
									conflict={entry.conflict}
									key={entry.conflict.id}
									onResolve={resolveConflict}
									projectId={projectId}
								/>
							);
						}
						if (entry.kind === "base-current") {
							return (
								<div
									className="flex flex-wrap items-center gap-3 rounded-md border p-3"
									key={entry.draftId}
								>
									<p>
										The cloud has not changed since revision{" "}
										{entry.base.revision}: this Working Draft can be finalized
										normally.
									</p>
									<Button
										onClick={() =>
											finalizeDraft(entry.draftId, entry.base.revision)
										}
										type="button"
									>
										Finalize as a Candidate Version
									</Button>
								</div>
							);
						}
						return (
							<p key={entry.draftId} role="alert">
								Staged draft {entry.draftId} stays staged: {entry.message}
							</p>
						);
					})}
				</section>
			) : null}
		</main>
	);
}
