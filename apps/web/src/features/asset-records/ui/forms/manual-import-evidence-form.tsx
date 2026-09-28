import type { ManualImportVersionCreateInput } from "@sprite-anvil/api/asset-record-tracking";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { GenerationPackage } from "@sprite-anvil/api/generation-packages";
import type { ProviderGenerationRecordCreateInput } from "@sprite-anvil/api/provider-generation-records";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { useQuery } from "@tanstack/react-query";
import { type RefObject, type SyntheticEvent, useRef, useState } from "react";
import { ProviderGenerationRecordForm } from "@/features/asset-versions/ui/components/provider-generation-record-form";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";

const maxAssetVersionBytes = 5 * 1024 * 1024;
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

interface ManualImportPackageFormProps {
	file: File | null;
	fileInputRef: RefObject<HTMLInputElement | null>;
	fileIsSupported: boolean;
	generationInstruction: string;
	generationPackageId: string;
	isError: boolean;
	isLoading: boolean;
	isProviderResult: boolean;
	isSaving: boolean;
	onFileChange: (file: File | null) => void;
	onGenerationInstructionChange: (value: string) => void;
	onGenerationPackageChange: (value: string) => void;
	onProviderResultChange: (value: boolean) => void;
	onRetry: () => void;
	onSourceSurfaceChange: (value: string) => void;
	onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
	packages: GenerationPackage[];
	selectedPackageExists: boolean;
	sourceSurface: string;
	writeOutcomeUncertain: boolean;
}

