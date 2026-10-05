import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type {
	FamilyReadiness,
	QualityVersionTarget,
	ReadinessEvidence,
	ReadinessEvidenceInput,
	RequiredSetItem,
} from "@sprite-anvil/api/family-readiness";
import type { SpecializedProfileContractsListOutput } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type {
	IconPixelDimensions,
	IconUsagePreviewContext,
} from "@/features/icon-profile/ui/components/icon-usage-evidence-fields";
import {
	formatIconPixelDimensions as formatPixelDimensions,
	IconUsageEvidenceFields,
} from "@/features/icon-profile/ui/components/icon-usage-evidence-fields";
import { client, orpc } from "@/utils/orpc";

interface DraftItem {
	assetRecordIds: string[];
	disposition: RequiredSetItem["disposition"];
	id: string;
	kind: RequiredSetItem["kind"];
	localId: string;
	name: string;
	testId?: string;
}

type PixelDimensions = IconPixelDimensions;

interface FamilyReadinessAssetRecord {
	assetCategory: string | null;
	id: string;
	logicalResolution?: PixelDimensions | null;
	name: string;
}

const iconTargetSizeTestId = "icon.light_dark_target_size";

function parsePositivePixelDimension(value: string) {
	const dimension = Number(value);
	return Number.isSafeInteger(dimension) &&
		dimension > 0 &&
		dimension <= 2_147_483_647
		? dimension
		: null;
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
	profile_contract_usage_test:
		"Sözleşmenin zorunlu kullanım testleri tamamlanmadı",
};

const qualityReadinessLabels = {
	export_ready: "Dışa Aktarıma Hazır",
	exceptions_ready: "İstisnalarla Hazır",
	not_assessed: "Kalite henüz değerlendirilmedi",
	blocked: "Kalite koşulları karşılanmadı",
} satisfies Record<
	FamilyReadiness["items"][number]["qualityReadiness"],
	string
>;

const requirementResultLabels = {
	passed: "Geçti",
	failed: "Başarısız",
	inconclusive: "Sonuçsuz",
	waived: "Kalite İstisnası verildi",
	not_assessed: "Değerlendirilmedi",
} as const;

const ruleClassLabels = {
	integrity_gate: "Bütünlük Denetimi",
	waivable_requirement: "İstisna Verilebilir Gereksinim",
	quality_advisory: "Kalite Uyarısı",
	human_review: "Zorunlu insan incelemesi",
	general_asset_support: "Genel Varlık Desteği",
} as const;

const evidenceKindLabels = {
	applicability: "Bağlama Uygunluk",
	quality: "Kalite kanıtı",
	usage_test: "Kullanım testi",
} as const;

const evidenceResultLabels = {
	applicable: "Bağlama uygun",
	inapplicable: "Bağlama uygun değil",
	passed: "Geçti",
	failed: "Başarısız",
	inconclusive: "Sonuçsuz",
	waived: "Kalite İstisnası verildi",
} as const;

