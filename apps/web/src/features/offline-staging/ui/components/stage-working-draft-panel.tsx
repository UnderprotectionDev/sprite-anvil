import { Button } from "@sprite-anvil/ui/components/button";
import { useState } from "react";
import { useOnlineStatus } from "../../hooks/use-online-status";
import { fetchWorkingDraftForStaging } from "../../lib/offline-staging-api";
import { getDefaultOfflineStagingStore } from "../../lib/offline-staging-store";

/** Keeps a recoverable copy of the open Working Draft in this browser, pinned to its base. */
export function StageWorkingDraftPanel({
	projectId,
	sourceAssetVersionId,
}: {
	projectId: string;
	sourceAssetVersionId: string;
}) {
	const online = useOnlineStatus();
	const [message, setMessage] = useState<string | null>(null);

	async function stage() {
		setMessage(null);
		try {
			const draft = await fetchWorkingDraftForStaging(
				projectId,
				sourceAssetVersionId
			);
			const result =
				await getDefaultOfflineStagingStore().stageWorkingDraft(draft);
			if (result === "kept-existing") {
				setMessage(
					"An earlier staged copy of this Working Draft is kept so its pinned base stays consistent. Check it against the cloud before staging again."
				);
				return;
			}
			setMessage(
				`Working Draft saved offline at revision ${draft.revision}. The cloud stays authoritative.`
			);
		} catch (error) {
			setMessage(
				error instanceof Error ? error.message : "Staging the draft failed."
			);
		}
	}

	return (
		<section
			aria-label="Offline staging"
			className="mx-auto flex w-full max-w-[110rem] flex-wrap items-center gap-3 px-4 pb-6"
		>
			<Button
				disabled={!online}
				onClick={stage}
				type="button"
				variant="outline"
			>
				Stage Working Draft for offline
			</Button>
			{message ? <p role="status">{message}</p> : null}
		</section>
	);
}
