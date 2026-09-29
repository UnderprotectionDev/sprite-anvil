import type {
	FamilyReadiness,
	ReadinessEvidenceInput,
	RequiredSetItem,
} from "@sprite-anvil/api/family-readiness";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { client, orpc } from "@/utils/orpc";

interface DraftItem {
	assetRecordIds: string[];
	disposition: RequiredSetItem["disposition"];
	id: string;
	kind: RequiredSetItem["kind"];
	localId: string;
	name: string;
}

const itemKindLabels: Record<DraftItem["kind"], string> = {
	direction: "Yön",
	animation: "Animasyon",
	state: "Durum",
	variant: "Varyant",
	usage_test: "Kullanım testi",
};

const blockerLabels: Record<string, string> = {
	asset_version: "Güncel Varlık Sürümü yok",
	approval: "Güncel onay kanıtı yok",
	integrity: "Güncel bütünlük doğrulaması yok",
	applicability: "Güncel Bağlama Uygunluk kanıtı yok",
	quality: "Dışa Aktarıma Hazır kalite kanıtı yok",
	quality_contract: "Etkin Özel Profil Sözleşmesi yok",
	usage_test: "Güncel kullanım testi geçmedi",
};

function toDraftItem(item: RequiredSetItem): DraftItem {
	return {
		localId: crypto.randomUUID(),
		id: item.id,
		kind: item.kind,
		name: item.name,
		disposition: item.disposition,
		assetRecordIds: item.assetRecordIds,
	};
}

function familyStatusLabel(status: FamilyReadiness["status"]) {
	if (status === "complete") {
		return "Aile tamamlandı.";
	}
	if (status === "not_configured") {
		return "Henüz etkin bir liste sürümü yok.";
	}
	return "Aile tamamlanmadı; gerekli öğelerin güncel kanıtları eksik.";
}

function revisionStatusLabel(revision: FamilyReadiness["revisions"][number]) {
	if (revision.isActive) {
		return "Etkin";
	}
	if (revision.wasActivated) {
		return "Geçmiş";
	}
	return "Taslak";
}

