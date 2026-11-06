import { Button } from "@sprite-anvil/ui/components/button";
import { Link } from "@tanstack/react-router";
import type {
	OfflineStagingStore,
	StagedDraftRow,
} from "../../lib/offline-staging-store";
import { StageOperationForm } from "./stage-operation-form";

/** Staged Working Drafts kept in this browser, their local edits and the reconnect check. */
export function StagedDraftsSection({
	canCheck,
	drafts,
	onCheck,
	onEdited,
	projectId,
	store,
}: {
	canCheck: boolean;
	drafts: StagedDraftRow[];
	onCheck: () => void;
	onEdited: () => Promise<unknown>;
	projectId: string;
	store: OfflineStagingStore;
}) {
	return (
		<section aria-labelledby="offline-drafts" className="space-y-3">
			<h2 className="font-medium text-lg" id="offline-drafts">
				Staged Working Drafts
			</h2>
			{drafts.length ? (
				<ul className="space-y-2">
					{drafts.map((entry) => {
						const localEdits = entry.draft.operations.slice(
							0,
							entry.draft.appliedOperationCount
						).length;
						return (
							<li className="space-y-2 rounded-md border p-3" key={entry.id}>
								<p>Source Asset Version {entry.base.sourceAssetVersionId}</p>
								<p className="text-muted-foreground text-sm">
									Pinned base revision {entry.base.revision}; saved draft at
									revision {entry.draft.revision} with {localEdits}{" "}
									operation(s), kept recoverable in this browser.
								</p>
								<StageOperationForm
									draft={entry.draft}
									onAdded={onEdited}
									store={store}
								/>
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
						);
					})}
				</ul>
			) : (
				<p className="text-muted-foreground text-sm">
					No staged Working Drafts. Stage one from the Pixel Editor while
					online.
				</p>
			)}
			<Button
				disabled={!canCheck}
				onClick={onCheck}
				type="button"
				variant="outline"
			>
				Check staged Working Drafts against the cloud
			</Button>
		</section>
	);
}
