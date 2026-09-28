import type { ReferenceFeature } from "@sprite-anvil/api/asset-record-tracking";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { UnitVersion } from "@sprite-anvil/api/asset-versions";
import type { GenerationPackage } from "@sprite-anvil/api/generation-packages";
import type {
	ContextRule,
	ContextScope,
} from "@sprite-anvil/api/project-context";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import type { SyntheticEvent } from "react";
import { useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";

const referenceRoleLabels = {
	avoid: "Kaçınılacak özellik",
	composition: "Kompozisyon",
	custom: "Özel kullanım amacı",
	equipment: "Ekipman",
	identity: "Kimlik",
	palette: "Palet",
	pose: "Poz veya hareket",
	style: "Çizim stili",
	theme: "Tema",
} as const;

const referenceFeatureLabels: Record<ReferenceFeature, string> = {
	composition: "Kompozisyon",
	equipment: "Ekipman",
	identity: "Kimlik",
	palette: "Palet",
	pose: "Poz veya hareket",
	style: "Çizim stili",
	theme: "Tema",
};

const unitTypeLabels = {
	direction: "Yön",
	frame: "Kare",
	state: "Durum",
	tile: "Döşeme",
} as const;

const contextScopeLabels: Record<ContextScope["kind"], string> = {
	asset: "Varlık",
	asset_family: "Varlık Ailesi",
	operation: "İşlem",
	project: "Proje",
	theme: "Tema",
	visual_world: "Görsel Dünya",
};

const newlinePattern = /\r?\n/;

function formatContextRuleValue(rule: ContextRule) {
	switch (rule.value.type) {
		case "boolean":
			return rule.value.value ? "Evet" : "Hayır";
		case "number":
			return String(rule.value.value);
		case "text":
			return rule.value.value;
		case "text_list":
			return rule.value.value.join(", ");
		default: {
			const exhaustiveCheck: never = rule.value;
			return exhaustiveCheck;
		}
	}
}

function formatContextScope(scope: ContextScope) {
	return `${contextScopeLabels[scope.kind]} · ${scope.id}`;
}

function getUnitVersionLabel(
	unit: Pick<UnitVersion, "unitKey" | "unitType" | "versionNumber">
) {
	return `${unit.unitKey} · ${unitTypeLabels[unit.unitType]} · Sürüm ${unit.versionNumber}`;
}

function parseConstraintLines(value: string) {
	return value
		.split(newlinePattern)
		.map((line) => line.trim())
		.filter(Boolean);
}

function getDateLabel(value: string) {
	return new Intl.DateTimeFormat("tr-TR", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function GenerationPackageDetails({
	generationPackage,
}: {
	generationPackage: GenerationPackage;
}) {
	const { productionContextSnapshot: context } = generationPackage;
	return (
		<details className="rounded-lg border p-4">
			<summary className="cursor-pointer font-medium">
				{generationPackage.targetTask} ·{" "}
				{getDateLabel(generationPackage.createdAt)}
			</summary>
			<div className="mt-4 space-y-5 text-sm">
				<section className="space-y-2">
					<h3 className="font-semibold">Üretim Bağlamı Kopyası</h3>
					<p>Bağlam Sürümü {context.revisionNumber}</p>
					<p>{context.generalArtDirection}</p>
					<p>
						Görsel Dünya: {context.visualWorld?.name ?? "Belirtilmemiş"} · Tema:{" "}
						{context.theme?.name ?? "Belirtilmemiş"}
					</p>
					{context.rules.length > 0 ? (
						<ul className="list-inside list-disc space-y-1">
							{context.rules.map((rule) => (
								<li key={`${rule.id}:${rule.scope.kind}:${rule.scope.id}`}>
									{rule.id} · Kapsam: {formatContextScope(rule.scope)} · Öncelik
									zinciri:{" "}
									{rule.precedenceChain.map(formatContextScope).join(" → ")} ·
									Değer: {formatContextRuleValue(rule)}
								</li>
							))}
						</ul>
					) : (
						<p>Bu kayıt için kapsamlı Bağlam Kuralı yok.</p>
					)}
				</section>
				<section className="space-y-2">
					<h3 className="font-semibold">Hedef ve ölçüler</h3>
					<p>
						{generationPackage.targetDimensions.width} ×{" "}
						{generationPackage.targetDimensions.height} px
					</p>
					<p>
						Ana Tasarım:{" "}
						{generationPackage.canonicalDesign
							? `Sürüm ${generationPackage.canonicalDesign.versionNumber}`
							: "Seçilmemiş"}
					</p>
				</section>
				<section className="space-y-2">
					<h3 className="font-semibold">Referans Kullanım Amaçları</h3>
					{generationPackage.referenceRoles.length > 0 ? (
						<ul className="list-inside list-disc space-y-1">
							{generationPackage.referenceRoles.map((reference) => (
								<li key={`${reference.kind}:${reference.id}`}>
									{referenceRoleLabels[reference.role]} ·{" "}
									{reference.assetRecordName ??
										reference.fileName ??
										"Referans"}
									{reference.customPurpose
										? ` · Kullanım amacı: ${reference.customPurpose}`
										: ""}
									{reference.contextOverrideRationale
										? ` · Bağlam istisnası gerekçesi: ${reference.contextOverrideRationale}`
										: ""}
									{reference.transferredFeatures.length > 0
										? ` · Aktarılabilir: ${reference.transferredFeatures.map((feature) => referenceFeatureLabels[feature]).join(", ")}`
										: ""}
									{reference.forbiddenFeatures.length > 0
										? ` · Kaçınılacak: ${reference.forbiddenFeatures.map((feature) => referenceFeatureLabels[feature]).join(", ")}`
										: ""}
								</li>
							))}
						</ul>
					) : (
						<p>Referans kullanım amacı eklenmemiş.</p>
					)}
				</section>
				{(
					[
						["Korunacak özellikler", generationPackage.preserveConstraints],
						["Değiştirilecek özellikler", generationPackage.changeConstraints],
						["Kaçınılacak özellikler", generationPackage.avoidConstraints],
					] as const
				).map(([title, values]) => (
					<section className="space-y-2" key={title}>
						<h3 className="font-semibold">{title}</h3>
						{values.length > 0 ? (
							<ul className="list-inside list-disc space-y-1">
								{values.map((value) => (
									<li key={value}>{value}</li>
								))}
							</ul>
						) : (
							<p>Belirtilmemiş.</p>
						)}
					</section>
				))}
				<section className="space-y-2">
					<h3 className="font-semibold">Değiştirilmeyecek Birim Sürümleri</h3>
					{generationPackage.lockedUnits.length > 0 ? (
						<ul className="list-inside list-disc space-y-1">
							{generationPackage.lockedUnits.map((unit) => (
								<li key={unit.id}>{getUnitVersionLabel(unit)}</li>
							))}
						</ul>
					) : (
						<p>Birim Sürümü sabitlenmemiş.</p>
					)}
				</section>
				<section className="space-y-2">
					<h3 className="font-semibold">Beklenen çıktı yapısı</h3>
					<p className="whitespace-pre-wrap">
						{generationPackage.expectedOutputStructure}
					</p>
				</section>
			</div>
		</details>
	);
}

export function GenerationPackagePanel({
	projectId,
	record,
}: {
	projectId: string;
	record: AssetRecord;
}) {
	const [targetTask, setTargetTask] = useState("");
	const [targetWidth, setTargetWidth] = useState(() =>
		String(record.measurements.logicalResolution.confirmed?.width ?? "")
	);
	const [targetHeight, setTargetHeight] = useState(() =>
		String(record.measurements.logicalResolution.confirmed?.height ?? "")
	);
	const [expectedOutputStructure, setExpectedOutputStructure] = useState("");
	const [preserveConstraints, setPreserveConstraints] = useState("");
	const [changeConstraints, setChangeConstraints] = useState("");
	const [avoidConstraints, setAvoidConstraints] = useState("");
	const [lockedUnitVersionIds, setLockedUnitVersionIds] = useState<string[]>(
		[]
	);
	const [isSaving, setIsSaving] = useState(false);
	const [isCheckingOutcome, setIsCheckingOutcome] = useState(false);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const packagesQuery = useQuery(
		orpc.generationPackages.list.queryOptions({
			input: { assetRecordId: record.id, projectId },
		})
	);
	const assetVersionsQuery = useQuery(
		orpc.assetVersions.list.queryOptions({ input: { projectId } })
	);
	const unitVersions = (assetVersionsQuery.data?.unitVersions ?? [])
		.filter((unit) => unit.assetRecordId === record.id)
		.toSorted((left, right) =>
			`${left.unitType}:${left.unitKey}:${left.versionNumber}`.localeCompare(
				`${right.unitType}:${right.unitKey}:${right.versionNumber}`
			)
		);
	const generationPackages = packagesQuery.data ?? [];

	function toggleLockedUnit(id: string, checked: boolean) {
		setLockedUnitVersionIds((current) =>
			checked
				? [...current, id]
				: current.filter((currentId) => currentId !== id)
		);
	}

	function renderUnitVersionOptions() {
		if (assetVersionsQuery.isPending) {
			return (
				<p aria-live="polite" className="text-muted-foreground text-sm">
					Birim Sürümleri yükleniyor…
				</p>
			);
		}
		if (assetVersionsQuery.isError) {
			return (
				<div className="space-y-2">
					<p className="text-sm" role="alert">
						Birim Sürümleri yüklenemedi.
					</p>
					<Button
						onClick={() => void assetVersionsQuery.refetch()}
						type="button"
						variant="outline"
					>
						Yeniden yükle
					</Button>
				</div>
			);
		}
		if (unitVersions.length === 0) {
			return (
				<p className="text-muted-foreground text-sm">
					Bu Varlık Kaydında sabitlenebilir Birim Sürümü yok.
				</p>
			);
		}
		return (
			<div className="space-y-2">
				{unitVersions.map((unit) => (
					<label
						className="flex items-start gap-3 rounded-md border p-3 text-sm"
						key={unit.id}
					>
						<input
							checked={lockedUnitVersionIds.includes(unit.id)}
							className="mt-0.5 size-4 accent-primary"
							onChange={(event) =>
								toggleLockedUnit(unit.id, event.target.checked)
							}
							type="checkbox"
						/>
						<span>{getUnitVersionLabel(unit)}</span>
					</label>
				))}
			</div>
		);
	}

	function renderSavedGenerationPackages() {
		if (packagesQuery.isPending) {
			return (
				<p aria-live="polite" className="text-muted-foreground text-sm">
					Üretim Paketleri yükleniyor…
				</p>
			);
		}
		if (packagesQuery.isError) {
			return (
				<div className="space-y-2">
					<p className="text-sm" role="alert">
						Üretim Paketleri yüklenemedi.
					</p>
					<Button
						onClick={() => void packagesQuery.refetch()}
						type="button"
						variant="outline"
					>
						Yeniden yükle
					</Button>
				</div>
			);
		}
		if (generationPackages.length === 0) {
			return (
				<p className="text-muted-foreground text-sm">
					Bu Varlık Kaydında henüz Üretim Paketi yok.
				</p>
			);
		}
		return (
			<div className="space-y-3">
				{generationPackages.map((generationPackage) => (
					<GenerationPackageDetails
						generationPackage={generationPackage}
						key={generationPackage.id}
					/>
				))}
			</div>
		);
	}

	async function handleCreate(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (writeOutcomeUncertain) {
			return;
		}
		setErrorMessage(null);
		setStatusMessage(null);
		setIsSaving(true);
		try {
			await client.generationPackages.create({
				assetRecordId: record.id,
				avoidConstraints: parseConstraintLines(avoidConstraints),
				changeConstraints: parseConstraintLines(changeConstraints),
				expectedOutputStructure,
				lockedUnitVersionIds,
				preserveConstraints: parseConstraintLines(preserveConstraints),
				projectId,
				targetDimensions: {
					height: Number(targetHeight),
					width: Number(targetWidth),
				},
				targetTask,
			});
			setTargetTask("");
			setExpectedOutputStructure("");
			setPreserveConstraints("");
			setChangeConstraints("");
			setAvoidConstraints("");
			setLockedUnitVersionIds([]);
			setStatusMessage("Üretim Paketi oluşturuldu ve kaydedildi.");
			try {
				const result = await packagesQuery.refetch();
				if (result.isError) {
					setErrorMessage(
						"Üretim Paketi kaydedildi ancak liste yenilenemedi. Kaydedilmiş Üretim Paketlerini yeniden yükleyin."
					);
				}
			} catch {
				setErrorMessage(
					"Üretim Paketi kaydedildi ancak liste yenilenemedi. Kaydedilmiş Üretim Paketlerini yeniden yükleyin."
				);
			}
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				setWriteOutcomeUncertain(true);
				setErrorMessage(
					"İşlemin sonucu doğrulanamadı. Aynı isteği tekrar göndermeden önce kayıtlı Üretim Paketlerini kontrol edin."
				);
			} else {
				setErrorMessage(
					getErrorMessage(
						error,
						"Üretim Paketi oluşturulamadı. Gerekli bilgileri kontrol edip tekrar deneyin."
					)
				);
			}
		} finally {
			setIsSaving(false);
		}
	}

	async function checkWriteOutcome() {
		setIsCheckingOutcome(true);
		try {
			const result = await packagesQuery.refetch();
			if (result.isError) {
				setErrorMessage(
					"Kaydedilmiş Üretim Paketleri yenilenemedi. Aynı isteği yeniden göndermeden önce tekrar kontrol edin."
				);
				return;
			}
			setWriteOutcomeUncertain(false);
			setErrorMessage(null);
			setStatusMessage(
				"Kaydedilmiş Üretim Paketleri güncellendi. Sonucu inceleyip gerekirse yeni bir paket oluşturabilirsiniz."
			);
		} catch {
			setErrorMessage(
				"Kaydedilmiş Üretim Paketleri yenilenemedi. Aynı isteği yeniden göndermeden önce tekrar kontrol edin."
			);
		} finally {
			setIsCheckingOutcome(false);
		}
	}

	const canCreate =
		record.availability === "active" &&
		!isSaving &&
		!writeOutcomeUncertain &&
		!assetVersionsQuery.isPending &&
		!assetVersionsQuery.isError;

	return (
		<section
			aria-labelledby="generation-packages-heading"
			className="space-y-5 rounded-lg border p-5"
		>
			<header className="space-y-2">
				<h2 className="font-semibold text-xl" id="generation-packages-heading">
					Üretim Paketleri
				</h2>
				<p className="text-muted-foreground text-sm">
					Tek bir harici deneme için etkin bağlamı ve üretim sınırlarını
					sabitleyin. Doğal dil talimatını ChatGPT veya kullandığınız başka bir
					üretim yüzeyinde siz yazarsınız.
				</p>
			</header>

			<form className="space-y-4" onSubmit={handleCreate}>
				<fieldset
					className="space-y-4"
					disabled={isSaving || writeOutcomeUncertain}
				>
					<legend className="sr-only">Üretim paketi bilgileri</legend>
					<div className="space-y-2">
						<label
							className="font-medium text-sm"
							htmlFor="generation-target-task"
						>
							Üretim hedefi
						</label>
						<textarea
							className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
							id="generation-target-task"
							maxLength={2000}
							onChange={(event) => setTargetTask(event.target.value)}
							required
							value={targetTask}
						/>
					</div>

					<fieldset className="space-y-2">
						<legend className="font-medium text-sm">Hedef ölçüleri</legend>
						<p className="text-muted-foreground text-sm">
							Kaydın onaylı mantıksal ölçüleri başlangıç değeri olarak
							kullanılır; bu deneme için değiştirebilirsiniz.
						</p>
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="space-y-2">
								<label
									className="font-medium text-sm"
									htmlFor="generation-target-width"
								>
									Hedef genişlik (px)
								</label>
								<input
									className="h-9 w-full rounded-md border bg-background px-3 text-sm"
									id="generation-target-width"
									max={100_000}
									min={1}
									onChange={(event) => setTargetWidth(event.target.value)}
									required
									step={1}
									type="number"
									value={targetWidth}
								/>
							</div>
							<div className="space-y-2">
								<label
									className="font-medium text-sm"
									htmlFor="generation-target-height"
								>
									Hedef yükseklik (px)
								</label>
								<input
									className="h-9 w-full rounded-md border bg-background px-3 text-sm"
									id="generation-target-height"
									max={100_000}
									min={1}
									onChange={(event) => setTargetHeight(event.target.value)}
									required
									step={1}
									type="number"
									value={targetHeight}
								/>
							</div>
						</div>
					</fieldset>

					{(
						[
							{
								id: "generation-preserve-constraints",
								label: "Korunacak özellikler",
								value: preserveConstraints,
								setValue: setPreserveConstraints,
							},
							{
								id: "generation-change-constraints",
								label: "Değiştirilecek özellikler",
								value: changeConstraints,
								setValue: setChangeConstraints,
							},
							{
								id: "generation-avoid-constraints",
								label: "Kaçınılacak özellikler",
								value: avoidConstraints,
								setValue: setAvoidConstraints,
							},
						] as const
					).map(({ id, label, value, setValue }) => (
						<div className="space-y-2" key={label}>
							<label className="font-medium text-sm" htmlFor={id}>
								{label}
							</label>
							<textarea
								className="min-h-16 w-full rounded-md border bg-background px-3 py-2 text-sm"
								id={id}
								maxLength={15_000}
								onChange={(event) => setValue(event.target.value)}
								value={value}
							/>
							<p className="text-muted-foreground text-xs">
								Her satıra bir özellik yazın.
							</p>
						</div>
					))}

					<div className="space-y-2">
						<label
							className="font-medium text-sm"
							htmlFor="generation-expected-output"
						>
							Beklenen çıktı yapısı
						</label>
						<textarea
							className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
							id="generation-expected-output"
							maxLength={2000}
							onChange={(event) =>
								setExpectedOutputStructure(event.target.value)
							}
							required
							value={expectedOutputStructure}
						/>
					</div>

					<fieldset className="space-y-3" disabled={!canCreate}>
						<legend className="font-medium text-sm">
							Değiştirilmeyecek Birim Sürümleri
						</legend>
						{renderUnitVersionOptions()}
					</fieldset>
				</fieldset>

				{errorMessage ? (
					<p
						className="rounded-md border border-destructive p-3 text-sm"
						role="alert"
					>
						{errorMessage}
					</p>
				) : null}
				{writeOutcomeUncertain ? (
					<Button
						disabled={isCheckingOutcome}
						onClick={() => void checkWriteOutcome()}
						type="button"
						variant="outline"
					>
						{isCheckingOutcome
							? "Durum kontrol ediliyor…"
							: "Durumu kontrol et"}
					</Button>
				) : null}
				{statusMessage ? (
					<p aria-live="polite" className="text-sm" role="status">
						{statusMessage}
					</p>
				) : null}
				{record.availability === "active" ? (
					<Button disabled={!canCreate} type="submit">
						{isSaving ? "Kaydediliyor…" : "Üretim Paketini sabitle"}
					</Button>
				) : (
					<p className="text-muted-foreground text-sm">
						Arşivlenmiş Varlık Kaydında yeni Üretim Paketi oluşturulamaz.
					</p>
				)}
			</form>

			<section
				aria-labelledby="saved-generation-packages-heading"
				className="space-y-3"
			>
				<h3 className="font-semibold" id="saved-generation-packages-heading">
					Kaydedilmiş Üretim Paketleri
				</h3>
				{renderSavedGenerationPackages()}
			</section>
		</section>
	);
}
