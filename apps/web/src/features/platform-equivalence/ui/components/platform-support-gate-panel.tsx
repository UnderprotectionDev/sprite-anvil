import type { PlatformSupportSummary } from "@sprite-anvil/api/platform-support-gate";
import {
	blockerLabel,
	combinationStatusLabels,
	openValidationLabels,
} from "../../lib/platform-support-labels";

export function PlatformSupportGatePanel({
	summary,
}: {
	summary: PlatformSupportSummary;
}) {
	return (
		<section
			aria-labelledby="platform-support-gate-heading"
			className="space-y-4 rounded-lg border p-4"
		>
			<h2 className="font-semibold text-xl" id="platform-support-gate-heading">
				Platform Support Gate
			</h2>
			<p className="text-muted-foreground text-sm">
				A combination is supported only when every acceptance scenario is
				equivalent on the Web application and the Desktop application, the
				Delivery Refresh Lock and divergence results are equivalent, the
				accessible core flow passed on both, each with an evidence reference,
				and OV-08 to OV-11 have published parameters and evidence. Anything else
				is unmeasured and is not declared supported.
			</p>
			{summary.combinations.length === 0 ? (
				<p>
					No Supported Platform Matrix combination is published, so no platform
					is declared supported.
				</p>
			) : (
				<ul className="space-y-3">
					{summary.combinations.map((combination) => (
						<li key={combination.combinationId}>
							<p className="font-medium">
								{`${combination.combinationId}: ${combinationStatusLabels[combination.status]}`}
							</p>
							<ul className="list-disc pl-5 text-sm">
								{combination.blockers.map((blocker) => (
									<li key={blockerLabel(blocker)}>{blockerLabel(blocker)}</li>
								))}
							</ul>
						</li>
					))}
				</ul>
			)}
			<div className="space-y-1">
				<h3 className="font-semibold">Open validations</h3>
				<ul className="text-sm">
					{summary.openValidations.map((validation) => (
						<li key={validation.id}>
							{validation.state === "open"
								? `Open: ${openValidationLabels[validation.id]}`
								: `Published: ${openValidationLabels[validation.id]}`}
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
