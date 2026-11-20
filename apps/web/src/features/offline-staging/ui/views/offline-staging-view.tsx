import { StatusMessage } from "@/components/status-message";
import { useOfflineReconcile } from "../../hooks/use-offline-reconcile";
import { useOnlineStatus } from "../../hooks/use-online-status";
import { useStagedFiles } from "../../hooks/use-staged-files";
import { useStagedWork } from "../../hooks/use-staged-work";
import { OfflineProjectSection } from "../components/offline-project-section";
import { ReconcileSection } from "../components/reconcile-section";
import { StagedDraftsSection } from "../components/staged-drafts-section";
import { StagedFilesSection } from "../components/staged-files-section";

export function OfflineStagingView({
	projectId,
	userId,
}: {
	projectId: string;
	userId: string;
}) {
	const online = useOnlineStatus();
	const {
		cachedAt,
		drafts,
		files,
		hasUnassignedStorage,
		isProjectPending,
		projectName,
		refresh,
		store,
	} = useStagedWork(projectId, userId);
	const stagedFiles = useStagedFiles({
		online,
		projectId,
		refresh,
		stagedFileCount: files.length,
		store,
	});
	const reconcile = useOfflineReconcile({
		online,
		projectId,
		refresh,
		stagedDraftCount: drafts.length,
		store,
		userId,
	});

	return (
		<main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
			<header className="space-y-2">
				<h1 className="text-2xl font-semibold">Offline staging</h1>
				<p className="text-muted-foreground text-sm">
					Staged work lives only in this browser. The cloud record stays
					authoritative; nothing staged is approved, activated or exported.
				</p>
				<p role="status">{online ? "Online" : "Offline"}</p>
			</header>

			{hasUnassignedStorage ? (
				<StatusMessage tone="info">
					This browser has offline storage from an earlier version. It stays
					separate because it has no account information.
				</StatusMessage>
			) : null}

			<OfflineProjectSection
				cachedAt={cachedAt}
				isPending={isProjectPending}
				name={projectName}
				projectId={projectId}
			/>

			<StagedFilesSection
				canSend={online && !stagedFiles.isSending && files.length > 0}
				files={files}
				message={stagedFiles.message}
				onRemove={stagedFiles.removeFile}
				onSend={stagedFiles.send}
				onStage={stagedFiles.stageFile}
			/>

			<StagedDraftsSection
				canCheck={online && !reconcile.isChecking && drafts.length > 0}
				drafts={drafts}
				onCheck={reconcile.checkDrafts}
				onEdited={refresh}
				projectId={projectId}
				store={store}
			/>

			{reconcile.reconciled.length > 0 || reconcile.message ? (
				<ReconcileSection
					entries={reconcile.reconciled}
					message={reconcile.message}
					onFinalize={reconcile.finalizeDraft}
					onRequestAbandon={reconcile.requestAbandon}
					onResolve={reconcile.resolveConflict}
					projectId={projectId}
				/>
			) : null}
		</main>
	);
}
