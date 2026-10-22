import type { ReferenceFeature } from "@sprite-anvil/api/asset-record-tracking";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { UnitVersion } from "@sprite-anvil/api/asset-versions";
import type { GenerationPackage } from "@sprite-anvil/api/generation-packages";
import type {
	ContextRule,
	ContextScope,
} from "@sprite-anvil/api/project-context";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type z from "zod";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import { generationPackageFormSchema } from "../../schemas";

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

type GenerationPackageFormValues = z.infer<typeof generationPackageFormSchema>;

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

function ConstraintField({
	id,
	label,
	onBlur,
	onValueChange,
	value,
}: {
	id: string;
	label: string;
	onBlur: () => void;
	onValueChange: (value: string) => void;
	value: string;
}) {
	return (
		<div className="space-y-2">
			<Label className="font-medium text-sm leading-normal" htmlFor={id}>
				{label}
			</Label>
			<Textarea
				className="min-h-16 w-full"
				id={id}
				maxLength={15_000}
				onBlur={onBlur}
				onChange={(event) => onValueChange(event.target.value)}
				value={value}
			/>
			<p className="text-muted-foreground text-xs">
				Her satıra bir özellik yazın.
			</p>
		</div>
	);
}

export function GenerationPackagePanel({
	projectId,
	record,
}: {
	projectId: string;
	record: AssetRecord;
}) {
	const [isSaving, setIsSaving] = useState(false);
	const createPackage = useMutation(
		orpc.generationPackages.create.mutationOptions(mutationMeta)
	);
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

	function renderUnitVersionOptions(
		selectedIds: string[],
		toggle: (id: string, checked: boolean) => void,
		disabled: boolean
	) {
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
					<Label
						className="items-start gap-3 rounded-md border p-3 text-sm leading-normal"
						key={unit.id}
					>
						<Checkbox
							checked={selectedIds.includes(unit.id)}
							className="mt-0.5"
							disabled={disabled}
							onCheckedChange={(checked) => toggle(unit.id, checked)}
						/>
						<span>{getUnitVersionLabel(unit)}</span>
					</Label>
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

	const form = useForm({
		defaultValues: {
			avoidConstraints: "",
			changeConstraints: "",
			expectedOutputStructure: "",
			lockedUnitVersionIds: [] as string[],
			preserveConstraints: "",
			targetHeight: String(
				record.measurements.logicalResolution.confirmed?.height ?? ""
			),
			targetTask: "",
			targetWidth: String(
				record.measurements.logicalResolution.confirmed?.width ?? ""
			),
		},
		onSubmit: ({ value }) => handleCreate(value),
		validators: { onSubmit: generationPackageFormSchema },
	});

	async function handleCreate(value: GenerationPackageFormValues) {
		if (writeOutcomeUncertain) {
			return;
		}
		setErrorMessage(null);
		setStatusMessage(null);
		setIsSaving(true);
		try {
			await createPackage.mutateAsync({
				assetRecordId: record.id,
				avoidConstraints: parseConstraintLines(value.avoidConstraints),
				changeConstraints: parseConstraintLines(value.changeConstraints),
				expectedOutputStructure: value.expectedOutputStructure,
				lockedUnitVersionIds: value.lockedUnitVersionIds,
				preserveConstraints: parseConstraintLines(value.preserveConstraints),
				projectId,
				targetDimensions: {
					height: Number(value.targetHeight),
					width: Number(value.targetWidth),
				},
				targetTask: value.targetTask,
			});
			form.setFieldValue("targetTask", "");
			form.setFieldValue("expectedOutputStructure", "");
			form.setFieldValue("preserveConstraints", "");
			form.setFieldValue("changeConstraints", "");
			form.setFieldValue("avoidConstraints", "");
			form.setFieldValue("lockedUnitVersionIds", []);
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

			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<FieldSet
					className="gap-4"
					disabled={isSaving || writeOutcomeUncertain}
				>
					<FieldLegend className="sr-only">Üretim paketi bilgileri</FieldLegend>
					<form.Field name="targetTask">
						{(field) => (
							<div className="space-y-2">
								<Label
									className="font-medium text-sm leading-normal"
									htmlFor="generation-target-task"
								>
									Üretim hedefi
								</Label>
								<Textarea
									className="min-h-20 w-full"
									id="generation-target-task"
									maxLength={2000}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									required
									value={field.state.value}
								/>
							</div>
						)}
					</form.Field>

					<FieldSet className="gap-2">
						<FieldLegend className="mb-0" variant="label">
							Hedef ölçüleri
						</FieldLegend>
						<p className="text-muted-foreground text-sm">
							Kaydın onaylı mantıksal ölçüleri başlangıç değeri olarak
							kullanılır; bu deneme için değiştirebilirsiniz.
						</p>
						<div className="grid gap-3 sm:grid-cols-2">
							<form.Field name="targetWidth">
								{(field) => (
									<div className="space-y-2">
										<Label
											className="font-medium text-sm leading-normal"
											htmlFor="generation-target-width"
										>
											Hedef genişlik (px)
										</Label>
										<Input
											id="generation-target-width"
											max={100_000}
											min={1}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											required
											step={1}
											type="number"
											value={field.state.value}
										/>
									</div>
								)}
							</form.Field>
							<form.Field name="targetHeight">
								{(field) => (
									<div className="space-y-2">
										<Label
											className="font-medium text-sm leading-normal"
											htmlFor="generation-target-height"
										>
											Hedef yükseklik (px)
										</Label>
										<Input
											id="generation-target-height"
											max={100_000}
											min={1}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											required
											step={1}
											type="number"
											value={field.state.value}
										/>
									</div>
								)}
							</form.Field>
						</div>
					</FieldSet>

					<form.Field name="preserveConstraints">
						{(field) => (
							<ConstraintField
								id="generation-preserve-constraints"
								label="Korunacak özellikler"
								onBlur={field.handleBlur}
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<form.Field name="changeConstraints">
						{(field) => (
							<ConstraintField
								id="generation-change-constraints"
								label="Değiştirilecek özellikler"
								onBlur={field.handleBlur}
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<form.Field name="avoidConstraints">
						{(field) => (
							<ConstraintField
								id="generation-avoid-constraints"
								label="Kaçınılacak özellikler"
								onBlur={field.handleBlur}
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>

					<form.Field name="expectedOutputStructure">
						{(field) => (
							<div className="space-y-2">
								<Label
									className="font-medium text-sm leading-normal"
									htmlFor="generation-expected-output"
								>
									Beklenen çıktı yapısı
								</Label>
								<Textarea
									className="min-h-20 w-full"
									id="generation-expected-output"
									maxLength={2000}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									required
									value={field.state.value}
								/>
							</div>
						)}
					</form.Field>

					<FieldSet className="gap-3" disabled={!canCreate}>
						<FieldLegend className="mb-0" variant="label">
							Değiştirilmeyecek Birim Sürümleri
						</FieldLegend>
						<form.Field mode="array" name="lockedUnitVersionIds">
							{(field) =>
								renderUnitVersionOptions(
									field.state.value,
									(id, checked) => {
										if (checked) {
											field.pushValue(id);
											return;
										}
										field.removeValue(field.state.value.indexOf(id));
									},
									!canCreate
								)
							}
						</form.Field>
					</FieldSet>
				</FieldSet>

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
