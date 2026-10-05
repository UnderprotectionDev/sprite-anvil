import type { AssetRecordTracking } from "@sprite-anvil/api/asset-record-tracking";
import type {
	AssetRecord,
	AssetRecordCreateInput,
} from "@sprite-anvil/api/asset-records";
import { Button, buttonVariants } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactNode, type SyntheticEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { AssetRecordSearchPanel } from "@/features/asset-discovery/ui/components/asset-record-search-panel";
import { AnimationMetadataPackagePanel } from "@/features/character-animation-profile/ui/components/animation-metadata-package-panel";
import { GameplayMetadataPanel } from "@/features/gameplay-metadata/ui/views/gameplay-metadata-panel";
import { GenerationPackagePanel } from "@/features/generation-packages/ui/views/generation-package-panel";
import { RightsLineagePanel } from "@/features/rights-evidence/ui/components/rights-lineage-panel";
import { RightsRecordPanel } from "@/features/rights-evidence/ui/components/rights-record-panel";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";
import {
	AssetRecordAvailabilityControl,
	getAvailabilityLabel,
} from "../components/asset-record-availability-control";
import { AssetRecordTrackingPanel } from "../components/asset-record-tracking-panel";
import { AssetRecordMeasurementsForm } from "../forms/asset-record-measurements-form";
import { AssetRecordMetadataForm } from "../forms/asset-record-metadata-form";
import { ManualImportEvidenceForm } from "../forms/manual-import-evidence-form";

const identityOptions = [
	{
		value: "independent_product_meaning",
		label: "Bağımsız ürün anlamı",
		description:
			"Oyunda kendi kimliği ve amacı olan karakter, nesne veya görsel.",
	},
	{
		value: "independent_lifecycle",
		label: "Bağımsız yaşam döngüsü",
		description: "Kendi kararlarıyla ayrı değişen veya gelişen varlık.",
	},
	{
		value: "delivery_identity",
		label: "Teslimat kimliği",
		description: "Oyuna ayrı bir varlık olarak teslim edilen içerik.",
	},
] as const;
type IdentityCriterion = (typeof identityOptions)[number]["value"];

function getIdentityLabel(value: string) {
	return (
		identityOptions.find((option) => option.value === value)?.label ?? value
	);
}

function getIdentitySummary(identityCriteria: readonly string[]) {
	return identityCriteria.length > 0
		? identityCriteria.map(getIdentityLabel).join(" · ")
		: "Gerekçe kaydedilmemiş";
}