function toDraftItem(item: RequiredSetItem): DraftItem {
	return {
		localId: crypto.randomUUID(),
		id: item.id,
		kind: item.kind,
		name: item.name,
		disposition: item.disposition,
		assetRecordIds: item.assetRecordIds,
		...(item.testId ? { testId: item.testId } : {}),
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

function getUsageTestOptions(
	item: DraftItem,
	assetRecords: { assetCategory: string | null; id: string; name: string }[],
	profileContracts: SpecializedProfileContractsListOutput | null
) {
	const linkedRecords = assetRecords.filter((record) =>
		item.assetRecordIds.includes(record.id)
	);
	const specializedRecords = linkedRecords.filter((record) =>
		profileContracts?.profiles.some(
			(profile) => profile.definition.profileId === record.assetCategory
		)
	);
	if (specializedRecords.length === 0) {
		return [];
	}
	const firstProfile = profileContracts?.profiles.find(
		(profile) =>
			profile.definition.profileId === specializedRecords[0]?.assetCategory
	);
	const firstTests = firstProfile?.activeContract?.contract.usageTests ?? [];
	return firstTests.filter((test) =>
		specializedRecords.every((record) =>
			profileContracts?.profiles
				.find(
					(profile) => profile.definition.profileId === record.assetCategory
				)
				?.activeContract?.contract.usageTests.some(
					(candidate) => candidate.id === test.id
				)
		)
	);
}

function usageTestGuidance(
	usageTestCount: number,
	selectedSpecializedRecord: boolean
) {
	if (usageTestCount > 0) {
		return "Etkin sözleşmedeki test kimliklerinden birini kullanın.";
	}
	if (selectedSpecializedRecord) {
		return "Özel profil test kimliklerini kullanmadan önce sözleşmeyi etkinleştirin.";
	}
	return "Genel Varlık Desteği için kararlı bir test kimliği yazın.";
}

export function FamilyReadinessManager({
	assetFamilyId,
	familyName,
	projectId,
	assetRecords,
	assetVersions = [],
	profileContracts,
}: {
	assetFamilyId: string;
	familyName: string;
	projectId: string;
	assetRecords: FamilyReadinessAssetRecord[];
	assetVersions?: AssetVersion[];
	profileContracts: SpecializedProfileContractsListOutput | null;
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
			items.map((item) => {
				if (item.localId !== localId) {
					return item;
				}
				const updatedItem = { ...item, ...change };
				if (change.kind && change.kind !== "usage_test") {
					const { testId: _testId, ...itemWithoutTestId } = updatedItem;
					return itemWithoutTestId;
				}
				return updatedItem;
			})
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
								<FamilyReadinessItemCard
									activeRevisionId={activeRevisionId ?? ""}
									assetFamilyId={assetFamilyId}
									assetRecords={assetRecords}
									assetVersions={assetVersions}
									isSaving={isSaving}
									itemResult={itemResult}
									key={itemResult.item.id}
									onRecord={recordEvidence}
									profileContracts={profileContracts}
									projectId={projectId}
								/>
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
						assetFamilyId={assetFamilyId}
						assetRecords={assetRecords}
						item={item}
						key={item.localId}
						onChange={(change) => updateItem(item.localId, change)}
						onRemove={() =>
							setDraftItems((items) =>
								items.filter((entry) => entry.localId !== item.localId)
							)
						}
						profileContracts={profileContracts}
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

function FamilyReadinessItemCard({
	activeRevisionId,
	assetFamilyId,
	assetRecords,
	assetVersions,
	isSaving,
	itemResult,
	onRecord,
	profileContracts,
	projectId,
}: {
	activeRevisionId: string;
	assetFamilyId: string;
	assetRecords: FamilyReadinessAssetRecord[];
	assetVersions: AssetVersion[];
	isSaving: boolean;
	itemResult: FamilyReadiness["items"][number];
	onRecord: (input: ReadinessEvidenceInput) => Promise<boolean>;
	profileContracts: SpecializedProfileContractsListOutput | null;
	projectId: string;
}) {
	return (
		<li className="rounded-md border p-4">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					<h5 className="font-medium">{itemResult.item.name}</h5>
					<p className="text-muted-foreground text-sm">
						{itemKindLabels[itemResult.item.kind]} ·{" "}
						{itemResult.item.disposition}
					</p>
				</div>
				<strong className="text-sm">
					{itemResult.status === "complete" ? "Tamamlandı" : "Eksik"}
				</strong>
			</div>
			{itemResult.blockers.length > 0 ? (
				<ul className="mt-2 list-inside list-disc text-muted-foreground text-sm">
					{itemResult.blockers.map((blocker) => (
						<li key={blocker}>{blockerLabels[blocker] ?? blocker}</li>
					))}
				</ul>
			) : null}
			<QualityEvaluationSummary itemResult={itemResult} />
			<HumanReviewSummary requirements={itemResult.humanReviewRequirements} />
			{itemResult.latestEvidence.map((evidence) => (
				<ReadinessEvidenceDetails evidence={evidence} key={evidence.id} />
			))}
			{itemResult.item.disposition === "required" ? (
				<ReadinessEvidenceForms
					assetFamilyId={assetFamilyId}
					assetRecords={assetRecords}
					assetVersions={assetVersions}
					currentAssetVersionIds={itemResult.currentAssetVersionIds}
					humanReviewRequirements={itemResult.humanReviewRequirements}
					isSaving={isSaving}
					item={itemResult.item}
					latestEvidence={itemResult.latestEvidence}
					onRecord={onRecord}
					profileContracts={profileContracts}
					projectId={projectId}
					qualityRequirements={itemResult.qualityRequirements}
					revisionId={activeRevisionId}
					versionTargets={itemResult.qualityVersionTargets ?? []}
				/>
			) : null}
		</li>
	);
}

function QualityEvaluationSummary({
	itemResult,
}: {
	itemResult: FamilyReadiness["items"][number];
}) {
	return (
		<section aria-label="Kalite değerlendirmesi" className="mt-3 space-y-2">
			<p className="text-muted-foreground text-sm">
				Yerel denetimler ve insan incelemesi harici analiz izni olmadan sürer.
				Bu değerlendirme sanatsal kabul kararı veya tek kalite puanı değildir;
				harici görsel analiz için proje ve kategori izni ayrıca gerekir.
			</p>
			<p className="text-sm">
				Kalite durumu:{" "}
				<strong>{qualityReadinessLabels[itemResult.qualityReadiness]}</strong>
			</p>
			{itemResult.qualityRequirements.length > 0 ? (
				<ul className="space-y-1 text-muted-foreground text-sm">
					{itemResult.qualityRequirements.map((requirement) => (
						<li key={requirement.id}>
							{requirement.name} · {requirement.id} ·{" "}
							{ruleClassLabels[requirement.class]} ·{" "}
							{requirementResultLabels[requirement.result]}
							{requirement.required ? " · Gerekli" : " · Uyarı"}
						</li>
					))}
				</ul>
			) : null}
			{itemResult.usageRequirements.length > 0 ? (
				<ul className="space-y-1 text-muted-foreground text-sm">
					{itemResult.usageRequirements.map((requirement) => (
						<li key={requirement.id}>
							Kullanım testi {requirement.name} · {requirement.id} ·{" "}
							{requirementResultLabels[requirement.result]}
							{requirement.required ? " · Gerekli" : " · İsteğe bağlı"}
						</li>
					))}
				</ul>
			) : null}
		</section>
	);
}

function HumanReviewSummary({
	requirements,
}: {
	requirements: FamilyReadiness["items"][number]["humanReviewRequirements"];
}) {
	if (requirements.length === 0) {
		return null;
	}
	return (
		<section aria-label="Zorunlu insan incelemeleri" className="mt-3 space-y-2">
			<h5 className="font-medium text-sm">Zorunlu insan incelemeleri</h5>
			<ul className="space-y-1 text-muted-foreground text-sm">
				{requirements.map((requirement) => (
					<li key={requirement.id}>
						{requirement.name} · {requirement.id} ·{" "}
						{requirementResultLabels[requirement.result]} ·{" "}
						{requirement.isCurrent ? "Güncel kanıt" : "Güncel kanıt yok"}
					</li>
				))}
			</ul>
		</section>
	);
}

function ReadinessEvidenceDetails({
	evidence,
}: {
	evidence: FamilyReadiness["items"][number]["latestEvidence"][number];
}) {
	return (
		<details className="mt-2 text-xs">
			<summary className="cursor-pointer text-muted-foreground">
				{evidence.ruleId ??
					evidence.testId ??
					evidenceKindLabels[evidence.kind]}{" "}
				· {evidenceResultLabels[evidence.result]} ·{" "}
				{evidence.isCurrent ? "Güncel kanıt" : "Eski kanıt"}
			</summary>
			<dl className="mt-2 grid gap-x-2 gap-y-1 sm:grid-cols-[max-content_1fr]">
				<dt>Kanıt kimliği</dt>
				<dd>{evidence.id}</dd>
				<dt>Tür</dt>
				<dd>
					{evidence.ruleClass === "human_review"
						? ruleClassLabels.human_review
						: evidenceKindLabels[evidence.kind]}
				</dd>
				{evidence.ruleId ? (
					<>
						<dt>Kural sınıfı</dt>
						<dd>
							{evidence.ruleClass
								? ruleClassLabels[evidence.ruleClass]
								: "Genel Varlık Desteği"}
						</dd>
					</>
				) : null}
				<dt>Varlık Sürümleri</dt>
				<dd>{evidence.assetVersionIds.join(", ")}</dd>
				{evidence.versionTarget ? (
					<>
						<dt>
							{evidence.versionTarget.kind === "unit"
								? "Birim Sürümü"
								: "Birleşik Sürüm"}
						</dt>
						<dd>{evidence.versionTarget.id}</dd>
					</>
				) : null}
				{evidence.profileContractRevisionIds.length > 0 ? (
					<>
						<dt>Özel Profil Sözleşmesi</dt>
						<dd>
							{evidence.profileContractRevisionIds
								.map((id) => id ?? "Genel Varlık Desteği")
								.join(", ")}
						</dd>
					</>
				) : null}
				<dt>Bağlam Sürümü</dt>
				<dd>{evidence.contextRevisionId ?? "Yok"}</dd>
				{evidence.usageVariant === null ? null : (
					<>
						<dt>Kullanım çeşidi</dt>
						<dd>{evidence.usageVariant}</dd>
					</>
				)}
				{evidence.targetDimensions ? (
					<>
						<dt>Hedef ölçü</dt>
						<dd>{formatPixelDimensions(evidence.targetDimensions)}</dd>
					</>
				) : null}
				{evidence.grayscaleReviewed === null ? null : (
					<>
						<dt>Gri tonlama incelemesi</dt>
						<dd>{evidence.grayscaleReviewed ? "İncelendi" : "İncelenmedi"}</dd>
					</>
				)}
				<dt>Görsel Dünya</dt>
				<dd>{evidence.visualWorldId}</dd>
				<dt>Kullanım bağlamı</dt>
				<dd>{evidence.useContext}</dd>
				<dt>Ana Tasarım Sürümü</dt>
				<dd>{evidence.canonicalDesignVersionId ?? "Seçilmedi"}</dd>
				{evidence.observedValue ? (
					<>
						<dt>Gözlenen değer</dt>
						<dd>{evidence.observedValue}</dd>
					</>
				) : null}
				{evidence.method ? (
					<>
						<dt>Yöntem</dt>
						<dd>{evidence.method}</dd>
					</>
				) : null}
				<dt>Gerekçe veya gözlem</dt>
				<dd>{evidence.rationale}</dd>
				<dt>Kaydeden kullanıcı</dt>
				<dd>{evidence.createdByUserId}</dd>
				<dt>Kayıt zamanı</dt>
				<dd>{evidence.createdAt}</dd>
			</dl>
		</details>
	);
}

function RequiredSetItemEditor({
	assetFamilyId,
	assetRecords,
	item,
	onChange,
	onRemove,
	profileContracts,
}: {
	assetFamilyId: string;
	assetRecords: {
		assetCategory: string | null;
		id: string;
		name: string;
	}[];
	item: DraftItem;
	onChange: (change: Partial<DraftItem>) => void;
	onRemove: () => void;
	profileContracts: SpecializedProfileContractsListOutput | null;
}) {
	const idPrefix = `required-set-${assetFamilyId}-${item.id}`;
	const usageTestOptions = getUsageTestOptions(
		item,
		assetRecords,
		profileContracts
	);
	const selectedSpecializedRecord = assetRecords.some(
		(record) =>
			item.assetRecordIds.includes(record.id) &&
			profileContracts?.profiles.some(
				(profile) => profile.definition.profileId === record.assetCategory
			)
	);
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
				<div className="space-y-3">
					<label
						className="block space-y-1 text-sm"
						htmlFor={`${idPrefix}-test-id`}
					>
						<span>Kullanım testi kimliği</span>
						<input
							className="w-full rounded-md border bg-background px-3 py-2"
							id={`${idPrefix}-test-id`}
							list={`${idPrefix}-test-options`}
							maxLength={120}
							onChange={(event) =>
								onChange({ testId: event.currentTarget.value })
							}
							pattern="[a-z][a-z0-9._-]*"
							required={item.disposition === "required"}
							value={item.testId ?? ""}
						/>
						<datalist id={`${idPrefix}-test-options`}>
							{usageTestOptions.map((test) => (
								<option key={test.id} value={test.id}>
									{test.label}
								</option>
							))}
						</datalist>
						<p className="text-muted-foreground text-xs">
							{usageTestGuidance(
								usageTestOptions.length,
								selectedSpecializedRecord
							)}
						</p>
					</label>
					<fieldset className="space-y-2">
						<legend className="text-sm">
							Teste katılacak Varlık Kayıtları
						</legend>
						<p className="text-muted-foreground text-xs">
							Özel profil testini aynı Özel Varlık Profilindeki kayıtlarla
							tanımlayın.
						</p>
						{assetRecords.map((record) => (
							<label
								className="flex items-center gap-2 text-sm"
								key={record.id}
							>
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
				</div>
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
	assetRecords,
	assetVersions,
	currentAssetVersionIds,
	item,
	isSaving,
	onRecord,
	profileContracts,
	qualityRequirements,
	humanReviewRequirements,
	latestEvidence,
	versionTargets,
	projectId,
	revisionId,
}: {
	assetFamilyId: string;
	assetRecords: FamilyReadinessAssetRecord[];
	assetVersions: AssetVersion[];
	currentAssetVersionIds: string[];
	item: RequiredSetItem;
	isSaving: boolean;
	onRecord: (input: ReadinessEvidenceInput) => Promise<boolean>;
	profileContracts: SpecializedProfileContractsListOutput | null;
	qualityRequirements: FamilyReadiness["items"][number]["qualityRequirements"];
	humanReviewRequirements: FamilyReadiness["items"][number]["humanReviewRequirements"];
	latestEvidence: ReadinessEvidence[];
	versionTargets: QualityVersionTarget[];
	projectId: string;
	revisionId: string;
}) {
	const assetProfileOptions = item.assetRecordIds.flatMap((recordId) => {
		const category = assetRecords.find(
			(record) => record.id === recordId
		)?.assetCategory;
		return profileContracts?.profiles.some(
			(profile) => profile.definition.profileId === category
		)
			? [category]
			: [];
	});
	const hasSpecializedProfile = assetProfileOptions.length > 0;
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
			{item.kind === "usage_test" ? (
				<EvidenceForm
					assetFamilyId={assetFamilyId}
					description="Kullanım testi sonucu"
					iconUsagePreview={{
						assetRecordIds: item.assetRecordIds,
						assetRecords,
						assetVersions,
						currentAssetVersionIds,
					}}
					initialResult="passed"
					isSaving={isSaving}
					item={item}
					kind="usage_test"
					onRecord={onRecord}
					projectId={projectId}
					revisionId={revisionId}
					testId={item.testId}
				/>
			) : null}
			{hasSpecializedProfile && qualityRequirements.length === 0 ? (
				<p className="rounded-md border border-dashed p-3 text-sm">
					Kalite kanıtı kaydetmek için bu Varlık Kaydının kategorisine ait Özel
					Profil Sözleşmesini etkinleştirin.
				</p>
			) : null}
			{qualityRequirements.map((requirement) => (
				<EvidenceForm
					assetFamilyId={assetFamilyId}
					description={`${requirement.name} · ${ruleClassLabels[requirement.class]}`}
					initialResult="passed"
					isSaving={isSaving}
					item={item}
					key={requirement.id}
					kind="quality"
					onRecord={onRecord}
					projectId={projectId}
					qualityRequirement={requirement}
					revisionId={revisionId}
					versionTargets={versionTargets}
					waiverEvidence={
						requirement.class === "waivable_requirement" &&
						requirement.waiverEligible
							? latestEvidence.find(
									(evidence) =>
										evidence.kind === "quality" &&
										evidence.ruleId === requirement.id &&
										evidence.ruleClass === "waivable_requirement" &&
										evidence.isCurrent &&
										Boolean(evidence.versionTarget) &&
										(evidence.result === "failed" ||
											evidence.result === "inconclusive") &&
										Boolean(evidence.observedValue && evidence.method)
								)
							: undefined
					}
				/>
			))}
			{humanReviewRequirements.map((requirement) => (
				<EvidenceForm
					assetFamilyId={assetFamilyId}
					description={`${requirement.name} · Zorunlu insan incelemesi`}
					humanReviewRequirement={requirement}
					initialResult="inconclusive"
					isSaving={isSaving}
					item={item}
					key={requirement.id}
					kind="quality"
					onRecord={onRecord}
					projectId={projectId}
					revisionId={revisionId}
				/>
			))}
		</div>
	);
}

interface QualityEvidenceFormInput {
	humanReviewRequirement?: FamilyReadiness["items"][number]["humanReviewRequirements"][number];
	method: string;
	observedValue: string;
	qualityRequirement?: FamilyReadiness["items"][number]["qualityRequirements"][number];
	result: "passed" | "failed" | "inconclusive" | "waived";
	shared: Pick<
		ReadinessEvidenceInput,
		"projectId" | "assetFamilyId" | "revisionId" | "itemId" | "rationale"
	>;
	versionTarget?: QualityVersionTarget;
	waiverEvidence?: ReadinessEvidence;
}

function qualityEvidenceFormInput(
	input: QualityEvidenceFormInput
): ReadinessEvidenceInput | null {
	const {
		shared,
		humanReviewRequirement,
		qualityRequirement,
		result,
		method,
		observedValue,
		versionTarget,
		waiverEvidence,
	} = input;
	if (humanReviewRequirement) {
		return {
			...shared,
			kind: "quality",
			result,
			ruleId: humanReviewRequirement.id,
			method,
		};
	}
	if (!qualityRequirement) {
		return null;
	}
	if (result === "waived") {
		if (!waiverEvidence) {
			return null;
		}
		return {
			...shared,
			kind: "quality",
			result,
			ruleId: qualityRequirement.id,
			method: waiverEvidence.method ?? "",
			observedValue: waiverEvidence.observedValue ?? "",
			waiverEvidenceId: waiverEvidence.id,
			versionTarget: waiverEvidence.versionTarget ?? undefined,
		};
	}
	return {
		...shared,
		kind: "quality",
		result,
		ruleId: qualityRequirement.id,
		method,
		...(qualityRequirement.waiverEligible ? { observedValue } : {}),
		...(versionTarget ? { versionTarget } : {}),
	};
}

interface IconUsageEvidenceFormInput {
	grayscaleReviewed: boolean;
	method: string;
	result: "passed" | "failed" | "inconclusive";
	shared: QualityEvidenceFormInput["shared"];
	targetDimensions: PixelDimensions | null;
	testId?: string;
	usageVariant: string;
}

function iconUsageEvidenceFormInput(
	input: IconUsageEvidenceFormInput
): ReadinessEvidenceInput | null {
	const {
		grayscaleReviewed,
		method,
		result,
		shared,
		targetDimensions,
		testId,
	} = input;
	if (!testId) {
		return null;
	}
	if (testId !== iconTargetSizeTestId) {
		return { ...shared, kind: "usage_test", result, testId, method };
	}
	const usageVariant = input.usageVariant.trim();
	if (!usageVariant || targetDimensions === null || !grayscaleReviewed) {
		return null;
	}
	return {
		...shared,
		kind: "usage_test",
		result,
		testId,
		method,
		usageVariant,
		targetDimensions,
		grayscaleReviewed: true,
	};
}

function iconUsageGrayscaleReviewKey(
	preview: IconUsagePreviewContext | undefined,
	targetDimensions: PixelDimensions | null,
	usageVariant: string
) {
	const assetRecordIds = new Set(preview?.assetRecordIds ?? []);
	const currentAssetVersionIds = [
		...(preview?.currentAssetVersionIds ?? []),
	].sort();
	const currentAssetVersionIdSet = new Set(currentAssetVersionIds);
	const assetRecords = (preview?.assetRecords ?? [])
		.filter((record) => assetRecordIds.has(record.id))
		.map((record) => ({
			id: record.id,
			assetCategory: record.assetCategory,
			logicalResolution: record.logicalResolution
				? {
						width: record.logicalResolution.width,
						height: record.logicalResolution.height,
					}
				: null,
		}))
		.sort((left, right) => left.id.localeCompare(right.id));
	const sourceImageDimensions = (preview?.assetVersions ?? [])
		.filter(
			(version) =>
				assetRecordIds.has(version.assetRecordId) &&
				currentAssetVersionIdSet.has(version.id)
		)
		.map((version) => ({
			assetRecordId: version.assetRecordId,
			assetVersionId: version.id,
			dimensions: version.sourceImageDimensions
				? {
						width: version.sourceImageDimensions.width,
						height: version.sourceImageDimensions.height,
					}
				: null,
		}))
		.sort((left, right) =>
			left.assetRecordId.localeCompare(right.assetRecordId)
		);
	return JSON.stringify({
		assetRecords,
		currentAssetVersionIds,
		sourceImageDimensions,
		targetDimensions,
		usageVariant: usageVariant.trim(),
	});
}

function qualityMeasurementValues(
	isWaiver: boolean,
	waiverEvidence: ReadinessEvidence | undefined,
	method: string,
	observedValue: string,
	versionTarget: QualityVersionTarget | undefined
) {
	if (isWaiver) {
		return {
			method: waiverEvidence?.method ?? "",
			observedValue: waiverEvidence?.observedValue ?? "",
			versionTarget: JSON.stringify(waiverEvidence?.versionTarget) ?? "",
		};
	}
	return {
		method,
		observedValue,
		versionTarget: JSON.stringify(versionTarget) ?? "",
	};
}

function QualityVersionTargetSelect({
	formId,
	isWaiver,
	versionTargets,
	value,
	onSelect,
	required,
}: {
	formId: string;
	isWaiver: boolean;
	versionTargets: QualityVersionTarget[];
	value: string;
	onSelect: (target: QualityVersionTarget | undefined) => void;
	required: boolean;
}) {
	return (
		<label
			className="block space-y-1 text-sm"
			htmlFor={`${formId}-version-target`}
		>
			<span>Birim Sürümü veya Birleşik Sürüm</span>
			<select
				className="w-full rounded-md border bg-background px-3 py-2"
				disabled={isWaiver}
				id={`${formId}-version-target`}
				onChange={(event) =>
					onSelect(
						versionTargets.find(
							(target) => JSON.stringify(target) === event.currentTarget.value
						)
					)
				}
				required={required}
				value={value}
			>
				<option value="">Kesin sürüm seçin</option>
				{versionTargets.map((target) => (
					<option
						key={`${target.kind}:${target.id}`}
						value={JSON.stringify(target)}
					>
						{target.kind === "unit" ? "Birim Sürümü" : "Birleşik Sürüm"} ·{" "}
						{target.id}
					</option>
				))}
			</select>
		</label>
	);
}

function evidenceRequirementId(
	qualityRequirement: QualityEvidenceFormInput["qualityRequirement"],
	humanReviewRequirement: QualityEvidenceFormInput["humanReviewRequirement"],
	testId: string | undefined
) {
	return qualityRequirement?.id ?? humanReviewRequirement?.id ?? testId ?? "";
}

function QualityWaiverScope({ evidence }: { evidence: ReadinessEvidence }) {
	return (
		<fieldset
			aria-label="Kalite İstisnası kapsamı"
			className="space-y-2 rounded-md border p-3 text-sm"
		>
			<legend>Kalite İstisnası kapsamı</legend>
			<p>
				Bu karar yalnız gösterilen ölçüm ve kesin sürümler içindir. Yeni sürüme
				aktarılmaz; bütünlük, zorunlu insan incelemesi ve kullanım testi
				engellerini kaldırmaz.
			</p>
			<dl className="space-y-1 break-all">
				<dt>Ölçüm kanıtı</dt>
				<dd>{evidence.id}</dd>
				<dt>
					{evidence.versionTarget?.kind === "unit"
						? "Birim Sürümü"
						: "Birleşik Sürüm"}
				</dt>
				<dd>{evidence.versionTarget?.id}</dd>
				<dt>Varlık Sürümleri</dt>
				<dd>{evidence.assetVersionIds.join(", ")}</dd>
				<dt>Özel Profil Sözleşmesi</dt>
				<dd>{evidence.profileContractRevisionIds.join(", ")}</dd>
				<dt>Bağlam Sürümü</dt>
				<dd>{evidence.contextRevisionId}</dd>
				<dt>Görsel Dünya</dt>
				<dd>{evidence.visualWorldId}</dd>
				<dt>Kullanım bağlamı</dt>
				<dd>{evidence.useContext}</dd>
				<dt>Ana Tasarım Sürümü</dt>
				<dd>{evidence.canonicalDesignVersionId ?? "Seçilmedi"}</dd>
			</dl>
		</fieldset>
	);
}

type EvidenceFormResult =
	| "applicable"
	| "inapplicable"
	| "passed"
	| "failed"
	| "inconclusive"
	| "waived";

function EvidenceResultField({
	canWaive,
	formId,
	kind,
	onChange,
	result,
}: {
	canWaive: boolean;
	formId: string;
	kind: "applicability" | "quality" | "usage_test";
	onChange: (result: EvidenceFormResult) => void;
	result: EvidenceFormResult;
}) {
	return (
		<label className="block space-y-1 text-sm" htmlFor={`${formId}-result`}>
			<span>Sonuç</span>
			<select
				className="w-full rounded-md border bg-background px-3 py-2"
				id={`${formId}-result`}
				onChange={(event) =>
					onChange(event.currentTarget.value as EvidenceFormResult)
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
						{kind === "quality" && canWaive ? (
							<option value="waived">Kalite İstisnası ver</option>
						) : null}
					</>
				)}
			</select>
		</label>
	);
}

function QualityEvidenceFields({
	formId,
	humanReviewRequirement,
	isWaiver,
	measurementValues,
	onObservedValueChange,
	onVersionTargetChange,
	qualityRequirement,
	requiresVersionTarget,
	versionTargets,
}: {
	formId: string;
	humanReviewRequirement?: FamilyReadiness["items"][number]["humanReviewRequirements"][number];
	isWaiver: boolean;
	measurementValues: ReturnType<typeof qualityMeasurementValues>;
	onObservedValueChange: (value: string) => void;
	onVersionTargetChange: (target: QualityVersionTarget | undefined) => void;
	qualityRequirement?: FamilyReadiness["items"][number]["qualityRequirements"][number];
	requiresVersionTarget: boolean;
	versionTargets: QualityVersionTarget[];
}) {
	return (
		<>
			{qualityRequirement && versionTargets.length > 0 ? (
				<QualityVersionTargetSelect
					formId={formId}
					isWaiver={isWaiver}
					onSelect={onVersionTargetChange}
					required={requiresVersionTarget}
					value={measurementValues.versionTarget}
					versionTargets={versionTargets}
				/>
			) : null}
			{qualityRequirement ? (
				<label className="block space-y-1 text-sm" htmlFor={`${formId}-rule`}>
					<span>Kural kimliği</span>
					<input
						className="w-full rounded-md border bg-background px-3 py-2"
						id={`${formId}-rule`}
						readOnly
						value={qualityRequirement.id}
					/>
				</label>
			) : null}
			{humanReviewRequirement ? (
				<label className="block space-y-1 text-sm" htmlFor={`${formId}-review`}>
					<span>İnsan incelemesi kimliği</span>
					<input
						className="w-full rounded-md border bg-background px-3 py-2"
						id={`${formId}-review`}
						readOnly
						value={humanReviewRequirement.id}
					/>
				</label>
			) : null}
			{qualityRequirement?.waiverEligible ? (
				<label
					className="block space-y-1 text-sm"
					htmlFor={`${formId}-observed-value`}
				>
					<span>Gözlenen değer</span>
					<input
						className="w-full rounded-md border bg-background px-3 py-2"
						id={`${formId}-observed-value`}
						maxLength={500}
						onChange={(event) =>
							onObservedValueChange(event.currentTarget.value)
						}
						readOnly={isWaiver}
						required
						value={measurementValues.observedValue}
					/>
				</label>
			) : null}
		</>
	);
}

function UsageTestEvidenceFields({
	data,
	formId,
	grayscaleReviewed,
	isIconTargetSizeTest,
	kind,
	onGrayscaleReviewedChange,
	onTargetHeightChange,
	onTargetWidthChange,
	onUsageVariantChange,
	targetDimensions,
	targetHeight,
	targetWidth,
	usageVariantError,
	testId,
	usageVariant,
}: {
	data?: IconUsagePreviewContext;
	formId: string;
	grayscaleReviewed: boolean;
	isIconTargetSizeTest: boolean;
	kind: "applicability" | "quality" | "usage_test";
	onGrayscaleReviewedChange: (reviewed: boolean) => void;
	onTargetHeightChange: (height: string) => void;
	onTargetWidthChange: (width: string) => void;
	onUsageVariantChange: (variant: string) => void;
	targetDimensions: PixelDimensions | null;
	targetHeight: string;
	targetWidth: string;
	usageVariantError: string;
	testId?: string;
	usageVariant: string;
}) {
	if (kind !== "usage_test") {
		return null;
	}
	return (
		<>
			<label className="block space-y-1 text-sm" htmlFor={`${formId}-test`}>
				<span>Kullanım testi kimliği</span>
				<input
					className="w-full rounded-md border bg-background px-3 py-2"
					id={`${formId}-test`}
					readOnly
					value={testId ?? ""}
				/>
			</label>
			{isIconTargetSizeTest ? (
				<IconUsageEvidenceFields
					data={data}
					formId={formId}
					grayscaleReviewed={grayscaleReviewed}
					onGrayscaleReviewedChange={onGrayscaleReviewedChange}
					onTargetHeightChange={onTargetHeightChange}
					onTargetWidthChange={onTargetWidthChange}
					onUsageVariantChange={onUsageVariantChange}
					targetDimensions={targetDimensions}
					targetHeight={targetHeight}
					targetWidth={targetWidth}
					usageVariant={usageVariant}
					usageVariantError={usageVariantError}
				/>
			) : null}
		</>
	);
}

function EvidenceMethodField({
	formId,
	kind,
	isWaiver,
	measurementValue,
	onChange,
}: {
	formId: string;
	kind: "applicability" | "quality" | "usage_test";
	isWaiver: boolean;
	measurementValue: string;
	onChange: (value: string) => void;
}) {
	if (kind === "applicability") {
		return null;
	}
	return (
		<label className="block space-y-1 text-sm" htmlFor={`${formId}-method`}>
			<span>Yöntem</span>
			<textarea
				className="min-h-16 w-full rounded-md border bg-background px-3 py-2"
				id={`${formId}-method`}
				maxLength={1000}
				onChange={(event) => onChange(event.currentTarget.value)}
				readOnly={isWaiver}
				required
				value={measurementValue}
			/>
		</label>
	);
}

function EvidenceForm({
	assetFamilyId,
	description,
	iconUsagePreview,
	initialResult,
	isSaving,
	item,
	kind,
	onRecord,
	projectId,
	qualityRequirement,
	humanReviewRequirement,
	revisionId,
	testId,
	waiverEvidence,
	versionTargets = [],
}: {
	assetFamilyId: string;
	description: string;
	iconUsagePreview?: IconUsagePreviewContext;
	initialResult: "applicable" | "passed" | "inconclusive";
	isSaving: boolean;
	item: RequiredSetItem;
	kind: "applicability" | "quality" | "usage_test";
	onRecord: (input: ReadinessEvidenceInput) => Promise<boolean>;
	projectId: string;
	qualityRequirement?: FamilyReadiness["items"][number]["qualityRequirements"][number];
	humanReviewRequirement?: FamilyReadiness["items"][number]["humanReviewRequirements"][number];
	revisionId: string;
	testId?: string;
	waiverEvidence?: ReadinessEvidence;
	versionTargets?: QualityVersionTarget[];
}) {
	const [result, setResult] = useState<EvidenceFormResult>(initialResult);
	const [method, setMethod] = useState("");
	const [rationale, setRationale] = useState("");
	const [observedValue, setObservedValue] = useState("");
	const [versionTarget, setVersionTarget] = useState<QualityVersionTarget>();
	const [usageVariant, setUsageVariant] = useState("");
	const [usageVariantError, setUsageVariantError] = useState("");
	const [targetWidth, setTargetWidth] = useState("");
	const [targetHeight, setTargetHeight] = useState("");
	const [grayscaleReviewedScopeKey, setGrayscaleReviewedScopeKey] = useState<
		string | null
	>(null);
	const formId = `${assetFamilyId}-${kind}-${item.id}-${evidenceRequirementId(qualityRequirement, humanReviewRequirement, testId)}`;
	const isWaiver = result === "waived";
	const isIconTargetSizeTest =
		kind === "usage_test" && testId === iconTargetSizeTestId;
	const targetDimensions = isIconTargetSizeTest
		? (() => {
				const width = parsePositivePixelDimension(targetWidth);
				const height = parsePositivePixelDimension(targetHeight);
				return width !== null && height !== null ? { width, height } : null;
			})()
		: null;
	const currentGrayscaleReviewScopeKey = iconUsageGrayscaleReviewKey(
		iconUsagePreview,
		targetDimensions,
		usageVariant
	);
	const grayscaleReviewed =
		grayscaleReviewedScopeKey === currentGrayscaleReviewScopeKey;
	useEffect(() => {
		setGrayscaleReviewedScopeKey((scopeKey) =>
			scopeKey === currentGrayscaleReviewScopeKey ? scopeKey : null
		);
	}, [currentGrayscaleReviewScopeKey]);
	const requiresVersionTarget =
		kind === "quality" &&
		!isWaiver &&
		qualityRequirement?.class === "waivable_requirement" &&
		versionTargets.length > 0;
	const measurementValues = qualityMeasurementValues(
		isWaiver,
		waiverEvidence,
		method,
		observedValue,
		versionTarget
	);

	function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (isIconTargetSizeTest && !usageVariant.trim()) {
			setUsageVariantError("Kullanım çeşidi boşluklardan oluşamaz.");
			return;
		}
		setUsageVariantError("");
		const shared = {
			projectId,
			assetFamilyId,
			revisionId,
			itemId: item.id,
			rationale,
		};
		if (kind === "applicability") {
			void onRecord({
				...shared,
				kind,
				result: result as "applicable" | "inapplicable",
			});
		} else if (kind === "quality") {
			if (requiresVersionTarget && !versionTarget) {
				return;
			}
			const qualityInput = qualityEvidenceFormInput({
				shared,
				qualityRequirement,
				humanReviewRequirement,
				result: result as "passed" | "failed" | "inconclusive" | "waived",
				method,
				observedValue,
				versionTarget,
				waiverEvidence,
			});
			if (qualityInput) {
				void onRecord(qualityInput);
			}
		} else {
			const usageInput = iconUsageEvidenceFormInput({
				shared,
				result: result as "passed" | "failed" | "inconclusive",
				testId,
				method,
				usageVariant,
				targetDimensions,
				grayscaleReviewed,
			});
			if (usageInput) {
				void onRecord(usageInput);
			}
		}
	}

	return (
		<form className="space-y-2 rounded-md bg-muted/30 p-3" onSubmit={submit}>
			<h6 className="font-medium text-sm">{description}</h6>
			<EvidenceResultField
				canWaive={Boolean(waiverEvidence)}
				formId={formId}
				kind={kind}
				onChange={(nextResult) => {
					setResult(nextResult);
					if (nextResult === "waived") {
						setRationale("");
					}
				}}
				result={result}
			/>
			{isWaiver && waiverEvidence ? (
				<QualityWaiverScope evidence={waiverEvidence} />
			) : null}
			<QualityEvidenceFields
				formId={formId}
				humanReviewRequirement={humanReviewRequirement}
				isWaiver={isWaiver}
				measurementValues={measurementValues}
				onObservedValueChange={setObservedValue}
				onVersionTargetChange={setVersionTarget}
				qualityRequirement={qualityRequirement}
				requiresVersionTarget={requiresVersionTarget}
				versionTargets={versionTargets}
			/>
			<UsageTestEvidenceFields
				data={iconUsagePreview}
				formId={formId}
				grayscaleReviewed={grayscaleReviewed}
				isIconTargetSizeTest={isIconTargetSizeTest}
				kind={kind}
				onGrayscaleReviewedChange={(reviewed) =>
					setGrayscaleReviewedScopeKey(
						reviewed ? currentGrayscaleReviewScopeKey : null
					)
				}
				onTargetHeightChange={(height) => {
					setTargetHeight(height);
					setGrayscaleReviewedScopeKey(null);
				}}
				onTargetWidthChange={(width) => {
					setTargetWidth(width);
					setGrayscaleReviewedScopeKey(null);
				}}
				onUsageVariantChange={(variant) => {
					if (variant.trim() !== usageVariant.trim()) {
						setGrayscaleReviewedScopeKey(null);
					}
					setUsageVariant(variant);
					if (variant.trim()) {
						setUsageVariantError("");
					}
				}}
				targetDimensions={targetDimensions}
				targetHeight={targetHeight}
				targetWidth={targetWidth}
				testId={testId}
				usageVariant={usageVariant}
				usageVariantError={usageVariantError}
			/>
			<EvidenceMethodField
				formId={formId}
				isWaiver={isWaiver}
				kind={kind}
				measurementValue={measurementValues.method}
				onChange={setMethod}
			/>
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
			<Button
				disabled={isSaving || (isWaiver && !waiverEvidence)}
				type="submit"
				variant="outline"
			>
				{isWaiver ? "Kalite İstisnası ver" : "Kanıtı kaydet"}
			</Button>
		</form>
	);
}
