import type {
	OfflineConflictChoice,
	OfflineConflictView,
} from "@sprite-anvil/api/offline-conflict";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@sprite-anvil/ui/components/alert-dialog";
import { Button } from "@sprite-anvil/ui/components/button";
import { useState } from "react";
import { conflictPreviewUrl } from "../../lib/offline-conflict-api";

const choiceLabel: Record<OfflineConflictChoice, string> = {
	"create-candidate":
		"created a separate Candidate Version from the local draft",
	"keep-cloud-retain-draft":
		"kept the cloud version and retained the local draft",
	abandon: "abandoned the local draft",
};

function describeOperations(operations: { type: string }[]) {
	if (operations.length === 0) {
		return "no operations";
	}
	const counts = new Map<string, number>();
	for (const { type } of operations) {
		counts.set(type, (counts.get(type) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([type, count]) => `${type} x${count}`)
		.join(", ");
}

function Version({
	conflict,
	detail,
	projectId,
	side,
	title,
}: {
	conflict: OfflineConflictView;
	detail: string;
	projectId: string;
	side: "base" | "cloud" | "local";
	title: string;
}) {
	return (
		<figure className="space-y-2 rounded-md border p-3">
			<img
				alt={`${title} version preview`}
				className="aspect-square w-full bg-muted object-contain [image-rendering:pixelated]"
				height={256}
				src={conflictPreviewUrl(projectId, conflict.id, side)}
				width={256}
			/>
			<figcaption className="space-y-1 text-sm">
				<p className="font-medium">{title}</p>
				<p className="text-muted-foreground">{detail}</p>
			</figcaption>
		</figure>
	);
}

/**
 * Three-way comparison of an Offline Conflict Record and the three explicit
 * choices. The cloud stays authoritative; nothing is merged or chosen for the user.
 */
export function OfflineConflictPanel({
	conflict,
	onResolve,
	projectId,
}: {
	conflict: OfflineConflictView;
	onResolve: (
		conflict: OfflineConflictView,
		choice: OfflineConflictChoice,
		confirmation?: { confirmAbandon: true; shownLocalDigest: string }
	) => Promise<string | null>;
	projectId: string;
}) {
	const [pending, setPending] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { resolution } = conflict;

	async function choose(
		choice: OfflineConflictChoice,
		confirmation?: { confirmAbandon: true; shownLocalDigest: string }
	) {
		setPending(true);
		setError(null);
		const failure = await onResolve(conflict, choice, confirmation);
		setError(failure);
		setPending(false);
	}

	const headingId = `offline-conflict-${conflict.id}`;
	return (
		<section aria-labelledby={headingId} className="space-y-3">
			<h3 className="font-medium" id={headingId}>
				Conflict: the cloud Working Draft changed while you were offline
			</h3>
			<div className="grid gap-3 sm:grid-cols-3">
				<Version
					conflict={conflict}
					detail={`Pinned base: revision ${conflict.base.revision} of the source Asset Version.`}
					projectId={projectId}
					side="base"
					title="Base"
				/>
				<Version
					conflict={conflict}
					detail={`Current cloud: revision ${conflict.cloud.revision}, ${conflict.cloud.status}; ${describeOperations(conflict.cloud.operations.slice(0, conflict.cloud.appliedOperationCount))}.`}
					projectId={projectId}
					side="cloud"
					title="Cloud"
				/>
				<Version
					conflict={conflict}
					detail={`Local Working Draft: ${describeOperations(conflict.local.operations.slice(0, conflict.local.appliedOperationCount))}.`}
					projectId={projectId}
					side="local"
					title="Local"
				/>
			</div>
			{resolution ? (
				<p role="status">
					Resolved: you {choiceLabel[resolution.choice]} on{" "}
					{new Date(resolution.resolvedAt).toLocaleString()}.
					{resolution.resultAssetVersionId
						? ` Candidate Version ${resolution.resultAssetVersionId}.`
						: null}
				</p>
			) : (
				<div className="flex flex-wrap gap-3">
					<Button
						disabled={pending}
						onClick={() => choose("create-candidate")}
						type="button"
					>
						Create a separate Candidate Version from the local draft
					</Button>
					<Button
						disabled={pending}
						onClick={() => choose("keep-cloud-retain-draft")}
						type="button"
						variant="outline"
					>
						Keep the cloud version and retain the local draft
					</Button>
					<Button
						disabled={pending}
						onClick={() => setConfirming(true)}
						type="button"
						variant="destructive"
					>
						Abandon the local draft
					</Button>
				</div>
			)}
			{error ? <p role="alert">{error}</p> : null}
			<AlertDialog onOpenChange={setConfirming} open={confirming}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Abandon the local Working Draft?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This cannot be undone. The local draft with{" "}
							{describeOperations(
								conflict.local.operations.slice(
									0,
									conflict.local.appliedOperationCount
								)
							)}{" "}
							will no longer be offered for resolution. The cloud version is not
							changed.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep the local draft</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setConfirming(false);
								choose("abandon", {
									confirmAbandon: true,
									shownLocalDigest: conflict.localDigest,
								}).catch(() => undefined);
							}}
							variant="destructive"
						>
							Abandon the local draft
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</section>
	);
}