function ManualImportPackageForm({
	file,
	fileInputRef,
	fileIsSupported,
	generationInstruction,
	generationPackageId,
	isProviderResult,
	isError,
	isLoading,
	isSaving,
	onFileChange,
	onGenerationInstructionChange,
	onGenerationPackageChange,
	onProviderResultChange,
	onRetry,
	onSourceSurfaceChange,
	onSubmit,
	packages,
	selectedPackageExists,
	sourceSurface,
	writeOutcomeUncertain,
}: ManualImportPackageFormProps) {
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
		<form className="mt-4 space-y-3" onSubmit={onSubmit}>
			<label className="flex items-start gap-2 text-sm">
				<input
					checked={isProviderResult}
					disabled={isSaving || writeOutcomeUncertain}
					onChange={(event) =>
						onProviderResultChange(event.currentTarget.checked)
					}
					type="checkbox"
				/>
				<span>Başka bir sağlayıcının arayüzünden alındı</span>
			</label>
			{isProviderResult ? (
				<p className="text-muted-foreground text-sm">
					Dosya ve Elle İçe Aktarma Kanıtı kaydedildikten sonra, sağlayıcı
					ekranında gördüğünüz ayrıntıları kullanıcı bildirimi olarak
					girebilirsiniz.
				</p>
			) : null}
			<div className="space-y-2 rounded-md border border-dashed p-3">
				<label className="block space-y-1 text-sm" htmlFor="manual-import-file">
					<span>Sonuç dosyası</span>
					<Input
						accept="image/png,image/webp"
						disabled={isSaving || writeOutcomeUncertain}
						id="manual-import-file"
						onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
						ref={fileInputRef}
						type="file"
					/>
				</label>
				<button
					aria-label="Sonuç dosyasını seçin, yapıştırın veya bırakın"
					className="w-full rounded-sm p-2 text-left text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					disabled={isSaving || writeOutcomeUncertain}
					onClick={() => fileInputRef.current?.click()}
					onDragOver={(event) => event.preventDefault()}
					onDrop={(event) => {
						event.preventDefault();
						const droppedFile = getTransferredFile(event.dataTransfer);
						if (droppedFile) {
							onFileChange(droppedFile);
						}
					}}
					onPaste={(event) => {
						const pastedFile = getTransferredFile(event.clipboardData);
						if (pastedFile) {
							event.preventDefault();
							onFileChange(pastedFile);
						}
					}}
					type="button"
				>
					PNG veya WebP dosyasını buraya sürükleyin ya da yapıştırın; dosya
					seçmek için tıklayın.
				</button>
				{file ? (
					<p className="text-sm" role="status">
						Seçilen dosya: {file.name}
					</p>
				) : null}
			</div>
			{file && !fileIsSupported ? (
				<p className="text-sm" role="alert">
					5 MB’a kadar PNG veya WebP dosyası seçin.
				</p>
			) : null}
			<label
				className="block space-y-1 text-sm"
				htmlFor="manual-import-generation-package"
			>
				<span>Üretim Paketi</span>
				<select
					className="w-full rounded-md border bg-background px-3 py-2"
					disabled={isSaving || writeOutcomeUncertain}
					id="manual-import-generation-package"
					onChange={(event) => onGenerationPackageChange(event.target.value)}
					required
					value={generationPackageId}
				>
					<option value="">Paket seçin</option>
					{packages.map((generationPackage) => (
						<option key={generationPackage.id} value={generationPackage.id}>
							{generationPackage.targetTask} ·{" "}
							{getPackageDateLabel(generationPackage.createdAt)} ·{" "}
							{generationPackage.id.slice(0, 8)}
						</option>
					))}
				</select>
			</label>
			<label
				className="block space-y-1 text-sm"
				htmlFor="manual-import-surface"
			>
				<span>Üretim yüzeyi</span>
				<Input
					autoComplete="off"
					disabled={isSaving || writeOutcomeUncertain}
					id="manual-import-surface"
					maxLength={255}
					onChange={(event) => onSourceSurfaceChange(event.target.value)}
					required
					value={sourceSurface}
				/>
			</label>
			<label
				className="block space-y-1 text-sm"
				htmlFor="manual-import-generation-instruction"
			>
				<span>Gerçek üretim talimatı</span>
				<textarea
					className="min-h-28 w-full rounded-md border bg-background px-3 py-2"
					disabled={isSaving || writeOutcomeUncertain}
					id="manual-import-generation-instruction"
					maxLength={100_000}
					onChange={(event) =>
						onGenerationInstructionChange(event.target.value)
					}
					required
					value={generationInstruction}
				/>
			</label>
			<Button
				disabled={
					isSaving ||
					writeOutcomeUncertain ||
					!file ||
					!fileIsSupported ||
					!selectedPackageExists ||
					sourceSurface.trim().length === 0 ||
					generationInstruction.trim().length === 0
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
	const [file, setFile] = useState<File | null>(null);
	const [generationPackageId, setGenerationPackageId] = useState("");
	const [sourceSurface, setSourceSurface] = useState("");
	const [generationInstruction, setGenerationInstruction] = useState("");
	const [isProviderResult, setIsProviderResult] = useState(false);
	const [providerRecordVersionId, setProviderRecordVersionId] = useState<
		string | null
	>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	const packages = packagesQuery.data ?? [];
	const selectedPackageExists = packages.some(
		(generationPackage) => generationPackage.id === generationPackageId
	);
	const fileIsSupported = Boolean(
		file &&
			file.size > 0 &&
			file.size <= maxAssetVersionBytes &&
			["image/png", "image/webp"].includes(file.type)
	);

	function resetForm() {
		request.current = null;
		setWriteOutcomeUncertain(false);
		setFile(null);
		setGenerationPackageId("");
		setSourceSurface("");
		setGenerationInstruction("");
		setIsProviderResult(false);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}

	async function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!(file && selectedPackageExists && fileIsSupported)) {
			return;
		}

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
			generationPackageId,
			productionSource: isProviderResult ? "user_reported_provider" : "unknown",
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
			generationPackageId,
			id: request.current.id,
			projectId: record.projectId,
			...(isProviderResult
				? { productionSource: "user_reported_provider" as const }
				: {}),
			sourceSurface,
		};

		setIsSaving(true);
		try {
			const version =
				await client.assetRecords.createManualImportVersion(input);
			if (isProviderResult) {
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
				if (isProviderResult) {
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
			await client.assetVersions.recordProviderGeneration({
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
				file={file}
				fileInputRef={fileInputRef}
				fileIsSupported={fileIsSupported}
				generationInstruction={generationInstruction}
				generationPackageId={generationPackageId}
				isError={packagesQuery.isError}
				isLoading={packagesQuery.isPending}
				isProviderResult={isProviderResult}
				isSaving={isSaving}
				onFileChange={setFile}
				onGenerationInstructionChange={setGenerationInstruction}
				onGenerationPackageChange={setGenerationPackageId}
				onProviderResultChange={setIsProviderResult}
				onRetry={() => void packagesQuery.refetch()}
				onSourceSurfaceChange={setSourceSurface}
				onSubmit={(event) => void submit(event)}
				packages={packages}
				selectedPackageExists={selectedPackageExists}
				sourceSurface={sourceSurface}
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
