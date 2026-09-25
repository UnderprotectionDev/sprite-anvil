import type { AssetRecordCreateInput } from "@sprite-anvil/api/asset-records";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, type SyntheticEvent, useRef, useState } from "react";
import {
	isWriteOutcomeUncertain,
	QueryRetryButton,
} from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";
import {
	AssetRecordAvailabilityControl,
	getAvailabilityLabel,
} from "../components/asset-record-availability-control";
import { AssetRecordTrackingPanel } from "../components/asset-record-tracking-panel";

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
	onOpenRecord: (assetRecordId: string) => void;
	projectId: string;
}) {
	const projectQueryOptions = orpc.projects.get.queryOptions({
		input: { projectId },
	});
	const projectQuery = useQuery({
		...projectQueryOptions,
		meta: { errorPresentation: "inline" },
	});
	const recordsQueryOptions = orpc.assetRecords.list.queryOptions({
		input: { projectId },
	});
	const recordsQuery = useQuery({
		...recordsQueryOptions,
		meta: { errorPresentation: "inline" },
	});
	const pendingCreate = useRef<AssetRecordCreateInput | null>(null);
	const [name, setName] = useState("");
	const [identityCriteria, setIdentityCriteria] = useState<IdentityCriterion[]>(
		[]
	);
	const [isSaving, setIsSaving] = useState(false);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingWriteOutcome, setIsCheckingWriteOutcome] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
				setErrorMessage(
					"Kayıt işleminin durumu doğrulanamadı. Kayıt listesini yeniden deneyin."
				);
				return;
			}

			const expectedId = pendingCreate.current?.id;
			const existingRecord = result.data?.find(
				(record) => record.id === expectedId
			);
			if (existingRecord) {
				setWriteOutcomeUncertain(false);
				setErrorMessage(null);
				setStatusMessage("Varlık kaydı bulundu.");
				pendingCreate.current = null;
				onOpenRecord(existingRecord.id);
				return;
			}

			setWriteOutcomeUncertain(false);
			setErrorMessage(null);
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
		setErrorMessage(null);
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
			setErrorMessage(
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
		projectState = (
			<div className="space-y-2">
				<p role="alert">
					{getErrorMessage(projectQuery.error, "Proje yüklenemedi.", "query")}
				</p>
				<QueryRetryButton
					disabled={projectQuery.isFetching}
					onRetry={() => void projectQuery.refetch()}
				/>
			</div>
		);
	}

	let recordsState: ReactNode = null;
	if (recordsQuery.isPending) {
		recordsState = <p aria-live="polite">Varlık kayıtları yükleniyor…</p>;
	} else if (recordsQuery.isError) {
		recordsState = (
			<div className="space-y-2">
				<p role="alert">
					{getErrorMessage(
						recordsQuery.error,
						"Varlık kayıtları yüklenemedi.",
						"query"
					)}
				</p>
				<QueryRetryButton
					disabled={recordsQuery.isFetching}
					onRetry={() => void recordsQuery.refetch()}
				/>
			</div>
		);
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
			<header className="space-y-2">
				<p className="text-muted-foreground text-sm">Varlık çalışma alanı</p>
				<h1 className="font-bold text-3xl">
					{projectQuery.data?.name ?? "Oyun projesi"}
				</h1>
				<p className="text-muted-foreground">
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
					{errorMessage ? <p role="alert">{errorMessage}</p> : null}
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
		</main>
	);
}

export function AssetRecordDetailView({
	assetRecordId,
	projectId,
}: {
	assetRecordId: string;
	projectId: string;
}) {
	const projectQuery = useQuery({
		...orpc.projects.get.queryOptions({ input: { projectId } }),
		meta: { errorPresentation: "inline" },
	});
	const trackingQueryOptions = orpc.assetRecords.tracking.queryOptions({
		input: { assetRecordId, projectId },
	});
	const trackingQuery = useQuery({
		...trackingQueryOptions,
		meta: { errorPresentation: "inline" },
	});
	const record = trackingQuery.data?.record;
	let recordHeading: ReactNode;
	if (trackingQuery.isPending) {
		recordHeading = (
			<h1 className="font-bold text-3xl">Varlık kaydı yükleniyor…</h1>
		);
	} else if (trackingQuery.isError) {
		recordHeading = (
			<div>
				<h1 className="font-bold text-3xl">Varlık kaydı açılamadı</h1>
				<p role="alert">
					{getErrorMessage(
						trackingQuery.error,
						"Varlık kaydı yüklenemedi.",
						"query"
					)}
				</p>
				<QueryRetryButton
					disabled={trackingQuery.isFetching}
					onRetry={() => void trackingQuery.refetch()}
				/>
			</div>
		);
	} else if (record) {
		recordHeading = (
			<>
				<h1 className="font-bold text-3xl">{record.name}</h1>
				<p className="text-muted-foreground">
					{getIdentitySummary(record.identityCriteria)}
				</p>
			</>
		);
	} else {
		recordHeading = null;
	}

	return (
		<main className="mx-auto w-full max-w-3xl space-y-8 overflow-y-auto px-4 py-8">
			<header className="space-y-2">
				<p className="text-muted-foreground text-sm">
					{projectQuery.data?.name ?? "Oyun projesi"} · Varlık kaydı
				</p>
				{recordHeading}
			</header>

			{record ? (
				<>
					<AssetRecordAvailabilityControl
						onRefresh={() => trackingQuery.refetch()}
						record={record}
					/>
					{trackingQuery.data ? (
						<AssetRecordTrackingPanel
							detail={trackingQuery.data}
							onRefresh={() => trackingQuery.refetch()}
						/>
					) : null}
				</>
			) : null}
		</main>
	);
}