export function FamilyReadinessManager({
	assetFamilyId,
	familyName,
	projectId,
	assetRecords,
}: {
	assetFamilyId: string;
	familyName: string;
	projectId: string;
	assetRecords: { id: string; name: string }[];
}) {
	const query = useQuery({
		...orpc.familyReadiness.list.queryOptions({
			input: { projectId, assetFamilyId },
		}),
	});
	const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
	const [isSaving, setIsSaving] = useState(false);
	const [message, setMessage] = useState("");
	const lastLoadedRevisionId = useRef<string | null>(null);
	const latestRevision = query.data?.revisions.at(-1);
	const activeRevisionId = query.data?.activeRevision?.id;

	useEffect(() => {
		const sourceRevision = latestRevision ?? query.data?.activeRevision;
		const sourceId = sourceRevision?.id ?? "empty";
		if (lastLoadedRevisionId.current === sourceId) {
			return;
		}
		lastLoadedRevisionId.current = sourceId;
		setDraftItems(sourceRevision?.items.map(toDraftItem) ?? []);
	}, [latestRevision, query.data?.activeRevision]);

	function updateItem(localId: string, change: Partial<DraftItem>) {
		setDraftItems((items) =>
			items.map((item) =>
				item.localId === localId ? { ...item, ...change } : item
			)
		);
	}

	async function refresh() {
		const result = await query.refetch();
		return !result.isError;
	}

	async function runWrite(
		write: () => Promise<unknown>,
		successMessage: string
	) {
		setIsSaving(true);
		setMessage("");
		try {
			await write();
			if (await refresh()) {
				setMessage(successMessage);
			} else {
				setMessage(
					`${successMessage} Görünüm yenilenemedi; sayfayı yenileyin.`
				);
			}
			return true;
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "İşlem kaydedilemedi. Yeniden deneyin."
			);
			return false;
		} finally {
			setIsSaving(false);
		}
	}

	function saveDraft(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const items: RequiredSetItem[] = draftItems.map(
			({ localId: _localId, ...item }) => item
		);
		void runWrite(
			() =>
				client.familyReadiness.saveDraft({
					projectId,
					assetFamilyId,
					items,
				}),
			"Yeni liste sürümü taslak olarak kaydedildi."
		);
	}

	function activateRevision(revisionId: string) {
		void runWrite(
			() =>
				client.familyReadiness.activate({
					projectId,
					assetFamilyId,
					revisionId,
				}),
			"Gerekli Öğeler Listesi sürümü etkinleştirildi."
		);
	}

	function recordEvidence(input: ReadinessEvidenceInput) {
		return runWrite(
			() => client.familyReadiness.recordEvidence(input),
			"Kanıt kaydedildi ve güncel durum yeniden hesaplandı."
		);
	}

	return (
		<article className="space-y-5 rounded-lg border p-5">
			<header className="space-y-2">
				<p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
					Gerekli Öğeler Listesi
				</p>
				<h3 className="font-semibold text-xl">{familyName}</h3>
				{query.data ? (
					<p aria-live="polite" className="text-sm">
						{familyStatusLabel(query.data.status)}
					</p>
				) : null}
			</header>

			{query.isPending ? <p>Gerekli Öğeler Listesi yükleniyor…</p> : null}
			{query.isError ? (
				<p role="alert">Gerekli Öğeler Listesi yüklenemedi.</p>
			) : null}
			{message ? (
				<p aria-live="polite" role="status">
					{message}
				</p>
			) : null}

			{query.data?.activeRevision ? (
				<section
					aria-labelledby={`active-set-${assetFamilyId}`}
					className="space-y-3"
				>
					<h4 className="font-medium" id={`active-set-${assetFamilyId}`}>
						Etkin Sürüm {query.data.activeRevision.revisionNumber}
					</h4>
					{query.data.activeRevision.items.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							Bu sürümde zorunlu öğe yok.
						</p>
					) : (
						<ul className="space-y-4">
							{query.data.items.map((itemResult) => (
								<li className="rounded-md border p-4" key={itemResult.item.id}>
									<div className="flex flex-wrap items-start justify-between gap-2">
										<div>
											<h5 className="font-medium">{itemResult.item.name}</h5>
											<p className="text-muted-foreground text-sm">
												{itemKindLabels[itemResult.item.kind]} ·{" "}
												{itemResult.item.disposition}
											</p>
										</div>
										<strong className="text-sm">
											{itemResult.status === "complete"
												? "Tamamlandı"
												: "Eksik"}
										</strong>
									</div>
									{itemResult.blockers.length > 0 ? (
										<ul className="mt-2 list-inside list-disc text-muted-foreground text-sm">
											{itemResult.blockers.map((blocker) => (
												<li key={blocker}>
													{blockerLabels[blocker] ?? blocker}
												</li>
											))}
										</ul>
									) : null}
									{itemResult.latestEvidence.map((evidence) => (
										<p
											className="mt-2 text-muted-foreground text-xs"
											key={evidence.id}
										>
											{evidence.kind}: {evidence.result} ·{" "}
											{evidence.isCurrent ? "Güncel" : "Eski kanıt"}
										</p>
									))}
									{itemResult.item.disposition === "required" ? (
										<ReadinessEvidenceForms
											assetFamilyId={assetFamilyId}
											isSaving={isSaving}
											item={itemResult.item}
											onRecord={recordEvidence}
											projectId={projectId}
											revisionId={activeRevisionId ?? ""}
										/>
									) : null}
								</li>
							))}
						</ul>
					)}
				</section>
			) : null}

			<form className="space-y-4 border-t pt-4" onSubmit={saveDraft}>
				<div>
					<h4 className="font-medium">
						{latestRevision && !latestRevision.isActive
							? `Sürüm ${latestRevision.revisionNumber} taslağını düzenle`
							: "Yeni liste sürümü hazırla"}
					</h4>
					<p className="text-muted-foreground text-sm">
						Kaydedilen taslak aile tamamlanmasını değiştirmez; etkisi yalnız
						etkinleştirildiğinde başlar.
					</p>
				</div>
				{draftItems.map((item) => (
					<RequiredSetItemEditor
						assetRecords={assetRecords}
						item={item}
						key={item.localId}
						onChange={(change) => updateItem(item.localId, change)}
						onRemove={() =>
							setDraftItems((items) =>
								items.filter((entry) => entry.localId !== item.localId)
							)
						}
					/>
				))}
				<div className="flex flex-wrap gap-2">
					<Button
						disabled={isSaving}
						onClick={() =>
							setDraftItems((items) => [
								...items,
								{
									localId: crypto.randomUUID(),
									id: `item-${crypto.randomUUID()}`,
									kind: "direction",
									name: "",
									disposition: "required",
									assetRecordIds: [],
								},
							])
						}
						type="button"
						variant="outline"
					>
						Öğe ekle
					</Button>
					<Button disabled={isSaving || query.isPending} type="submit">
						{isSaving ? "Kaydediliyor…" : "Taslak sürümü kaydet"}
					</Button>
				</div>
			</form>

			{query.data && query.data.revisions.length > 0 ? (
				<section
					aria-labelledby={`set-history-${assetFamilyId}`}
					className="space-y-2"
				>
					<h4 className="font-medium" id={`set-history-${assetFamilyId}`}>
						Sürümler
					</h4>
					<ul className="space-y-2">
						{[...query.data.revisions].reverse().map((revision) => (
							<li
								className="flex flex-wrap items-center justify-between gap-2"
								key={revision.id}
							>
								<span>
									Sürüm {revision.revisionNumber} ·{" "}
									{revisionStatusLabel(revision)}
								</span>
								{revision.isActive ? null : (
									<Button
										disabled={isSaving}
										onClick={() => activateRevision(revision.id)}
										type="button"
										variant="outline"
									>
										Bu sürümü etkinleştir
									</Button>
								)}
							</li>
						))}
					</ul>
				</section>
			) : null}
		</article>
	);
}

