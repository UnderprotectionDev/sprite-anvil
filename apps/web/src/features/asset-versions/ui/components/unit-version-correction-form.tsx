import type {
	AssetVersion,
	UnitVersion,
	UnitVersionType,
} from "@sprite-anvil/api/asset-versions";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import type { useAssetVersionWrites } from "../../hooks/use-asset-version-writes";
import { reviewDispositionLabels } from "../../lib/review-disposition-labels";
import {
	unitVersionCorrectionFormSchema,
	unitVersionTypes,
} from "../../schemas";

export const unitTypeLabels: Record<UnitVersionType, string> = {
	frame: "Kare",
	direction: "Yön",
	tile: "Karo",
	state: "Durum",
};

const labelClassName = "block space-y-1 text-sm";
const controlClassName =
	"min-h-11 w-full rounded-md border bg-background px-3 text-sm md:text-sm";
const selectWrapperClassName =
	"w-full [&_select]:min-h-11 [&_select]:rounded-md [&_select]:border [&_select]:bg-background [&_select]:px-3 [&_select]:text-sm";

function isUnitVersionType(value: string): value is UnitVersionType {
	return (unitVersionTypes as readonly string[]).includes(value);
}

export function UnitVersionCorrectionForm({
	assetRecordId,
	assetVersions,
	unitVersions,
	writes,
}: {
	assetRecordId: string;
	assetVersions: AssetVersion[];
	unitVersions: UnitVersion[];
	writes: ReturnType<typeof useAssetVersionWrites>;
}) {
	const form = useForm({
		defaultValues: {
			file: null as File | null,
			sourceAssetVersionId: "",
			unitKey: "",
			unitType: "frame" as UnitVersionType,
		},
		onSubmit: async ({ value }) => {
			const parsed = unitVersionCorrectionFormSchema(
				new Set(
					sourceVersionsFor(value.unitType, value.unitKey).map(
						(version) => version.id
					)
				)
			).safeParse(value);
			if (!parsed.success) {
				return;
			}
			const { file, sourceAssetVersionId, unitKey, unitType } = parsed.data;
			const created = await writes.upload(assetRecordId, file, {
				unitCorrection: { sourceAssetVersionId, unitType, unitKey },
			});
			if (created) {
				form.setFieldValue("file", null);
			}
		},
	});
	const values = useStore(form.store, (state) => state.values);
	const normalizedUnitKey = values.unitKey.trim();

	function sourceVersionsFor(unitType: UnitVersionType, unitKey: string) {
		const normalizedKey = unitKey.trim();
		return assetVersions.filter((version) => {
			const unitVersion = unitVersions.find(
				(candidate) => candidate.assetVersionId === version.id
			);
			return (
				!unitVersion ||
				(unitVersion.unitType === unitType &&
					unitVersion.unitKey === normalizedKey)
			);
		});
	}

	const sourceVersions = sourceVersionsFor(values.unitType, values.unitKey);
	const selectedSource = sourceVersions.find(
		(version) => version.id === values.sourceAssetVersionId
	);
	const formId = `unit-version-correction-${assetRecordId}`;

	return (
		<div className="space-y-3 rounded-md border p-3">
			<h5 className="font-medium">Birim Sürümünü seçici düzelt</h5>
			<p className="text-muted-foreground text-sm">
				Düzeltilmiş tek birim dosyasını yükleyin. Aynı birimde sonraki
				düzeltmeleri sürdürmek için aynı birim adını kullanın; kaynak ve diğer
				birimler korunur.
			</p>
			{assetVersions.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Önce kaynak olarak kullanılacak bir Varlık Sürümü yükleyin.
				</p>
			) : null}
			<form
				className="grid gap-3 sm:grid-cols-2"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="unitType">
					{(field) => (
						<Label className={labelClassName} htmlFor={`${formId}-type`}>
							<span className="block">Birim türü</span>
							<NativeSelect
								className={selectWrapperClassName}
								disabled={writes.writesDisabled}
								id={`${formId}-type`}
								onBlur={field.handleBlur}
								onChange={(event) => {
									const { value } = event.currentTarget;
									if (isUnitVersionType(value)) {
										field.handleChange(value);
									}
								}}
								value={field.state.value}
							>
								{unitVersionTypes.map((type) => (
									<NativeSelectOption key={type} value={type}>
										{unitTypeLabels[type]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Label>
					)}
				</form.Field>
				<form.Field name="unitKey">
					{(field) => (
						<Label className={labelClassName} htmlFor={`${formId}-key`}>
							<span className="block">Birim adı</span>
							<Input
								className={controlClassName}
								disabled={writes.writesDisabled}
								id={`${formId}-key`}
								maxLength={120}
								onBlur={field.handleBlur}
								onChange={(event) =>
									field.handleChange(event.currentTarget.value)
								}
								placeholder="Örn. saldırı/kare-3"
								required
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
				<form.Field name="sourceAssetVersionId">
					{(field) => (
						<Label className={labelClassName} htmlFor={`${formId}-source`}>
							<span className="block">Kaynak Varlık Sürümü</span>
							<NativeSelect
								className={selectWrapperClassName}
								disabled={writes.writesDisabled || sourceVersions.length === 0}
								id={`${formId}-source`}
								onBlur={field.handleBlur}
								onChange={(event) =>
									field.handleChange(event.currentTarget.value)
								}
								required
								value={selectedSource?.id ?? ""}
							>
								<NativeSelectOption value="">
									Kaynak sürümü seçin
								</NativeSelectOption>
								{sourceVersions.map((version) => (
									<NativeSelectOption key={version.id} value={version.id}>
										Sürüm {version.versionNumber} ·{" "}
										{reviewDispositionLabels[version.reviewDisposition]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Label>
					)}
				</form.Field>
				<form.Field name="file">
					{(field) => (
						<Label className={labelClassName} htmlFor={`${formId}-file`}>
							<span className="block">Düzeltilmiş PNG veya WebP</span>
							<Input
								accept="image/png,image/webp"
								className="block h-auto min-h-11 w-full rounded-md border px-3 py-2 text-sm file:mr-3 md:text-sm"
								disabled={writes.writesDisabled}
								id={`${formId}-file`}
								onBlur={field.handleBlur}
								onChange={(event) =>
									field.handleChange(event.currentTarget.files?.[0] ?? null)
								}
								type="file"
							/>
						</Label>
					)}
				</form.Field>
				<div className="sm:col-span-2">
					<Button
						disabled={
							writes.writesDisabled ||
							!selectedSource ||
							!normalizedUnitKey ||
							!values.file
						}
						type="submit"
					>
						Birim düzeltmesini kaydet
					</Button>
				</div>
			</form>
		</div>
	);
}

export function UnitVersionHistory({
	assetVersions,
	unitVersions,
}: {
	assetVersions: AssetVersion[];
	unitVersions: UnitVersion[];
}) {
	const versionsById = new Map(
		assetVersions.map((version) => [version.id, version])
	);

	return (
		<div className="space-y-2">
			<h5 className="font-medium">Birim Sürümleri</h5>
			{unitVersions.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Henüz Birim Sürümü kaydedilmedi.
				</p>
			) : (
				<ol className="list-inside list-disc space-y-1 text-sm">
					{unitVersions.map((unitVersion) => {
						const version = versionsById.get(unitVersion.assetVersionId);
						const source = versionsById.get(unitVersion.sourceAssetVersionId);
						return (
							<li key={unitVersion.id}>
								<span>
									{unitTypeLabels[unitVersion.unitType]} · {unitVersion.unitKey}{" "}
									· Birim Sürümü {unitVersion.versionNumber}
								</span>
								{version && source ? (
									<span className="text-muted-foreground">
										{" "}
										— Aday Sürüm {version.versionNumber}; kaynak Varlık Sürümü{" "}
										{source.versionNumber}
									</span>
								) : null}
							</li>
						);
					})}
				</ol>
			)}
		</div>
	);
}
