import type {
	OfflineAbandonConfirmation,
	OfflineConflictChoice,
	OfflineConflictView,
} from "@sprite-anvil/api/offline-conflict";
import { Button } from "@sprite-anvil/ui/components/button";
import type { AbandonConfirmationInput } from "../../hooks/use-offline-reconcile";
import type { ReconcileEntry } from "../../lib/reconcile-staged-drafts";
import { OfflineConflictPanel } from "./offline-conflict-panel";

/** The reconnect check's outcome per staged Working Draft: finalize it, or resolve its conflict. */
export function ReconcileSection({
	entries,
	message,
	onFinalize,
	onRequestAbandon,
	onResolve,
	projectId,
}: {
	entries: ReconcileEntry[];
	message: string | null;
	onFinalize: (draftId: string, revision: number) => void;
	onRequestAbandon: (
		conflict: OfflineConflictView
	) => Promise<
		| { confirmation: OfflineAbandonConfirmation; ok: true }
		| { message: string; ok: false }
	>;
	onResolve: (
		conflict: OfflineConflictView,
		choice: OfflineConflictChoice,
		confirmation?: AbandonConfirmationInput
	) => Promise<string | null>;
	projectId: string;
}) {
	return (
		<section aria-labelledby="offline-reconcile" className="space-y-4">
			<h2 className="font-medium text-lg" id="offline-reconcile">
				Reconnect check
			</h2>
			{message ? <p role="status">{message}</p> : null}
			{entries.map((entry) => {
				if (entry.kind === "conflict") {
					return (
						<OfflineConflictPanel
							conflict={entry.conflict}
							key={entry.conflict.id}
							onRequestAbandon={onRequestAbandon}
							onResolve={onResolve}
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
								The cloud has not changed since the base was pinned: this
								Working Draft, with its local operations, can be finalized
								normally.
							</p>
							<Button
								onClick={() => onFinalize(entry.draftId, entry.draft.revision)}
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
	);
}