function RequiredSetItemEditor({
	assetRecords,
	item,
	onChange,
	onRemove,
}: {
	assetRecords: { id: string; name: string }[];
	item: DraftItem;
	onChange: (change: Partial<DraftItem>) => void;
	onRemove: () => void;
}) {
	const idPrefix = `required-set-${item.id}`;
	return (
		<fieldset className="space-y-3 rounded-md border p-4">
			<legend className="px-1 font-medium">Gerekli öğe</legend>
			<div className="grid gap-3 sm:grid-cols-2">
				<label className="space-y-1 text-sm">
					<span>Öğe kimliği</span>
					<input
						className="w-full rounded-md border bg-background px-3 py-2"
						id={`${idPrefix}-id`}
						maxLength={100}
						onChange={(event) => onChange({ id: event.currentTarget.value })}
						pattern="[a-z][a-z0-9._-]*"
						required
						value={item.id}
					/>
				</label>
				<label className="space-y-1 text-sm">
					<span>Öğe adı</span>
					<input
						className="w-full rounded-md border bg-background px-3 py-2"
						id={`${idPrefix}-name`}
						maxLength={120}
						onChange={(event) => onChange({ name: event.currentTarget.value })}
						required
						value={item.name}
					/>
				</label>
				<label className="space-y-1 text-sm">
					<span>Öğe türü</span>
					<select
						className="w-full rounded-md border bg-background px-3 py-2"
						id={`${idPrefix}-kind`}
						onChange={(event) =>
							onChange({
								kind: event.currentTarget.value as DraftItem["kind"],
								assetRecordIds: [],
							})
						}
						value={item.kind}
					>
						{Object.entries(itemKindLabels).map(([kind, label]) => (
							<option key={kind} value={kind}>
								{label}
							</option>
						))}
					</select>
				</label>
				<label className="space-y-1 text-sm">
					<span>Durum</span>
					<select
						className="w-full rounded-md border bg-background px-3 py-2"
						id={`${idPrefix}-disposition`}
						onChange={(event) =>
							onChange({
								disposition: event.currentTarget
									.value as DraftItem["disposition"],
							})
						}
						value={item.disposition}
					>
						<option value="required">Gerekli</option>
						<option value="optional">İsteğe bağlı</option>
						<option value="inapplicable">Uygulanamaz</option>
					</select>
				</label>
			</div>
			{item.kind === "usage_test" ? (
				<fieldset className="space-y-2">
					<legend className="text-sm">Teste katılacak Varlık Kayıtları</legend>
					{assetRecords.map((record) => (
						<label className="flex items-center gap-2 text-sm" key={record.id}>
							<input
								checked={item.assetRecordIds.includes(record.id)}
								onChange={(event) =>
									onChange({
										assetRecordIds: event.currentTarget.checked
											? [...item.assetRecordIds, record.id]
											: item.assetRecordIds.filter((id) => id !== record.id),
									})
								}
								type="checkbox"
							/>
							{record.name}
						</label>
					))}
				</fieldset>
			) : (
				<label className="block space-y-1 text-sm">
					<span>Varlık Kaydı</span>
					<select
						className="w-full rounded-md border bg-background px-3 py-2"
						onChange={(event) =>
							onChange({
								assetRecordIds: event.currentTarget.value
									? [event.currentTarget.value]
									: [],
							})
						}
						required={item.disposition === "required"}
						value={item.assetRecordIds[0] ?? ""}
					>
						<option value="">Varlık Kaydı seçin</option>
						{assetRecords.map((record) => (
							<option key={record.id} value={record.id}>
								{record.name}
							</option>
						))}
					</select>
				</label>
			)}
			<Button onClick={onRemove} type="button" variant="outline">
				Öğeyi kaldır
			</Button>
		</fieldset>
	);
}

