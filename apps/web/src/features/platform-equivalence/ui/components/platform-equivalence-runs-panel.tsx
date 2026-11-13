import type { PlatformEquivalenceRun } from "@sprite-anvil/api/platform-equivalence";
import { Button } from "@sprite-anvil/ui/components/button";
import { StatusMessage } from "@/components/status-message";
import { surfaceLabels } from "../../lib/platform-equivalence-labels";

export function PlatformEquivalenceRunsPanel({
	canCompare,
	failure,
	isPending,
	onCompare,
	runs,
}: {
	canCompare: boolean;
	failure: string | null;
	isPending: boolean;
	onCompare: () => void;
	runs: PlatformEquivalenceRun[];
}) {
	return (
		<section className="space-y-3 rounded-lg border p-4">
			<h2 className="font-semibold text-xl">Runs</h2>
			{runs.length === 0 ? (
				<p className="text-muted-foreground">No run has been recorded yet.</p>
			) : (
				<ul className="space-y-1 text-sm">
					{runs.map((run) => (
						<li key={run.id}>
							{surfaceLabels[run.surface]} ·{" "}
							{new Date(run.createdAt).toLocaleString()} · input{" "}
							{run.evidence.inputDigest.slice(0, 12)}
						</li>
					))}
				</ul>
			)}
			{failure ? <StatusMessage tone="error">{failure}</StatusMessage> : null}
			<Button
				className="min-h-11"
				disabled={isPending || !canCompare}
				onClick={onCompare}
				type="button"
			>
				{isPending ? "Creating report…" : "Create report from latest runs"}
			</Button>
		</section>
	);
}
