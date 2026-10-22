import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type {
	FamilyReadiness,
	QualityVersionTarget,
	ReadinessEvidence,
	ReadinessEvidenceInput,
	RequiredSetItem,
} from "@sprite-anvil/api/family-readiness";
import { objectSceneUsageTestId } from "@sprite-anvil/api/family-readiness";
import type { SpecializedProfileContractsListOutput } from "@sprite-anvil/api/specialized-profile-contracts";
import { iconLightDarkTargetSizeTestId } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type {
	IconPixelDimensions,
	IconUsagePreviewContext,
} from "@/features/icon-profile/ui/components/icon-usage-evidence-fields";
import {
	formatIconPixelDimensions as formatPixelDimensions,
	IconUsageEvidenceFields,
} from "@/features/icon-profile/ui/components/icon-usage-evidence-fields";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import {
	cellDimensionSchema,
	pixelDimensionSchema,
	usageVariantSchema,
} from "../../schemas";

interface DraftItem {
	assetRecordIds: string[];
	disposition: RequiredSetItem["disposition"];
	id: string;
	kind: RequiredSetItem["kind"];
	localId: string;
	name: string;
	testId?: string;
}

interface UsageTestAssetRecord {
	assetCategory: string | null;
	id: string;
	name: string;
}

interface UsageTestAssetVersion {
	assetRecordId: string;
	id: string;
	reviewDisposition: "candidate" | "approved" | "rejected";
	versionNumber: number;
}

type PixelDimensions = IconPixelDimensions;

interface FamilyReadinessAssetRecord {
	assetCategory: string | null;
	id: string;
	logicalResolution?: PixelDimensions | null;
	name: string;
}