function ReadinessEvidenceForms({
	assetFamilyId,
	item,
	isSaving,
	onRecord,
	projectId,
	revisionId,
}: {
	assetFamilyId: string;
	item: RequiredSetItem;
	isSaving: boolean;
	onRecord: (input: ReadinessEvidenceInput) => Promise<boolean>;
	projectId: string;
	revisionId: string;
}) {
	if (item.kind === "usage_test") {
		return (
			<EvidenceForm
				assetFamilyId={assetFamilyId}
				description="Kullanım testi sonucu"
				initialResult="passed"
				isSaving={isSaving}
				item={item}
				kind="usage_test"
				onRecord={onRecord}
				projectId={projectId}
				revisionId={revisionId}
			/>
		);
	}
	return (
		<div className="mt-4 grid gap-4 lg:grid-cols-2">
			<EvidenceForm
				assetFamilyId={assetFamilyId}
				description="Bağlama Uygunluk değerlendirmesi"
				initialResult="applicable"
				isSaving={isSaving}
				item={item}
				kind="applicability"
				onRecord={onRecord}
				projectId={projectId}
				revisionId={revisionId}
			/>
			<EvidenceForm
				assetFamilyId={assetFamilyId}
				description="Kalite kuralı kanıtı"
				initialResult="passed"
				isSaving={isSaving}
				item={item}
				kind="quality"
				onRecord={onRecord}
				projectId={projectId}
				revisionId={revisionId}
			/>
		</div>
	);
}

function EvidenceForm({
	assetFamilyId,
	description,
	initialResult,
	isSaving,
	item,
	kind,
	onRecord,
	projectId,
	revisionId,
}: {
	assetFamilyId: string;
	description: string;
	initialResult: "applicable" | "passed";
	isSaving: boolean;
	item: RequiredSetItem;
	kind: "applicability" | "quality" | "usage_test";
	onRecord: (input: ReadinessEvidenceInput) => Promise<boolean>;
	projectId: string;
	revisionId: string;
}) {
	const [result, setResult] = useState<
		"applicable" | "inapplicable" | "passed" | "failed" | "inconclusive"
	>(initialResult);
	const [ruleId, setRuleId] = useState("");
	const [method, setMethod] = useState("");
	const [rationale, setRationale] = useState("");
	const formId = `${kind}-${item.id}`;

	function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const shared = {
			projectId,
			assetFamilyId,
			revisionId,
			itemId: item.id,
			kind,
			result,
			rationale,
		};
		if (kind === "applicability") {
			void onRecord({
				...shared,
				kind,
				result: result as "applicable" | "inapplicable",
			});
		} else if (kind === "quality") {
			void onRecord({
				...shared,
				kind,
				result: result as "passed" | "failed" | "inconclusive",
				ruleId,
				method,
			});
		} else {
			void onRecord({
				...shared,
				kind,
				result: result as "passed" | "failed" | "inconclusive",
				method,
			});
		}
	}

	return (
		<form className="space-y-2 rounded-md bg-muted/30 p-3" onSubmit={submit}>
			<h6 className="font-medium text-sm">{description}</h6>
			<label className="block space-y-1 text-sm" htmlFor={`${formId}-result`}>
				<span>Sonuç</span>
				<select
					className="w-full rounded-md border bg-background px-3 py-2"
					id={`${formId}-result`}
					onChange={(event) =>
						setResult(event.currentTarget.value as typeof result)
					}
					value={result}
				>
					{kind === "applicability" ? (
						<>
							<option value="applicable">Bağlama uygun</option>
							<option value="inapplicable">Bağlama uygun değil</option>
						</>
					) : (
						<>
							<option value="passed">Geçti</option>
							<option value="failed">Başarısız</option>
							<option value="inconclusive">Sonuçsuz</option>
						</>
					)}
				</select>
			</label>
			{kind === "quality" ? (
				<label className="block space-y-1 text-sm" htmlFor={`${formId}-rule`}>
					<span>Kural kimliği</span>
					<input
						className="w-full rounded-md border bg-background px-3 py-2"
						id={`${formId}-rule`}
						maxLength={120}
						onChange={(event) => setRuleId(event.currentTarget.value)}
						pattern="[a-z][a-z0-9._-]*"
						required
						value={ruleId}
					/>
				</label>
			) : null}
			{kind === "applicability" ? null : (
				<label className="block space-y-1 text-sm" htmlFor={`${formId}-method`}>
					<span>Yöntem</span>
					<textarea
						className="min-h-16 w-full rounded-md border bg-background px-3 py-2"
						id={`${formId}-method`}
						maxLength={1000}
						onChange={(event) => setMethod(event.currentTarget.value)}
						required
						value={method}
					/>
				</label>
			)}
			<label
				className="block space-y-1 text-sm"
				htmlFor={`${formId}-rationale`}
			>
				<span>Gerekçe veya gözlem</span>
				<textarea
					className="min-h-16 w-full rounded-md border bg-background px-3 py-2"
					id={`${formId}-rationale`}
					maxLength={2000}
					onChange={(event) => setRationale(event.currentTarget.value)}
					required
					value={rationale}
				/>
			</label>
			<Button disabled={isSaving} type="submit" variant="outline">
				Kanıtı kaydet
			</Button>
		</form>
	);
}
