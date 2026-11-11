import type { DeliveryRefreshLockRefreshResult } from "@sprite-anvil/api/delivery-refresh-locks";

function Paths({ label, paths }: { label: string; paths: string[] }) {
	return (
		<div className="space-y-1">
			<h4 className="font-medium text-sm">{label}</h4>
			{paths.length === 0 ? (
				<p className="text-sm">None.</p>
			) : (
				<ul aria-label={label} className="font-mono text-sm">
					{paths.map((path) => (
						<li key={path}>{path}</li>
					))}
				</ul>
			)}
		</div>
	);
}

function headline(result: DeliveryRefreshLockRefreshResult): string {
	if (result.status === "halted") {
		return "Refresh halted. Diverged paths still wait for a decision; no new lock was recorded and this is not a completed delivery.";
	}
	if (result.outcome === "partial") {
		return "Partial refresh recorded. Preserved paths were kept out of the new lock; this is not a completed delivery.";
	}
	return "Refresh recorded. Every file of the bundle is applied and locked.";
}

/** The server-verified result: applied paths and halted or preserved divergences, listed apart. */
export function RefreshResultPanel({
	result,
}: {
	result: DeliveryRefreshLockRefreshResult;
}) {
	return (
		<section
			aria-labelledby="refresh-result-heading"
			className="space-y-3 border-t pt-4"
		>
			<h3 className="font-semibold text-base" id="refresh-result-heading">
				Refresh result
			</h3>
			<p>{headline(result)}</p>
			<Paths label="Applied paths" paths={result.applied} />
			{result.status === "halted" ? (
				<Paths
					label="Halted divergences"
					paths={result.halted.map((entry) => entry.path)}
				/>
			) : null}
			<Paths
				label="Preserved paths"
				paths={result.preserved.map((held) => held.path)}
			/>
		</section>
	);
}