export function AssetRecordsView({
	onOpenRecord,
	projectId,
}: {
	onOpenRecord: (assetRecordId: string, versionId?: string) => void;
	projectId: string;
}) {
	const projectQueryOptions = orpc.projects.get.queryOptions({
		input: { projectId },
	});
	const projectQuery = useQuery({
		...projectQueryOptions,
	});
	const recordsQueryOptions = orpc.assetRecords.list.queryOptions({
		input: { projectId },
	});
	const recordsQuery = useQuery({
		...recordsQueryOptions,
	});
	const pendingCreate = useRef<AssetRecordCreateInput | null>(null);
	const [name, setName] = useState("");
	const [identityCriteria, setIdentityCriteria] = useState<IdentityCriterion[]>(
		[]
	);
	const [isSaving, setIsSaving] = useState(false);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingWriteOutcome, setIsCheckingWriteOutcome] = useState(false);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	function updateName(value: string) {
		setName(value);
		pendingCreate.current = null;
	}

	function toggleIdentityCriterion(value: IdentityCriterion, checked: boolean) {
		setIdentityCriteria((current) =>
			checked
				? [...new Set([...current, value])]
				: current.filter((criterion) => criterion !== value)
		);
		pendingCreate.current = null;
	}

	async function checkWriteOutcome() {
		setIsCheckingWriteOutcome(true);
		try {
			const result = await recordsQuery.refetch();
			if (result.isError) {
				return;
			}

			const expectedId = pendingCreate.current?.id;
			const existingRecord = result.data?.find(
				(record) => record.id === expectedId
			);
			if (existingRecord) {
				setWriteOutcomeUncertain(false);
				setStatusMessage("Varlık kaydı bulundu.");
				pendingCreate.current = null;
				onOpenRecord(existingRecord.id);
				return;
			}

			setWriteOutcomeUncertain(false);
			setStatusMessage(
				"Kayıt listesi yenilendi. Aynı kimlikle yeniden deneyebilirsiniz."
			);
		} finally {
			setIsCheckingWriteOutcome(false);
		}
	}

	async function handleCreateRecord(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (writeOutcomeUncertain || isSaving || identityCriteria.length === 0) {
			return;
		}

		const trimmedName = name.trim();
		if (!trimmedName) {
			return;
		}

		const input =
			pendingCreate.current ??
			({
				id: crypto.randomUUID(),
				identityCriteria,
				name: trimmedName,
				projectId,
			} satisfies AssetRecordCreateInput);
		pendingCreate.current = input;
		setStatusMessage(null);
		setIsSaving(true);
		try {
			const record = await client.assetRecords.create(input);
			pendingCreate.current = null;
			void recordsQuery.refetch();
			onOpenRecord(record.id);
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				setWriteOutcomeUncertain(true);
			} else {
				pendingCreate.current = null;
			}
			toast.error(
				getErrorMessage(
					error,
					"Varlık kaydının sonucu doğrulanamadı. Mevcut durumu kontrol edin."
				)
			);
		} finally {
			setIsSaving(false);
		}
	}

	const records = recordsQuery.data ?? [];
	let projectState: ReactNode = null;
	if (projectQuery.isPending) {
		projectState = <p aria-live="polite">Proje yükleniyor…</p>;
	} else if (projectQuery.isError) {
		projectState = null;
	}

	let recordsState: ReactNode = null;
	if (recordsQuery.isPending) {
		recordsState = <p aria-live="polite">Varlık kayıtları yükleniyor…</p>;
	} else if (recordsQuery.isError) {
		recordsState = null;
	} else if (records.length === 0) {
		recordsState = (
			<p className="rounded-lg border border-dashed p-5 text-muted-foreground">
				Bu projede henüz varlık kaydı yok.
			</p>
		);
	} else {
		recordsState = (
			<ul className="space-y-3">
				{records.map((record) => (
					<li
						className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
						key={record.id}
					>
						<div>
							<h3 className="font-medium">{record.name}</h3>
							<p className="text-muted-foreground text-sm">
								{getIdentitySummary(record.identityCriteria)}
							</p>
							<p className="text-muted-foreground text-sm">
								Kayıt durumu · {getAvailabilityLabel(record.availability)}
							</p>
						</div>
						<Button
							aria-label={`${record.name} kaydını aç`}
							onClick={() => onOpenRecord(record.id)}
							variant="outline"
						>
							Kaydı aç
						</Button>
					</li>
				))}
			</ul>
		);
	}

	return (
		<main className="mx-auto w-full max-w-3xl space-y-8 overflow-y-auto px-4 py-8">
			<header className="space-y-3">
				<Link
					className="inline-flex min-h-11 items-center text-muted-foreground text-sm underline underline-offset-4"
					to="/projects"
				>
					Oyun projelerine dön
				</Link>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-2">
						<p className="font-mono text-primary text-xs uppercase tracking-[0.16em]">
							Varlık kayıtları
						</p>
						<h1 className="font-medium font-serif text-4xl tracking-tight">
							{projectQuery.data?.name ?? "Oyun projesi"}
						</h1>
					</div>
					<Link
						className={`${buttonVariants({ variant: "outline" })} min-h-11`}
						params={{ projectId }}
						to="/projects/$projectId/import-inbox"
					>
						İçe Aktarma Gelen Kutusu
					</Link>
				</div>
				<p className="max-w-2xl text-muted-foreground">
					Bağımsız ürün anlamı, yaşam döngüsü veya teslimat kimliği olan
					görselleri aynı Varlık Kaydı altında izleyin.
				</p>
			</header>

			{projectState}

			<section
				aria-labelledby="create-asset-record-heading"
				className="space-y-4 rounded-lg border p-5"
			>
				<div>
					<h2
						className="font-semibold text-xl"
						id="create-asset-record-heading"
					>
						Yeni varlık kaydı
					</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						Farklı bir dosya veya düzenlenebilir kare olması tek başına yeni
						kayıt gerekçesi değildir.
					</p>
				</div>
				<form className="space-y-4" onSubmit={handleCreateRecord}>
					<div className="space-y-2">
						<label className="font-medium text-sm" htmlFor="asset-record-name">
							Varlık adı
						</label>
						<Input
							disabled={writeOutcomeUncertain || isSaving}
							id="asset-record-name"
							maxLength={120}
							onChange={(event) => updateName(event.target.value)}
							required
							value={name}
						/>
					</div>
					<fieldset
						aria-describedby="asset-record-identity-help"
						className="space-y-3"
						disabled={writeOutcomeUncertain || isSaving}
					>
						<legend className="mb-2 font-medium text-sm">
							Bu kaydın bağımsız kimliği
						</legend>
						{identityOptions.map((option) => (
							<label
								className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-checked:border-primary"
								key={option.value}
							>
								<input
									checked={identityCriteria.includes(option.value)}
									className="mt-0.5 size-4 accent-primary"
									onChange={(event) =>
										toggleIdentityCriterion(option.value, event.target.checked)
									}
									type="checkbox"
								/>
								<span>
									<span className="block font-medium text-sm">
										{option.label}
									</span>
									<span className="block text-muted-foreground text-sm">
										{option.description}
									</span>
								</span>
							</label>
						))}
						<p
							className="text-muted-foreground text-sm"
							id="asset-record-identity-help"
						>
							En az bir kimlik nedeni seçin. Ayrı düzenlenebilmek tek başına
							yeterli değildir.
						</p>
					</fieldset>
					{writeOutcomeUncertain ? (
						<Button
							disabled={isCheckingWriteOutcome}
							onClick={() => void checkWriteOutcome()}
							type="button"
							variant="outline"
						>
							{isCheckingWriteOutcome
								? "Durum kontrol ediliyor…"
								: "Durumu kontrol et"}
						</Button>
					) : null}
					{statusMessage ? (
						<p aria-live="polite" role="status">
							{statusMessage}
						</p>
					) : null}
					<Button
						disabled={
							isSaving ||
							writeOutcomeUncertain ||
							name.trim().length === 0 ||
							identityCriteria.length === 0
						}
						type="submit"
					>
						{isSaving ? "Kaydediliyor…" : "Varlık kaydı oluştur"}
					</Button>
				</form>
			</section>

			<section aria-labelledby="asset-records-heading" className="space-y-4">
				<div>
					<h2 className="font-semibold text-xl" id="asset-records-heading">
						Varlık kayıtları
					</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						Kayıt kimliği; dosyalardan, sürümlerden ve ayrı değiştirilebilir
						birimlerden bağımsızdır.
					</p>
				</div>
				{recordsState}
			</section>
			<AssetRecordSearchPanel
				onOpenRecord={onOpenRecord}
				projectId={projectId}
			/>
		</main>
	);
}

