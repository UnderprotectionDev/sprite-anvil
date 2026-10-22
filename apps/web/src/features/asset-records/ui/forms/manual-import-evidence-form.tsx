import type { ManualImportVersionCreateInput } from "@sprite-anvil/api/asset-record-tracking";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { GenerationPackage } from "@sprite-anvil/api/generation-packages";
import type { ProviderGenerationRecordCreateInput } from "@sprite-anvil/api/provider-generation-records";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type RefObject, useRef, useState } from "react";
import { ProviderGenerationRecordForm } from "@/features/asset-versions/ui/components/provider-generation-record-form";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import {
	isSupportedManualImportFile,
	manualImportEvidenceFormSchema,
	manualImportEvidenceSubmitSchema,
} from "../../schemas";

type ProviderGenerationRecordFields = Omit<
	ProviderGenerationRecordCreateInput,
	"assetVersionId" | "projectId"
>;

function bytesToBase64(bytes: Uint8Array) {
	const chunkSize = 0x80_00;
	const chunks: string[] = [];
	for (let index = 0; index < bytes.length; index += chunkSize) {
		chunks.push(
			String.fromCharCode(...bytes.subarray(index, index + chunkSize))
		);
	}
	return btoa(chunks.join(""));
}

function getPackageDateLabel(value: string) {
	return new Intl.DateTimeFormat("tr-TR", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function getTransferredFile(transfer: DataTransfer) {
	return (
		transfer.files.item(0) ??
		Array.from(transfer.items)
			.find((item) => item.kind === "file")
			?.getAsFile() ??
		null
	);
}

function refreshedHasEvidence(result: unknown, assetVersionId: string) {
	if (typeof result !== "object" || result === null || !("data" in result)) {
		return false;
	}
	const { data } = result;
	if (typeof data !== "object" || data === null || !("tracking" in data)) {
		return false;
	}
	const { tracking } = data;
	return (
		typeof tracking === "object" &&
		tracking !== null &&
		"manualImportEvidence" in tracking &&
		Array.isArray(tracking.manualImportEvidence) &&
		tracking.manualImportEvidence.some(
			(evidence) =>
				typeof evidence === "object" &&
				evidence !== null &&
				"assetVersionId" in evidence &&
				evidence.assetVersionId === assetVersionId
		)
	);
}

const manualImportFormDefaults = {
	file: null as File | null,
	generationInstruction: "",
	generationPackageId: "",
	isProviderResult: false,
	sourceSurface: "",
};

function useManualImportForm(
	onSubmit: (values: typeof manualImportFormDefaults) => Promise<void>
) {
	return useForm({
		defaultValues: manualImportFormDefaults,
		onSubmit: ({ value }) => onSubmit(value),
		validators: { onSubmit: manualImportEvidenceSubmitSchema },
	});
}

interface ManualImportPackageFormProps {
	fileInputRef: RefObject<HTMLInputElement | null>;
	form: ReturnType<typeof useManualImportForm>;
	isError: boolean;
	isLoading: boolean;
	isSaving: boolean;
	onRetry: () => void;
	packages: GenerationPackage[];
	selectedPackageExists: boolean;
	writeOutcomeUncertain: boolean;
}

function ManualImportPackageForm({
	fileInputRef,
	form,
	isError,
	isLoading,
	isSaving,
	onRetry,
	packages,
	selectedPackageExists,
	writeOutcomeUncertain,
}: ManualImportPackageFormProps) {
	const values = useStore(form.store, (state) => state.values);
	const { file } = values;
	const fileIsSupported = isSupportedManualImportFile(file);
	const locked = isSaving || writeOutcomeUncertain;
	if (isLoading) {
		return (
			<p aria-live="polite" className="mt-4 text-muted-foreground text-sm">
				Üretim Paketleri yükleniyor…
			</p>
		);
	}
	if (isError) {
		return (
			<div className="mt-4 space-y-2">
				<p className="text-sm" role="alert">
					Üretim Paketleri yüklenemedi.
				</p>
				<Button
					disabled={isSaving}
					onClick={onRetry}
					type="button"
					variant="outline"
				>
					Yeniden yükle
				</Button>
			</div>
		);
	}
	if (packages.length === 0) {
		return (
			<p className="mt-4 text-muted-foreground text-sm">
				Bu Varlık Kaydı için henüz Üretim Paketi yok. Önce Üretim Paketi
				bölümünden bir paket oluşturun.
			</p>
		);
	}

	return (
		<form
			className="mt-4 space-y-3"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="isProviderResult">
				{(field) => (
					<Label className="items-start text-sm leading-normal">
						<Checkbox
							checked={field.state.value}
							disabled={locked}
							onCheckedChange={(checked) => field.handleChange(checked)}
						/>
						<span>Başka bir sağlayıcının arayüzünden alındı</span>
					</Label>
				)}
			</form.Field>
			{values.isProviderResult ? (
				<p className="text-muted-foreground text-sm">
					Dosya ve Elle İçe Aktarma Kanıtı kaydedildikten sonra, sağlayıcı
					ekranında gördüğünüz ayrıntıları kullanıcı bildirimi olarak
					girebilirsiniz.
				</p>
			) : null}
			<form.Field name="file">
				{(field) => (
					<div className="space-y-2 rounded-md border border-dashed p-3">
						<Label
							className="block space-y-1 text-sm leading-normal"
							htmlFor="manual-import-file"
						>
							<span>Sonuç dosyası</span>
							<Input
								accept="image/png,image/webp"
								disabled={locked}
								id="manual-import-file"
								onChange={(event) =>
									field.handleChange(event.target.files?.[0] ?? null)
								}
								ref={fileInputRef}
								type="file"
							/>
						</Label>
						<Button
							aria-label="Sonuç dosyasını seçin, yapıştırın veya bırakın"
							className="h-auto w-full justify-start whitespace-normal p-2 text-left text-muted-foreground text-sm"
							disabled={locked}
							onClick={() => fileInputRef.current?.click()}
							onDragOver={(event) => event.preventDefault()}
							onDrop={(event) => {
								event.preventDefault();
								const droppedFile = getTransferredFile(event.dataTransfer);
								if (droppedFile) {
									field.handleChange(droppedFile);
								}
							}}
							onPaste={(event) => {
								const pastedFile = getTransferredFile(event.clipboardData);
								if (pastedFile) {
									event.preventDefault();
									field.handleChange(pastedFile);
								}
							}}
							type="button"
							variant="ghost"
						>
							PNG veya WebP dosyasını buraya sürükleyin ya da yapıştırın; dosya
							seçmek için tıklayın.
						</Button>
						{field.state.value ? (
							<p className="text-sm" role="status">
								Seçilen dosya: {field.state.value.name}
							</p>
						) : null}
					</div>
				)}
			</form.Field>
			{file && !fileIsSupported ? (
				<p className="text-sm" role="alert">
					5 MB’a kadar PNG veya WebP dosyası seçin.
				</p>
			) : null}
			<form.Field name="generationPackageId">
				{(field) => (
					<Label
						className="block space-y-1 text-sm leading-normal"
						htmlFor="manual-import-generation-package"
					>
						<span>Üretim Paketi</span>
						<NativeSelect
							className="w-full"
							disabled={locked}
							id="manual-import-generation-package"
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={field.state.value}
						>
							<NativeSelectOption value="">Paket seçin</NativeSelectOption>
							{packages.map((generationPackage) => (
								<NativeSelectOption
									key={generationPackage.id}
									value={generationPackage.id}
								>
									{generationPackage.targetTask} ·{" "}
									{getPackageDateLabel(generationPackage.createdAt)} ·{" "}
									{generationPackage.id.slice(0, 8)}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Label>
				)}
			</form.Field>
			<form.Field name="sourceSurface">
				{(field) => (
					<Label
						className="block space-y-1 text-sm leading-normal"
						htmlFor="manual-import-surface"
					>
						<span>Üretim yüzeyi</span>
						<Input
							autoComplete="off"
							disabled={locked}
							id="manual-import-surface"
							maxLength={255}
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={field.state.value}
						/>
					</Label>
				)}
			</form.Field>
			<form.Field name="generationInstruction">
				{(field) => (
					<Label
						className="block space-y-1 text-sm leading-normal"
						htmlFor="manual-import-generation-instruction"
					>
						<span>Gerçek üretim talimatı</span>
						<Textarea
							className="min-h-28 w-full"
							disabled={locked}
							id="manual-import-generation-instruction"
							maxLength={100_000}
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={field.state.value}
						/>
					</Label>
				)}
			</form.Field>
			<Button
				disabled={
					locked ||
					!selectedPackageExists ||
					!manualImportEvidenceFormSchema.safeParse(values).success
				}
				type="submit"
			>
				{isSaving ? "Kaydediliyor…" : "Kanıtla birlikte aday sürümü kaydet"}
			</Button>
		</form>
	);
}

export function ManualImportEvidenceForm({
	onRefresh,
	record,
}: {
	onRefresh: () => Promise<unknown>;
	record: AssetRecord;
}) {
	const packagesQuery = useQuery(
		orpc.generationPackages.list.queryOptions({
			input: { assetRecordId: record.id, projectId: record.projectId },
		})
	);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const request = useRef<{ id: string; signature: string } | null>(null);
	const [providerRecordVersionId, setProviderRecordVersionId] = useState<
		string | null
	>(null);
	const [isSaving, setIsSaving] = useState(false);
	const createManualImportVersion = useMutation(
		orpc.assetRecords.createManualImportVersion.mutationOptions(mutationMeta)
	);
	const recordProviderGeneration = useMutation(
		orpc.assetVersions.recordProviderGeneration.mutationOptions(mutationMeta)
	);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	const form = useManualImportForm(submit);
	const generationPackageId = useStore(
		form.store,
		(state) => state.values.generationPackageId
	);

	const packages = packagesQuery.data ?? [];
	const selectedPackageExists = packages.some(
		(generationPackage) => generationPackage.id === generationPackageId
	);

	function resetForm() {
		request.current = null;
		setWriteOutcomeUncertain(false);
		form.reset();
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}

	async function submit(values: typeof manualImportFormDefaults) {
		const { file } = values;
		if (
			!(file && packages.some((item) => item.id === values.generationPackageId))
		) {
			return;
		}
		const {
			generationInstruction,
			generationPackageId: selectedPackageId,
			isProviderResult: reportedByProvider,
			sourceSurface,
		} = values;

		setErrorMessage(null);
		setStatusMessage(null);
		let contentBase64: string;
		try {
			contentBase64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
		} catch (error) {
			setErrorMessage(
				getErrorMessage(
					error,
					"Sonuç dosyası okunamadı. Dosyayı yeniden seçip deneyin."
				)
			);
			return;
		}
		const signature = JSON.stringify({
			assetRecordId: record.id,
			contentBase64,
			contentType: file.type,
			fileName: file.name,
			generationInstruction,
			generationPackageId: selectedPackageId,
			productionSource: reportedByProvider
				? "user_reported_provider"
				: "unknown",
			projectId: record.projectId,
			sourceSurface,
		});
		if (request.current?.signature !== signature) {
			request.current = { id: crypto.randomUUID(), signature };
		}
		const input: ManualImportVersionCreateInput = {
			assetRecordId: record.id,
			contentBase64,
			contentType: file.type as ManualImportVersionCreateInput["contentType"],
			fileName: file.name,
			generationInstruction,
			generationPackageId: selectedPackageId,
			id: request.current.id,
			projectId: record.projectId,
			...(reportedByProvider
				? { productionSource: "user_reported_provider" as const }
				: {}),
			sourceSurface,
		};

		setIsSaving(true);
		try {
			const version = await createManualImportVersion.mutateAsync(input);
			if (reportedByProvider) {
				setProviderRecordVersionId(version.id);
			}
			await onRefresh();
			resetForm();
			setStatusMessage(
				"Elle İçe Aktarma Kanıtı kaydedildi; dosya Aday Sürüm olarak oluşturuldu."
			);
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				setWriteOutcomeUncertain(true);
				setErrorMessage(
					"Kayıt sonucu doğrulanamadı. Güncel durumu kontrol edin veya aynı bilgilerle yeniden deneyin."
				);
			} else {
				setErrorMessage(
					getErrorMessage(error, "Elle İçe Aktarma Kanıtı kaydedilemedi.")
				);
			}
		} finally {
			setIsSaving(false);
		}
	}

	async function checkWriteOutcome() {
		if (!request.current) {
			setWriteOutcomeUncertain(false);
			return;
		}
		setIsSaving(true);
		try {
			const result = await onRefresh();
			if (refreshedHasEvidence(result, request.current.id)) {
				if (form.state.values.isProviderResult) {
					setProviderRecordVersionId(request.current.id);
				}
				resetForm();
				setErrorMessage(null);
				setStatusMessage(
					"Elle İçe Aktarma Kanıtı kaydedildi; dosya Aday Sürüm olarak oluşturuldu."
				);
				return;
			}
			setWriteOutcomeUncertain(false);
			setErrorMessage(
				"Kayıt henüz görünmüyor. Aynı bilgilerle yeniden deneyebilirsiniz."
			);
		} catch (error) {
			setErrorMessage(getErrorMessage(error, "Güncel durum okunamadı."));
		} finally {
			setIsSaving(false);
		}
	}

	async function saveProviderGenerationRecord(
		input: ProviderGenerationRecordFields
	) {
		if (!providerRecordVersionId) {
			return false;
		}
		setIsSaving(true);
		setErrorMessage(null);
		setStatusMessage(null);
		try {
			await recordProviderGeneration.mutateAsync({
				...input,
				assetVersionId: providerRecordVersionId,
				projectId: record.projectId,
			});
			await onRefresh();
			setProviderRecordVersionId(null);
			setStatusMessage(
				"Sağlayıcı Üretim Kaydı kullanıcı bildirimi olarak kaydedildi."
			);
			return true;
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "Sağlayıcı Üretim Kaydı kaydedilemedi.")
			);
			return false;
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<section
			aria-labelledby="manual-import-evidence-heading"
			className="rounded-lg border p-4"
		>
			<h3 className="font-medium" id="manual-import-evidence-heading">
				Elle İçe Aktarma Kanıtı
			</h3>
			<p className="mt-1 text-muted-foreground text-sm">
				Manuel sonucu Üretim Paketi, kullandığınız yüzey, gerçek talimat ve
				sonuç dosyasıyla birlikte kaydedin. Tam konuşma arşivi gerekmez.
			</p>
			{errorMessage ? (
				<p className="mt-3 text-sm" role="alert">
					{errorMessage}
				</p>
			) : null}
			{statusMessage ? (
				<p aria-live="polite" className="mt-3 text-sm" role="status">
					{statusMessage}
				</p>
			) : null}
			{writeOutcomeUncertain ? (
				<Button
					className="mt-3"
					disabled={isSaving}
					onClick={() => void checkWriteOutcome()}
					type="button"
					variant="outline"
				>
					{isSaving ? "Durum kontrol ediliyor…" : "Durumu kontrol et"}
				</Button>
			) : null}

			<ManualImportPackageForm
				fileInputRef={fileInputRef}
				form={form}
				isError={packagesQuery.isError}
				isLoading={packagesQuery.isPending}
				isSaving={isSaving}
				onRetry={() => void packagesQuery.refetch()}
				packages={packages}
				selectedPackageExists={selectedPackageExists}
				writeOutcomeUncertain={writeOutcomeUncertain}
			/>
			{providerRecordVersionId ? (
				<ProviderGenerationRecordForm
					onSave={saveProviderGenerationRecord}
					writesDisabled={isSaving || writeOutcomeUncertain}
				/>
			) : null}
		</section>
	);
}