function parsePositivePixelDimension(value: string) {
	const parsed = pixelDimensionSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

const fieldLabelClass = "block space-y-1 text-sm leading-normal";

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
	usageTestAssetRecords = [],
	usageTestAssetVersions = [],
}: {
	assetFamilyId: string;
	familyName: string;
	projectId: string;
	assetRecords: FamilyReadinessAssetRecord[];
	assetVersions?: AssetVersion[];
	profileContracts: SpecializedProfileContractsListOutput | null;
	usageTestAssetRecords?: UsageTestAssetRecord[];
	usageTestAssetVersions?: UsageTestAssetVersion[];
}) {
	const query = useQuery({
		...orpc.familyReadiness.list.queryOptions({
			input: { projectId, assetFamilyId },
		}),
	});
	const [isSaving, setIsSaving] = useState(false);
	const saveDraftMutation = useMutation(
		orpc.familyReadiness.saveDraft.mutationOptions(mutationMeta)
	);
	const activateMutation = useMutation(
		orpc.familyReadiness.activate.mutationOptions(mutationMeta)
	);
	const recordEvidenceMutation = useMutation(
		orpc.familyReadiness.recordEvidence.mutationOptions(mutationMeta)
	);
	const [message, setMessage] = useState("");
	const lastLoadedRevisionId = useRef<string | null>(null);
	const draftForm = useForm({
		defaultValues: { items: [] as DraftItem[] },
		onSubmit: ({ value }) => saveDraft(value.items),
	});
	const latestRevision = query.data?.revisions.at(-1);
	const activeRevisionId = query.data?.activeRevision?.id;

	useEffect(() => {
		const sourceRevision = latestRevision ?? query.data?.activeRevision;
		const sourceId = sourceRevision?.id ?? "empty";
		if (lastLoadedRevisionId.current === sourceId) {
			return;
		}
		lastLoadedRevisionId.current = sourceId;
		draftForm.setFieldValue(
			"items",
			sourceRevision?.items.map(toDraftItem) ?? []
		);
	}, [draftForm, latestRevision, query.data?.activeRevision]);

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

	function saveDraft(draftItems: DraftItem[]) {
		const items: RequiredSetItem[] = draftItems.map(
			({ localId: _localId, ...item }) => item
		);
		void runWrite(
			() =>
				saveDraftMutation.mutateAsync({
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
				activateMutation.mutateAsync({
					projectId,
					assetFamilyId,
					revisionId,
				}),
			"Gerekli Öğeler Listesi sürümü etkinleştirildi."
		);
	}

	function recordEvidence(input: ReadinessEvidenceInput) {
		return runWrite(
			() => recordEvidenceMutation.mutateAsync(input),
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
									usageTestAssetRecords={usageTestAssetRecords}
									usageTestAssetVersions={usageTestAssetVersions}
								/>
							))}
						</ul>
					)}
				</section>
			) : null}

			<form
				className="space-y-4 border-t pt-4"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					draftForm.handleSubmit();
				}}
			>
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
				<draftForm.Field mode="array" name="items">
					{(itemsField) => (
						<>
							{itemsField.state.value.map((item, index) => (
								<draftForm.Field key={item.localId} name={`items[${index}]`}>
									{(itemField) => (
										<RequiredSetItemEditor
											assetFamilyId={assetFamilyId}
											assetRecords={assetRecords}
											field={itemField}
											onRemove={() => itemsField.removeValue(index)}
											profileContracts={profileContracts}
										/>
									)}
								</draftForm.Field>
							))}
							<div className="flex flex-wrap gap-2">
								<Button
									disabled={isSaving}
									onClick={() =>
										itemsField.pushValue({
											localId: crypto.randomUUID(),
											id: `item-${crypto.randomUUID()}`,
											kind: "direction",
											name: "",
											disposition: "required",
											assetRecordIds: [],
										})
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
						</>
					)}
				</draftForm.Field>
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
	usageTestAssetRecords,
	usageTestAssetVersions,
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
	usageTestAssetRecords: UsageTestAssetRecord[];
	usageTestAssetVersions: UsageTestAssetVersion[];
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
				<ReadinessEvidenceDetails
					evidence={evidence}
					key={evidence.id}
					usageTestAssetRecords={usageTestAssetRecords}
					usageTestAssetVersions={usageTestAssetVersions}
				/>
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
					usageTestAssetRecords={usageTestAssetRecords}
					usageTestAssetVersions={usageTestAssetVersions}
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

function ReadinessUsageContextDetails({
	usageTestContext,
	usageTestAssetRecords,
	usageTestAssetVersions,
}: {
	usageTestContext: ReadinessEvidence["usageTestContext"];
	usageTestAssetRecords: UsageTestAssetRecord[];
	usageTestAssetVersions: UsageTestAssetVersion[];
}) {
	function versionLabel(versionId: string) {
		const version = usageTestAssetVersions.find(
			(entry) => entry.id === versionId
		);
		const record = usageTestAssetRecords.find(
			(entry) => entry.id === version?.assetRecordId
		);
		return version && record
			? `${record.name} · v${version.versionNumber}`
			: versionId;
	}
	if (!usageTestContext) {
		return null;
	}
	return (
		<>
			<dt>Hücre Ölçüsü</dt>
			<dd>
				{usageTestContext.cellDimensions.width} ×{" "}
				{usageTestContext.cellDimensions.height} px
			</dd>
			{usageTestContext.approvedCharacterVersionId ? (
				<>
					<dt>Onaylı karakter</dt>
					<dd>{versionLabel(usageTestContext.approvedCharacterVersionId)}</dd>
				</>
			) : null}
			{usageTestContext.targetGroundVersionIds ? (
				<>
					<dt>Zemin Sürümleri</dt>
					<dd>
						{usageTestContext.targetGroundVersionIds
							.map(versionLabel)
							.join(", ")}
					</dd>
				</>
			) : null}
		</>
	);
}

function ReadinessEvidenceDetails({
	evidence,
	usageTestAssetRecords,
	usageTestAssetVersions,
}: {
	evidence: FamilyReadiness["items"][number]["latestEvidence"][number];
	usageTestAssetRecords: UsageTestAssetRecord[];
	usageTestAssetVersions: UsageTestAssetVersion[];
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
				<ReadinessUsageContextDetails
					usageTestAssetRecords={usageTestAssetRecords}
					usageTestAssetVersions={usageTestAssetVersions}
					usageTestContext={evidence.usageTestContext}
				/>
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
	field,
	onRemove,
	profileContracts,
}: {
	assetFamilyId: string;
	assetRecords: {
		assetCategory: string | null;
		id: string;
		name: string;
	}[];
	field: {
		handleChange: (item: DraftItem) => void;
		state: { value: DraftItem };
	};
	onRemove: () => void;
	profileContracts: SpecializedProfileContractsListOutput | null;
}) {
	const item = field.state.value;
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
	function update(change: Partial<DraftItem>) {
		const updatedItem = { ...item, ...change };
		if (change.kind && change.kind !== "usage_test") {
			const { testId: _testId, ...itemWithoutTestId } = updatedItem;
			field.handleChange(itemWithoutTestId);
			return;
		}
		field.handleChange(updatedItem);
	}
	return (
		<FieldSet className="space-y-3 rounded-md border p-4">
			<FieldLegend className="px-1 font-medium">Gerekli öğe</FieldLegend>
			<div className="grid gap-3 sm:grid-cols-2">
				<Label className={fieldLabelClass}>
					<span>Öğe kimliği</span>
					<Input
						id={`${idPrefix}-id`}
						maxLength={100}
						onChange={(event) => update({ id: event.currentTarget.value })}
						pattern="[a-z][a-z0-9._-]*"
						required
						value={item.id}
					/>
				</Label>
				<Label className={fieldLabelClass}>
					<span>Öğe adı</span>
					<Input
						id={`${idPrefix}-name`}
						maxLength={120}
						onChange={(event) => update({ name: event.currentTarget.value })}
						required
						value={item.name}
					/>
				</Label>
				<Label className={fieldLabelClass}>
					<span>Öğe türü</span>
					<NativeSelect
						className="w-full"
						id={`${idPrefix}-kind`}
						onChange={(event) =>
							update({
								kind: event.currentTarget.value as DraftItem["kind"],
								assetRecordIds: [],
							})
						}
						value={item.kind}
					>
						{Object.entries(itemKindLabels).map(([kind, label]) => (
							<NativeSelectOption key={kind} value={kind}>
								{label}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Label>
				<Label className={fieldLabelClass}>
					<span>Durum</span>
					<NativeSelect
						className="w-full"
						id={`${idPrefix}-disposition`}
						onChange={(event) =>
							update({
								disposition: event.currentTarget
									.value as DraftItem["disposition"],
							})
						}
						value={item.disposition}
					>
						<NativeSelectOption value="required">Gerekli</NativeSelectOption>
						<NativeSelectOption value="optional">
							İsteğe bağlı
						</NativeSelectOption>
						<NativeSelectOption value="inapplicable">
							Uygulanamaz
						</NativeSelectOption>
					</NativeSelect>
				</Label>
			</div>
			{item.kind === "usage_test" ? (
				<div className="space-y-3">
					<Label className={fieldLabelClass} htmlFor={`${idPrefix}-test-id`}>
						<span>Kullanım testi kimliği</span>
						<Input
							id={`${idPrefix}-test-id`}
							list={`${idPrefix}-test-options`}
							maxLength={120}
							onChange={(event) =>
								update({ testId: event.currentTarget.value })
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
					</Label>
					<FieldSet className="space-y-2">
						<FieldLegend className="text-sm">
							Teste katılacak Varlık Kayıtları
						</FieldLegend>
						<p className="text-muted-foreground text-xs">
							Özel profil testini aynı Özel Varlık Profilindeki kayıtlarla
							tanımlayın.
						</p>
						{assetRecords.map((record) => (
							<Label
								className="flex items-center gap-2 text-sm"
								htmlFor={`${idPrefix}-record-${record.id}`}
								key={record.id}
							>
								<Checkbox
									checked={item.assetRecordIds.includes(record.id)}
									id={`${idPrefix}-record-${record.id}`}
									onCheckedChange={(checked) =>
										update({
											assetRecordIds: checked
												? [...item.assetRecordIds, record.id]
												: item.assetRecordIds.filter((id) => id !== record.id),
										})
									}
								/>
								{record.name}
							</Label>
						))}
					</FieldSet>
				</div>
			) : (
				<Label className={fieldLabelClass}>
					<span>Varlık Kaydı</span>
					<NativeSelect
						className="w-full"
						onChange={(event) =>
							update({
								assetRecordIds: event.currentTarget.value
									? [event.currentTarget.value]
									: [],
							})
						}
						required={item.disposition === "required"}
						value={item.assetRecordIds[0] ?? ""}
					>
						<NativeSelectOption value="">Varlık Kaydı seçin</NativeSelectOption>
						{assetRecords.map((record) => (
							<NativeSelectOption key={record.id} value={record.id}>
								{record.name}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Label>
			)}
			<Button onClick={onRemove} type="button" variant="outline">
				Öğeyi kaldır
			</Button>
		</FieldSet>
	);
}

function ReadinessEvidenceForms({
	assetFamilyId,
	assetRecords,
	usageTestAssetRecords,
	usageTestAssetVersions,
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
	usageTestAssetRecords: UsageTestAssetRecord[];
	usageTestAssetVersions: UsageTestAssetVersion[];
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
					usageTestAssetRecords={usageTestAssetRecords}
					usageTestAssetVersions={usageTestAssetVersions}
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
	usageTestContext: UsageTestEvidenceInput["usageTestContext"];
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
		usageTestContext,
	} = input;
	if (!testId) {
		return null;
	}
	if (testId !== iconLightDarkTargetSizeTestId) {
		return {
			...shared,
			kind: "usage_test",
			result,
			testId,
			method,
			usageTestContext,
		};
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
		usageTestContext,
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
		<Label className={fieldLabelClass} htmlFor={`${formId}-version-target`}>
			<span>Birim Sürümü veya Birleşik Sürüm</span>
			<NativeSelect
				className="w-full"
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
				<NativeSelectOption value="">Kesin sürüm seçin</NativeSelectOption>
				{versionTargets.map((target) => (
					<NativeSelectOption
						key={`${target.kind}:${target.id}`}
						value={JSON.stringify(target)}
					>
						{target.kind === "unit" ? "Birim Sürümü" : "Birleşik Sürüm"} ·{" "}
						{target.id}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Label>
	);
}

function UsageTestVersionSelect({
	id,
	label,
	onChange,
	recordsById,
	versions,
	value,
}: {
	id: string;
	label: string;
	onChange: (versionId: string) => void;
	recordsById: Map<string, UsageTestAssetRecord>;
	versions: UsageTestAssetVersion[];
	value: string;
}) {
	return (
		<Label className={fieldLabelClass} htmlFor={id}>
			<span>{label}</span>
			<NativeSelect
				className="w-full"
				id={id}
				onChange={(event) => onChange(event.currentTarget.value)}
				required
				value={value}
			>
				<NativeSelectOption value="">Sürüm seçin</NativeSelectOption>
				{versions.map((version) => {
					const record = recordsById.get(version.assetRecordId);
					return record ? (
						<NativeSelectOption key={version.id} value={version.id}>
							{record.name} · v{version.versionNumber}
						</NativeSelectOption>
					) : null;
				})}
			</NativeSelect>
			{versions.length === 0 ? (
				<span className="text-muted-foreground">
					Bu ölçütlere uyan sürüm bulunamadı.
				</span>
			) : null}
		</Label>
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
		<FieldSet
			aria-label="Kalite İstisnası kapsamı"
			className="space-y-2 rounded-md border p-3 text-sm"
		>
			<FieldLegend>Kalite İstisnası kapsamı</FieldLegend>
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
		</FieldSet>
	);
}

type UsageTestEvidenceInput = Extract<
	ReadinessEvidenceInput,
	{ kind: "usage_test" }
>;

function buildUsageTestEvidenceInput({
	approvedCharacterVersionId,
	approvedCharacterVersions,
	cellHeight,
	cellWidth,
	firstGroundVersionId,
	groundVersions,
	isObjectSceneTest,
	method,
	result,
	secondGroundVersionId,
	secondGroundVersions,
	shared,
	testId,
}: {
	approvedCharacterVersionId: string;
	approvedCharacterVersions: UsageTestAssetVersion[];
	cellHeight: string;
	cellWidth: string;
	firstGroundVersionId: string;
	groundVersions: UsageTestAssetVersion[];
	isObjectSceneTest: boolean;
	method: string;
	result: UsageTestEvidenceInput["result"];
	secondGroundVersionId: string;
	secondGroundVersions: UsageTestAssetVersion[];
	shared: Pick<
		UsageTestEvidenceInput,
		"projectId" | "assetFamilyId" | "revisionId" | "itemId" | "rationale"
	>;
	testId?: string;
}): UsageTestEvidenceInput | null {
	const width = cellDimensionSchema.safeParse(cellWidth);
	const height = cellDimensionSchema.safeParse(cellHeight);
	if (!(testId && width.success && height.success)) {
		return null;
	}
	const usageTestContext: NonNullable<
		UsageTestEvidenceInput["usageTestContext"]
	> = { cellDimensions: { width: width.data, height: height.data } };
	if (isObjectSceneTest) {
		const selectedCharacter = approvedCharacterVersions.find(
			(version) => version.id === approvedCharacterVersionId
		);
		const selectedFirstGround = groundVersions.find(
			(version) => version.id === firstGroundVersionId
		);
		const selectedSecondGround = secondGroundVersions.find(
			(version) => version.id === secondGroundVersionId
		);
		if (!(selectedCharacter && selectedFirstGround && selectedSecondGround)) {
			return null;
		}
		usageTestContext.approvedCharacterVersionId = selectedCharacter.id;
		usageTestContext.targetGroundVersionIds = [
			selectedFirstGround.id,
			selectedSecondGround.id,
		];
	}
	return {
		...shared,
		kind: "usage_test",
		result,
		testId,
		method,
		usageTestContext,
	};
}

type EvidenceFormResult =
	| "applicable"
	| "inapplicable"
	| "passed"
	| "failed"
	| "inconclusive"
	| "waived";

interface EvidenceFormValues {
	approvedCharacterVersionId: string;
	cellHeight: string;
	cellWidth: string;
	firstGroundVersionId: string;
	method: string;
	observedValue: string;
	rationale: string;
	result: EvidenceFormResult;
	secondGroundVersionId: string;
	targetHeight: string;
	targetWidth: string;
	usageVariant: string;
	versionTarget: QualityVersionTarget | undefined;
}

function useEvidenceForm(
	initialResult: EvidenceFormResult,
	onSubmit: (value: EvidenceFormValues) => void
) {
	return useForm({
		defaultValues: {
			approvedCharacterVersionId: "",
			cellHeight: "",
			cellWidth: "",
			firstGroundVersionId: "",
			method: "",
			observedValue: "",
			rationale: "",
			result: initialResult,
			secondGroundVersionId: "",
			targetHeight: "",
			targetWidth: "",
			usageVariant: "",
			versionTarget: undefined,
		} as EvidenceFormValues,
		onSubmit: ({ value }) => onSubmit(value),
	});
}

type EvidenceFormApi = ReturnType<typeof useEvidenceForm>;

function UsageTestContextFields({
	approvedCharacterVersions,
	form,
	formId,
	groundVersions,
	isObjectSceneTest,
	recordsById,
	secondGroundVersions,
}: {
	approvedCharacterVersions: UsageTestAssetVersion[];
	form: EvidenceFormApi;
	formId: string;
	groundVersions: UsageTestAssetVersion[];
	isObjectSceneTest: boolean;
	recordsById: Map<string, UsageTestAssetRecord>;
	secondGroundVersions: UsageTestAssetVersion[];
}) {
	return (
		<>
			<div className="grid grid-cols-2 gap-2">
				<Label className={fieldLabelClass} htmlFor={`${formId}-cell-width`}>
					<span>Hücre genişliği (px)</span>
					<form.Field name="cellWidth">
						{(field) => (
							<Input
								id={`${formId}-cell-width`}
								max={4096}
								min={1}
								onChange={(event) =>
									field.handleChange(event.currentTarget.value)
								}
								required
								type="number"
								value={field.state.value}
							/>
						)}
					</form.Field>
				</Label>
				<Label className={fieldLabelClass} htmlFor={`${formId}-cell-height`}>
					<span>Hücre yüksekliği (px)</span>
					<form.Field name="cellHeight">
						{(field) => (
							<Input
								id={`${formId}-cell-height`}
								max={4096}
								min={1}
								onChange={(event) =>
									field.handleChange(event.currentTarget.value)
								}
								required
								step={1}
								type="number"
								value={field.state.value}
							/>
						)}
					</form.Field>
				</Label>
			</div>
			{isObjectSceneTest ? (
				<>
					<form.Field name="approvedCharacterVersionId">
						{(field) => (
							<UsageTestVersionSelect
								id={`${formId}-approved-character-version`}
								label="Onaylı karakter sürümü"
								onChange={field.handleChange}
								recordsById={recordsById}
								value={field.state.value}
								versions={approvedCharacterVersions}
							/>
						)}
					</form.Field>
					<form.Field name="firstGroundVersionId">
						{(field) => (
							<UsageTestVersionSelect
								id={`${formId}-first-ground-version`}
								label="Birinci zemin sürümü"
								onChange={field.handleChange}
								recordsById={recordsById}
								value={field.state.value}
								versions={groundVersions}
							/>
						)}
					</form.Field>
					<form.Field name="secondGroundVersionId">
						{(field) => (
							<UsageTestVersionSelect
								id={`${formId}-second-ground-version`}
								label="İkinci zemin sürümü"
								onChange={field.handleChange}
								recordsById={recordsById}
								value={field.state.value}
								versions={secondGroundVersions}
							/>
						)}
					</form.Field>
				</>
			) : null}
		</>
	);
}

function EvidenceResultField({
	canWaive,
	field,
	formId,
	kind,
}: {
	canWaive: boolean;
	field: {
		handleChange: (result: EvidenceFormResult) => void;
		state: { value: EvidenceFormResult };
	};
	formId: string;
	kind: "applicability" | "quality" | "usage_test";
}) {
	return (
		<Label className={fieldLabelClass} htmlFor={`${formId}-result`}>
			<span>Sonuç</span>
			<NativeSelect
				className="w-full"
				id={`${formId}-result`}
				onChange={(event) =>
					field.handleChange(event.currentTarget.value as EvidenceFormResult)
				}
				value={field.state.value}
			>
				{kind === "applicability" ? (
					<>
						<NativeSelectOption value="applicable">
							Bağlama uygun
						</NativeSelectOption>
						<NativeSelectOption value="inapplicable">
							Bağlama uygun değil
						</NativeSelectOption>
					</>
				) : (
					<>
						<NativeSelectOption value="passed">Geçti</NativeSelectOption>
						<NativeSelectOption value="failed">Başarısız</NativeSelectOption>
						<NativeSelectOption value="inconclusive">
							Sonuçsuz
						</NativeSelectOption>
						{kind === "quality" && canWaive ? (
							<NativeSelectOption value="waived">
								Kalite İstisnası ver
							</NativeSelectOption>
						) : null}
					</>
				)}
			</NativeSelect>
		</Label>
	);
}

function QualityEvidenceFields({
	form,
	formId,
	humanReviewRequirement,
	isWaiver,
	measurementValues,
	qualityRequirement,
	requiresVersionTarget,
	versionTargets,
}: {
	form: EvidenceFormApi;
	formId: string;
	humanReviewRequirement?: FamilyReadiness["items"][number]["humanReviewRequirements"][number];
	isWaiver: boolean;
	measurementValues: ReturnType<typeof qualityMeasurementValues>;
	qualityRequirement?: FamilyReadiness["items"][number]["qualityRequirements"][number];
	requiresVersionTarget: boolean;
	versionTargets: QualityVersionTarget[];
}) {
	return (
		<>
			{qualityRequirement && versionTargets.length > 0 ? (
				<form.Field name="versionTarget">
					{(field) => (
						<QualityVersionTargetSelect
							formId={formId}
							isWaiver={isWaiver}
							onSelect={field.handleChange}
							required={requiresVersionTarget}
							value={measurementValues.versionTarget}
							versionTargets={versionTargets}
						/>
					)}
				</form.Field>
			) : null}
			{qualityRequirement ? (
				<Label className={fieldLabelClass} htmlFor={`${formId}-rule`}>
					<span>Kural kimliği</span>
					<Input id={`${formId}-rule`} readOnly value={qualityRequirement.id} />
				</Label>
			) : null}
			{humanReviewRequirement ? (
				<Label className={fieldLabelClass} htmlFor={`${formId}-review`}>
					<span>İnsan incelemesi kimliği</span>
					<Input
						id={`${formId}-review`}
						readOnly
						value={humanReviewRequirement.id}
					/>
				</Label>
			) : null}
			{qualityRequirement?.waiverEligible ? (
				<Label className={fieldLabelClass} htmlFor={`${formId}-observed-value`}>
					<span>Gözlenen değer</span>
					<form.Field name="observedValue">
						{(field) => (
							<Input
								id={`${formId}-observed-value`}
								maxLength={500}
								onChange={(event) =>
									field.handleChange(event.currentTarget.value)
								}
								readOnly={isWaiver}
								required
								value={measurementValues.observedValue}
							/>
						)}
					</form.Field>
				</Label>
			) : null}
		</>
	);
}

function UsageTestEvidenceFields({
	data,
	form,
	formId,
	grayscaleReviewed,
	isIconTargetSizeTest,
	kind,
	onGrayscaleReviewedChange,
	onScopeInputChange,
	targetDimensions,
	testId,
	usageVariant,
}: {
	data?: IconUsagePreviewContext;
	form: EvidenceFormApi;
	formId: string;
	grayscaleReviewed: boolean;
	isIconTargetSizeTest: boolean;
	kind: "applicability" | "quality" | "usage_test";
	onGrayscaleReviewedChange: (reviewed: boolean) => void;
	onScopeInputChange: () => void;
	targetDimensions: PixelDimensions | null;
	testId?: string;
	usageVariant: string;
}) {
	if (kind !== "usage_test") {
		return null;
	}
	return (
		<>
			<Label className={fieldLabelClass} htmlFor={`${formId}-test`}>
				<span>Kullanım testi kimliği</span>
				<Input id={`${formId}-test`} readOnly value={testId ?? ""} />
			</Label>
			{isIconTargetSizeTest ? (
				<form.Field
					name="usageVariant"
					validators={{
						// A blank-variant error stays visible until a non-blank variant is entered.
						onChange: ({ fieldApi, value }) => {
							const { errorMap } = fieldApi.state.meta;
							if (!(errorMap.onSubmit || errorMap.onChange)) {
								return;
							}
							const issue =
								usageVariantSchema.safeParse(value).error?.issues[0];
							return issue ? { message: issue.message } : undefined;
						},
						onSubmit: usageVariantSchema,
					}}
				>
					{(variantField) => (
						<form.Field name="targetWidth">
							{(widthField) => (
								<form.Field name="targetHeight">
									{(heightField) => (
										<IconUsageEvidenceFields
											data={data}
											formId={formId}
											grayscaleReviewed={grayscaleReviewed}
											onGrayscaleReviewedChange={onGrayscaleReviewedChange}
											onTargetHeightChange={(height) => {
												heightField.handleChange(height);
												onScopeInputChange();
											}}
											onTargetWidthChange={(width) => {
												widthField.handleChange(width);
												onScopeInputChange();
											}}
											onUsageVariantChange={(variant) => {
												if (variant.trim() !== usageVariant.trim()) {
													onScopeInputChange();
												}
												variantField.handleChange(variant);
											}}
											targetDimensions={targetDimensions}
											targetHeight={heightField.state.value}
											targetWidth={widthField.state.value}
											usageVariant={variantField.state.value}
											usageVariantError={
												variantField.state.meta.errors[0]?.message ?? ""
											}
										/>
									)}
								</form.Field>
							)}
						</form.Field>
					)}
				</form.Field>
			) : null}
		</>
	);
}

function EvidenceMethodField({
	field,
	formId,
	kind,
	isWaiver,
	measurementValue,
}: {
	field: { handleChange: (value: string) => void };
	formId: string;
	kind: "applicability" | "quality" | "usage_test";
	isWaiver: boolean;
	measurementValue: string;
}) {
	if (kind === "applicability") {
		return null;
	}
	return (
		<Label className={fieldLabelClass} htmlFor={`${formId}-method`}>
			<span>Yöntem</span>
			<Textarea
				id={`${formId}-method`}
				maxLength={1000}
				onChange={(event) => field.handleChange(event.currentTarget.value)}
				readOnly={isWaiver}
				required
				value={measurementValue}
			/>
		</Label>
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
	usageTestAssetRecords = [],
	usageTestAssetVersions = [],
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
	usageTestAssetRecords?: UsageTestAssetRecord[];
	usageTestAssetVersions?: UsageTestAssetVersion[];
}) {
	const form = useEvidenceForm(initialResult, submit);
	const {
		firstGroundVersionId,
		method,
		observedValue,
		result,
		targetHeight,
		targetWidth,
		usageVariant,
		versionTarget,
	} = useStore(form.store, (state) => state.values);
	const [grayscaleReviewedScopeKey, setGrayscaleReviewedScopeKey] = useState<
		string | null
	>(null);
	const formId = `${assetFamilyId}-${kind}-${item.id}-${evidenceRequirementId(qualityRequirement, humanReviewRequirement, testId)}`;
	const isObjectSceneTest =
		kind === "usage_test" && testId === objectSceneUsageTestId;
	const recordsById = new Map(
		usageTestAssetRecords.map((record) => [record.id, record])
	);
	const approvedCharacterVersions = usageTestAssetVersions.filter(
		(version) =>
			version.reviewDisposition === "approved" &&
			recordsById.get(version.assetRecordId)?.assetCategory ===
				"character_creature_animation"
	);
	const groundVersions = usageTestAssetVersions.filter(
		(version) =>
			recordsById.get(version.assetRecordId)?.assetCategory ===
			"tileset_terrain_texture"
	);
	const firstGroundRecordId = usageTestAssetVersions.find(
		(version) => version.id === firstGroundVersionId
	)?.assetRecordId;
	const secondGroundVersions = groundVersions.filter(
		(version) => version.assetRecordId !== firstGroundRecordId
	);
	const isWaiver = result === "waived";
	const isIconTargetSizeTest =
		kind === "usage_test" && testId === iconLightDarkTargetSizeTestId;
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

	function submit(value: EvidenceFormValues) {
		const shared = {
			projectId,
			assetFamilyId,
			revisionId,
			itemId: item.id,
			rationale: value.rationale,
		};
		if (kind === "applicability") {
			void onRecord({
				...shared,
				kind,
				result: value.result as "applicable" | "inapplicable",
			});
			return;
		}
		if (kind === "quality") {
			if (requiresVersionTarget && !value.versionTarget) {
				return;
			}
			const qualityInput = qualityEvidenceFormInput({
				shared,
				qualityRequirement,
				humanReviewRequirement,
				result: value.result as "passed" | "failed" | "inconclusive" | "waived",
				method: value.method,
				observedValue: value.observedValue,
				versionTarget: value.versionTarget,
				waiverEvidence,
			});
			if (qualityInput) {
				void onRecord(qualityInput);
			}
			return;
		}
		const usageTestInput = buildUsageTestEvidenceInput({
			approvedCharacterVersionId: value.approvedCharacterVersionId,
			approvedCharacterVersions,
			cellHeight: value.cellHeight,
			cellWidth: value.cellWidth,
			firstGroundVersionId: value.firstGroundVersionId,
			groundVersions,
			isObjectSceneTest,
			method: value.method,
			result: value.result as UsageTestEvidenceInput["result"],
			secondGroundVersionId: value.secondGroundVersionId,
			secondGroundVersions,
			shared,
			testId,
		});
		if (usageTestInput) {
			const usageInput = iconUsageEvidenceFormInput({
				shared,
				result: usageTestInput.result,
				testId,
				method: value.method,
				usageVariant: value.usageVariant,
				targetDimensions,
				grayscaleReviewed,
				usageTestContext: usageTestInput.usageTestContext,
			});
			if (usageInput) {
				void onRecord(usageInput);
			}
		}
	}

	return (
		<form
			className="space-y-2 rounded-md bg-muted/30 p-3"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<h6 className="font-medium text-sm">{description}</h6>
			<form.Field
				listeners={{
					onChange: ({ value }) => {
						if (value === "waived") {
							form.setFieldValue("rationale", "");
						}
					},
				}}
				name="result"
			>
				{(field) => (
					<EvidenceResultField
						canWaive={Boolean(waiverEvidence)}
						field={field}
						formId={formId}
						kind={kind}
					/>
				)}
			</form.Field>
			{isWaiver && waiverEvidence ? (
				<QualityWaiverScope evidence={waiverEvidence} />
			) : null}
			<QualityEvidenceFields
				form={form}
				formId={formId}
				humanReviewRequirement={humanReviewRequirement}
				isWaiver={isWaiver}
				measurementValues={measurementValues}
				qualityRequirement={qualityRequirement}
				requiresVersionTarget={requiresVersionTarget}
				versionTargets={versionTargets}
			/>
			<UsageTestEvidenceFields
				data={iconUsagePreview}
				form={form}
				formId={formId}
				grayscaleReviewed={grayscaleReviewed}
				isIconTargetSizeTest={isIconTargetSizeTest}
				kind={kind}
				onGrayscaleReviewedChange={(reviewed) =>
					setGrayscaleReviewedScopeKey(
						reviewed ? currentGrayscaleReviewScopeKey : null
					)
				}
				onScopeInputChange={() => setGrayscaleReviewedScopeKey(null)}
				targetDimensions={targetDimensions}
				testId={testId}
				usageVariant={usageVariant}
			/>
			<form.Field name="method">
				{(field) => (
					<EvidenceMethodField
						field={field}
						formId={formId}
						isWaiver={isWaiver}
						kind={kind}
						measurementValue={measurementValues.method}
					/>
				)}
			</form.Field>
			{kind === "usage_test" ? (
				<UsageTestContextFields
					approvedCharacterVersions={approvedCharacterVersions}
					form={form}
					formId={formId}
					groundVersions={groundVersions}
					isObjectSceneTest={isObjectSceneTest}
					recordsById={recordsById}
					secondGroundVersions={secondGroundVersions}
				/>
			) : null}
			<Label className={fieldLabelClass} htmlFor={`${formId}-rationale`}>
				<span>Gerekçe veya gözlem</span>
				<form.Field name="rationale">
					{(field) => (
						<Textarea
							id={`${formId}-rationale`}
							maxLength={2000}
							onChange={(event) =>
								field.handleChange(event.currentTarget.value)
							}
							required
							value={field.state.value}
						/>
					)}
				</form.Field>
			</Label>
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