export function AssetRecordDetailView({
	assetRecordId,
	focusVersionId,
	projectId,
}: {
	assetRecordId: string;
	focusVersionId?: string;
	projectId: string;
}) {
	const projectQuery = useQuery({
		...orpc.projects.get.queryOptions({ input: { projectId } }),
	});
	const recordQuery = useQuery({
		...orpc.assetRecords.get.queryOptions({
			input: { assetRecordId, projectId },
		}),
	});
	const trackingQueryOptions = orpc.assetRecords.tracking.queryOptions({
		input: { assetRecordId, projectId },
	});
	const trackingQuery = useQuery({
		...trackingQueryOptions,
		enabled: Boolean(recordQuery.data),
	});
	const record = recordQuery.data;
	let recordHeading: ReactNode;
	let trackingPanel: ReactNode = null;
	if (recordQuery.isPending) {
		recordHeading = (
			<h1 className="font-medium font-serif text-4xl tracking-tight">
				Varlık kaydı yükleniyor…
			</h1>
		);
	} else if (recordQuery.isError) {
		recordHeading = (
			<h1 className="font-medium font-serif text-4xl tracking-tight">
				Varlık kaydı açılamadı
			</h1>
		);
	} else if (record) {
		recordHeading = (
			<>
				<h1 className="font-medium font-serif text-4xl tracking-tight">
					{record.name}
				</h1>
				<p className="text-muted-foreground">
					{getIdentitySummary(record.identityCriteria)}
				</p>
			</>
		);
	} else {
		recordHeading = null;
	}
	if (trackingQuery.data) {
		trackingPanel = (
			<AssetRecordTrackingPanel
				detail={trackingQuery.data}
				focusVersionId={focusVersionId}
				onRefresh={() => trackingQuery.refetch()}
			/>
		);
	}
	return (
		<main className="mx-auto w-full max-w-3xl space-y-8 overflow-y-auto px-4 py-8">
			<header className="space-y-2">
				<p className="font-mono text-primary text-xs uppercase tracking-[0.16em]">
					Varlık kütüphanesi / {projectQuery.data?.name ?? "Oyun projesi"}
				</p>
				{recordHeading}
			</header>

			{record ? (
				<>
					<AssetRecordAvailabilityControl
						onRefresh={() => recordQuery.refetch()}
						record={record}
					/>
					{record.availability === "erased" ? null : (
						<AssetRecordMetadataForm
							familyWorldId={
								trackingQuery.data?.tracking.family?.visualWorldId ?? null
							}
							projectId={projectId}
							record={record}
						/>
					)}
					{record.availability === "erased" ? (
						<section className="rounded-lg border p-5">
							<h2 className="font-semibold text-xl">Görsel ölçüleri</h2>
							<p className="mt-2 text-muted-foreground text-sm">
								Silinmiş kaydın ölçüleri görüntülenemez veya değiştirilemez.
							</p>
						</section>
					) : (
						<AssetRecordMeasurementsForm
							onRefresh={() => recordQuery.refetch()}
							record={record}
						/>
					)}
					{trackingPanel}
					{record.availability === "erased" ? null : (
						<GameplayMetadataPanel
							assetRecordId={record.id}
							projectId={projectId}
						/>
					)}
					<AnimationMetadataPackagePanel
						projectId={projectId}
						record={record}
					/>
					{record.availability === "erased" ? null : (
						<RightsRecordPanel
							assetRecordId={record.id}
							key={`rights-record-${record.id}`}
							projectId={projectId}
						/>
					)}
					<AssetRecordLineageSection
						isTrackingError={trackingQuery.isError}
						key={`rights-lineage-${record.id}`}
						onRetryTracking={() => {
							void trackingQuery.refetch();
						}}
						projectId={projectId}
						record={record}
						tracking={trackingQuery.data?.tracking}
					/>
					{record.availability === "erased" ? null : (
						<GenerationPackagePanel
							key={`generation-package-${record.id}`}
							projectId={projectId}
							record={record}
						/>
					)}
					{record.availability === "active" ? (
						<ManualImportEvidenceForm
							key={`manual-import-evidence-${record.id}`}
							onRefresh={() => trackingQuery.refetch()}
							record={record}
						/>
					) : null}
				</>
			) : null}
		</main>
	);
}

function getTrackingStatus(
	isError: boolean,
	hasTracking: boolean
): "error" | "loading" | "success" {
	if (isError) {
		return "error";
	}
	if (hasTracking) {
		return "success";
	}
	return "loading";
}

function AssetRecordLineageSection({
	isTrackingError,
	onRetryTracking,
	projectId,
	record,
	tracking,
}: {
	isTrackingError: boolean;
	onRetryTracking: () => void;
	projectId: string;
	record: AssetRecord;
	tracking?: AssetRecordTracking;
}) {
	if (record.availability === "erased") {
		return null;
	}

	return (
		<RightsLineagePanel
			onRetryTracking={onRetryTracking}
			projectId={projectId}
			record={record}
			tracking={tracking}
			trackingStatus={getTrackingStatus(isTrackingError, Boolean(tracking))}
		/>
	);
}
