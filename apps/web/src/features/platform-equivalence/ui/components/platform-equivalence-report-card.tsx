import type { PlatformEquivalenceReport } from "@sprite-anvil/api/platform-equivalence";
import {
	notEvaluatedLabels,
	outcomeLabels,
	sectionLabels,
	sectionResultLabels,
} from "../../lib/platform-equivalence-labels";

export function PlatformEquivalenceReportCard({
	report,
}: {
	report: PlatformEquivalenceReport;
}) {
	return (
		<article
			aria-label={`Platform Equivalence Report ${new Date(report.createdAt).toLocaleString()}`}
			className="space-y-4 rounded-lg border p-4"
		>
			<header className="space-y-1">
				<h3 className="font-semibold text-lg">
					Report from {new Date(report.createdAt).toLocaleString()}
				</h3>
				<p className="font-medium">
					{outcomeLabels[report.comparison.outcome]}
				</p>
				{report.comparison.missingSurfaces.length > 0 ? (
					<p className="text-sm">
						Missing run for: {report.comparison.missingSurfaces.join(", ")}.
					</p>
				) : null}
			</header>
			<table className="w-full text-left text-sm">
				<caption className="sr-only">Comparison by evidence section</caption>
				<thead>
					<tr>
						<th className="py-1 pr-4" scope="col">
							Evidence
						</th>
						<th className="py-1 pr-4" scope="col">
							Result
						</th>
						<th className="py-1" scope="col">
							Differing fields
						</th>
					</tr>
				</thead>
				<tbody>
					{report.comparison.sections.map((section) => (
						<tr key={section.section}>
							<th className="py-1 pr-4 font-normal" scope="row">
								{sectionLabels[section.section]}
							</th>
							<td className="py-1 pr-4">
								{sectionResultLabels[section.result]}
							</td>
							<td className="py-1">
								{section.differences.length > 0
									? section.differences.join(", ")
									: "None"}
							</td>
						</tr>
					))}
				</tbody>
			</table>
			<section className="space-y-1 text-sm">
				<h4 className="font-semibold">Not evaluated</h4>
				<ul className="list-disc pl-5">
					{report.notEvaluated.map((item) => (
						<li key={item}>{notEvaluatedLabels[item]}: not evaluated</li>
					))}
				</ul>
			</section>
			<p className="text-muted-foreground text-sm">
				Phase 3 interim evidence. This report does not claim full platform
				acceptance and does not complete PLT-01. Surface names are declared by
				the apps; the server does not verify them.
			</p>
		</article>
	);
}
