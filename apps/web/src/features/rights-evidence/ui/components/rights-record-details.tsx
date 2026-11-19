import type { RightsRecord } from "@sprite-anvil/api/rights-records";
import { rightsRecordEvidenceFileUrl } from "../../lib/rights-record-api";

export function RightsRecordDetails({
	projectId,
	record,
}: {
	projectId: string;
	record: RightsRecord;
}) {
	return (
		<dl className="grid gap-3 sm:grid-cols-2">
			<HistoryField label="Source" value={record.source} />
			<HistoryField
				label="Rights holder or provider"
				value={record.rightsHolderOrProvider}
			/>
			<HistoryField
				label="Declared permission scope"
				value={record.assertedScope}
			/>
			<HistoryField
				label="Evidence supporting the Rights Record"
				value={record.evidence}
			/>
			{record.evidenceFile ? (
				<div>
					<dt className="text-sm font-medium">Evidence file</dt>
					<dd className="mt-1 text-sm">
						{record.evidenceFile.availability === "excluded" ? (
							<span>
								{record.evidenceFile.fileName} (not included in Project Archive)
							</span>
						) : (
							<a
								download={record.evidenceFile.fileName}
								href={rightsRecordEvidenceFileUrl(
									projectId,
									record.assetRecordId,
									record.id,
									record.referenceId ?? null
								)}
							>
								{record.evidenceFile.fileName}
							</a>
						)}
					</dd>
				</div>
			) : null}
			<HistoryField label="Known restrictions" value={record.restrictions} />
			<HistoryField label="Uncertainty" value={record.uncertainty} />
		</dl>
	);
}

function HistoryField({
	label,
	value,
}: {
	label: string;
	value: string | null;
}) {
	return (
		<div>
			<dt className="text-sm font-medium">{label}</dt>
			<dd className="text-muted-foreground mt-1 text-sm break-words whitespace-pre-wrap">
				{value || "Belirtilmedi"}
			</dd>
		</div>
	);
}
