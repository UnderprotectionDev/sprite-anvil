import type { RuntimeValidationRecord } from "@sprite-anvil/api/runtime-validation";
import { runtimeValidationEvidenceDownloadUrl } from "../../lib/runtime-validation-api";
import {
	evidenceKindLabels,
	evidenceSourceLabels,
	failureSourceLabels,
	outcomeLabels,
} from "../../lib/runtime-validation-labels";
import {
	RuntimeValidationFailureSourceForm,
	RuntimeValidationOutcomeForm,
} from "../forms/runtime-validation-decision-forms";
import { RuntimeValidationEvidenceForm } from "../forms/runtime-validation-evidence-form";

export function RuntimeValidationRecordCard({
	record,
}: {
	record: RuntimeValidationRecord;
}) {
	const rows: [string, string][] = [
		["Export Bundle", record.bundleId],
		["Bundle manifest digest", record.manifestDigest],
		["Game build", record.gameBuild],
		["Engine version", record.engineVersion],
		["Adapter version", record.adapterVersion ?? "None"],
		["Recorded", new Date(record.createdAt).toLocaleString()],
		...(record.supersedesRecordId
			? [["Supersedes record", record.supersedesRecordId] as [string, string]]
			: []),
	];
	return (
		<article
			aria-label={`Runtime Validation Record for build ${record.gameBuild}`}
			className="space-y-4 rounded-lg border p-4"
		>
			<h3 className="font-semibold text-lg">
				{record.gameBuild} on {record.engineVersion}
			</h3>
			<dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
				{rows.map(([term, value]) => (
					<div className="contents" key={term}>
						<dt className="text-muted-foreground">{term}</dt>
						<dd className="break-all">{value}</dd>
					</div>
				))}
			</dl>
			<section aria-label="Outcome" className="space-y-3">
				<h4 className="font-medium">Outcome</h4>
				{record.outcome === null ? (
					<>
						<p>Not finalized. This record does not satisfy any target yet.</p>
						<RuntimeValidationOutcomeForm
							projectId={record.projectId}
							recordId={record.id}
						/>
					</>
				) : (
					<p>
						<strong>{outcomeLabels[record.outcome]}</strong>
						{record.failureSource
							? ` · Failure source: ${failureSourceLabels[record.failureSource]}`
							: ""}
					</p>
				)}
				{record.failureSource === "source_unknown" ? (
					<p role="status">
						Source Unknown blocks any Delivery Target that requires runtime
						validation until you confirm a failure source and test again.
					</p>
				) : null}
				{record.outcome === "fail" ? (
					<>
						{record.failureSource === "source_unknown" ? null : (
							<p role="status">
								Revalidation Required for this use only. Past Review Records and
								Export Bundles, and exports for other uses, are unchanged. Fix
								the cause and save a new record that supersedes this one.
							</p>
						)}
						<RuntimeValidationFailureSourceForm
							projectId={record.projectId}
							recordId={record.id}
						/>
					</>
				) : null}
				{record.decisions.length > 0 ? (
					<ol aria-label="Decision history" className="space-y-1 text-sm">
						{record.decisions.map((decision) => (
							<li key={decision.id}>
								{new Date(decision.createdAt).toLocaleString()} ·{" "}
								{decision.outcome
									? `Outcome ${outcomeLabels[decision.outcome]}`
									: `Failure source ${failureSourceLabels[decision.failureSource ?? "source_unknown"]}`}
							</li>
						))}
					</ol>
				) : null}
			</section>
			<section aria-label="Evidence" className="space-y-2">
				<h4 className="font-medium">Evidence</h4>
				{record.evidence.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No evidence has been added to this record yet.
					</p>
				) : (
					<ul className="space-y-2 text-sm">
						{record.evidence.map((item) => (
							<li className="space-y-1 rounded border p-2" key={item.id}>
								<p className="font-medium">
									{evidenceKindLabels[item.kind]} ·{" "}
									<span className="font-normal text-muted-foreground">
										{evidenceSourceLabels[item.source]}
									</span>
								</p>
								{item.text ? (
									<p className="whitespace-pre-wrap">{item.text}</p>
								) : null}
								{item.file ? (
									<p>
										<a
											className="underline underline-offset-4"
											download={item.file.fileName}
											href={runtimeValidationEvidenceDownloadUrl(
												record.projectId,
												record.id,
												item.id
											)}
										>
											{item.file.fileName}
										</a>{" "}
										<span className="break-all text-muted-foreground">
											({item.file.byteSize} bytes, SHA-256 {item.file.sha256})
										</span>
									</p>
								) : null}
							</li>
						))}
					</ul>
				)}
			</section>
			<RuntimeValidationEvidenceForm
				projectId={record.projectId}
				recordId={record.id}
			/>
		</article>
	);
}
