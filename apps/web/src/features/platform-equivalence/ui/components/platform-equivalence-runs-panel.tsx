import type { PlatformEquivalenceRun } from "@sprite-anvil/api/platform-equivalence";
import { surfaceLabels } from "../../lib/platform-equivalence-labels";
import { CreateReportForm } from "../forms/create-report-form";

export function PlatformEquivalenceRunsPanel({
	projectId,
	runs,
}: {
	projectId: string;
	/** Newest first. */
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
			<CreateReportForm projectId={projectId} runs={runs} />
		</section>
	);
}
