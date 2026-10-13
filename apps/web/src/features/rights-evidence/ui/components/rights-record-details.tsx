import type { RightsRecord } from "@sprite-anvil/api/rights-records";
import { rightsRecordEvidenceFileUrl } from "./rights-record-api";

export function RightsRecordDetails({
	projectId,
	record,
}: {
	projectId: string;
	record: RightsRecord;
}) {
	return (
		<dl className="grid gap-3 sm:grid-cols-2">
			<HistoryField label="Kaynak" value={record.source} />
			<HistoryField
				label="Hak sahibi veya sağlayıcı"
				value={record.rightsHolderOrProvider}
			/>
			<HistoryField
				label="Beyan edilen izin kapsamı"
				value={record.assertedScope}
			/>
			<HistoryField
				label="Hak kaydını destekleyen kanıt"
				value={record.evidence}
			/>
			{record.evidenceFile ? (
				<div>
					<dt className="font-medium text-sm">Kanıt dosyası</dt>
					<dd className="mt-1 text-sm">
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
					</dd>
				</div>
			) : null}
			<HistoryField label="Bilinen kısıtlar" value={record.restrictions} />
			<HistoryField label="Belirsizlik" value={record.uncertainty} />
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
			<dt className="font-medium text-sm">{label}</dt>
			<dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground text-sm">
				{value || "Belirtilmedi"}
			</dd>
		</div>
	);
}
