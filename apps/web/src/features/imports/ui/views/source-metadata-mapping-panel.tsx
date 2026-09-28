import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type { ImportInboxEntry } from "@sprite-anvil/api/import-inbox";
import {
	type SourceMetadataMappingProposal,
	sourceMetadataMappingContractVersion,
	sourceMetadataMappingFinalizationSchema,
	sourceMetadataMappingProposalSchema,
	sourceMetadataMappingProposalsSchema,
	sourceMetadataMappingSidecarLimits,
} from "@sprite-anvil/api/source-metadata-mapping";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type Dispatch, type SetStateAction, useState } from "react";
import { orpc } from "@/utils/orpc";
import {
	readSupportReference,
	sourceMetadataMappingFinalizationUrl,
	sourceMetadataMappingUrl,
} from "./import-inbox-api";

function errorName(value: unknown) {
	if (typeof value !== "object" || value === null) {
		return;
	}
	const name = (value as { error?: unknown }).error;
	return typeof name === "string" ? name : undefined;
}

class SourceMetadataMappingRequestError extends Error {
	readonly supportReference?: string;

	constructor(message: string, reference?: string) {
		super(message);
		this.supportReference = reference;
	}
}

async function readProposals(projectId: string, entryId: string) {
	const response = await fetch(sourceMetadataMappingUrl(projectId, entryId), {
		credentials: "include",
	});
	if (!response.ok) {
		const body: unknown = await response.json().catch(() => null);
		throw new SourceMetadataMappingRequestError(
			"Kaynak Metadata Eşleme Önerileri okunamadı.",
			readSupportReference(body)
		);
	}
	return sourceMetadataMappingProposalsSchema.parse(await response.json());
}

function createErrorMessage(status: number, body: unknown) {
	if (status === 401) {
		return "Oturumunuz sona ermiş. Yeniden giriş yapın.";
	}
	if (status === 404) {
		return "Kaynak veya sidecar girdisi Gelen Kutusunda bulunamadı.";
	}
	if (status === 422) {
		return errorName(body) === "Unsupported source metadata format"
			? "Seçilen dosyalarda desteklenen Aseprite veya TexturePacker JSON bulunamadı."
			: "Seçilen JSON sidecar geçerli bir eşleme önerisi içermiyor.";
	}
	if (status === 400) {
		return "Sidecar seçimini kontrol edip yeniden deneyin.";
	}
	if (status === 413) {
		return errorName(body) ===
			"Source metadata sidecars exceed the maximum size"
			? "Sidecar dosyaları dosya başına 5 MiB ve toplam 8 MiB sınırını aşıyor."
			: "Öneri isteği 8 KiB boyut sınırını aşıyor.";
	}
	return "Öneri oluşturma sonucu doğrulanamadı. Kayıtlı önerileri kontrol edin.";
}

function formatFieldValue(value: unknown) {
	return JSON.stringify(value, null, 2) ?? "Bilinmiyor";
}

function fieldLabel(
	field: SourceMetadataMappingProposal["fields"][number]["field"]
) {
	const labels = {
		frame: "Kare",
		duration: "Süre",
		tag: "Tag",
		slice: "Slice",
		pivot: "Pivot",
		"nine-slice": "9-slice",
		palette: "Palet",
	};
	return labels[field];
}

function proposalConflictKeys(proposal: SourceMetadataMappingProposal) {
	return new Set(
		proposal.conflicts.map(
			(conflict) => `${conflict.field}\u0000${conflict.key}`
		)
	);
}

function stableValue(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(stableValue).join(",")}]`;
	}
	if (value !== null && typeof value === "object") {
		const record = value as Record<string, unknown>;
		return `{${Object.keys(record)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableValue(record[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

function proposalFieldValues(proposal: SourceMetadataMappingProposal) {
	const grouped = new Map<string, string[]>();
	for (const field of proposal.fields) {
		const key = `${field.field}\u0000${field.key}`;
		grouped.set(key, [...(grouped.get(key) ?? []), stableValue(field.value)]);
	}
	return new Map(
		[...grouped].map(([key, values]) => [
			key,
			[...new Set(values)].sort().join("\u0000"),
		])
	);
}

function proposalFieldChanges(
	current: SourceMetadataMappingProposal,
	previous: SourceMetadataMappingProposal
) {
	const before = proposalFieldValues(previous);
	const after = proposalFieldValues(current);
	return [...new Set([...before.keys(), ...after.keys()])]
		.sort()
		.flatMap((key) => {
			if (before.get(key) === after.get(key)) {
				return [];
			}
			const [field, name] = key.split("\u0000");
			const label = `${fieldLabel(field as SourceMetadataMappingProposal["fields"][number]["field"])} · ${name}`;
			let change = "Değişti";
			if (!before.has(key)) {
				change = "Eklendi";
			} else if (!after.has(key)) {
				change = "Kaldırıldı";
			}
			return [`${change}: ${label}`];
		});
}

function ProposalFinalizationForm({
	proposal,
	projectId,
	records,
	recordsError,
	assetRecordId,
	setAssetRecordId,
	decisions,
	setDecisions,
	isFinalizing,
	finalizeError,
	onFinalize,
}: {
	proposal: SourceMetadataMappingProposal;
	projectId: string;
	records: AssetFamilyCatalog["assetRecords"] | undefined;
	recordsError: boolean;
	assetRecordId: string;
	setAssetRecordId: Dispatch<SetStateAction<string>>;
	decisions: Record<string, string>;
	setDecisions: Dispatch<SetStateAction<Record<string, string>>>;
	isFinalizing: boolean;
	finalizeError: string | null;
	onFinalize: () => void;
}) {
	return (
		<section
			aria-label="Eşlemeyi kesinleştir"
			className="space-y-3 rounded-md border p-3"
		>
			<label className="block">
				Hedef Varlık Kaydı
				<select
					className="mt-1 w-full rounded-md border bg-background p-2"
					onChange={(event) => setAssetRecordId(event.target.value)}
					value={assetRecordId}
				>
					<option value="">Kayıt seçin</option>
					{records?.map((record) => (
						<option key={record.id} value={record.id}>
							{record.name}
						</option>
					))}
				</select>
			</label>
			{records?.length === 0 ? (
				<p>
					Önce{" "}
					<Link params={{ projectId }} to="/projects/$projectId/asset-families">
						Varlık Aileleri
					</Link>{" "}
					ekranında hedef Varlık Kaydı oluşturun.
				</p>
			) : null}
			{recordsError ? (
				<p role="alert">Hedef Varlık Kayıtları okunamadı.</p>
			) : null}
			{proposal.conflicts.map((conflict) => {
				const key = `${conflict.field}\u0000${conflict.key}`;
				return (
					<label className="block" key={key}>
						{fieldLabel(conflict.field)} · {conflict.key}{" "}
						{conflict.field === "frame" ? "(zorunlu)" : "(isteğe bağlı)"}
						<select
							className="mt-1 w-full rounded-md border bg-background p-2"
							onChange={(event) =>
								setDecisions((current) => ({
									...current,
									[key]: event.target.value,
								}))
							}
							value={decisions[key] ?? ""}
						>
							<option value="">
								{conflict.field === "frame" ? "Kaynak seçin" : "Bilinmiyor"}
							</option>
							{conflict.candidates.map((candidate) => (
								<option
									key={`${candidate.sourceEntryId}-${candidate.sourcePath}`}
									value={JSON.stringify([
										candidate.sourceEntryId,
										candidate.sourcePath,
									])}
								>
									{candidate.sourceFileName} ·{" "}
									{formatFieldValue(candidate.value)}
								</option>
							))}
						</select>
					</label>
				);
			})}
			<Button
				disabled={
					!assetRecordId ||
					isFinalizing ||
					proposal.conflicts.some(
						(conflict) =>
							conflict.field === "frame" &&
							!decisions[`${conflict.field}\u0000${conflict.key}`]
					)
				}
				onClick={onFinalize}
				type="button"
			>
				{isFinalizing
					? "Kesinleştiriliyor…"
					: "Eşlemeyi kesinleştir ve Aday Sürüm oluştur"}
			</Button>
			{finalizeError ? <p role="alert">{finalizeError}</p> : null}
		</section>
	);
}

function ProposalDetails({
	proposal,
	projectId,
	entryId,
	previousProposal,
	onRecreate,
	isCreating,
}: {
	proposal: SourceMetadataMappingProposal;
	projectId: string;
	entryId: string;
	previousProposal?: SourceMetadataMappingProposal;
	onRecreate: () => void;
	isCreating: boolean;
}) {
	const conflictKeys = proposalConflictKeys(proposal);
	const queryClient = useQueryClient();
	const [isOpen, setIsOpen] = useState(false);
	const recordsQuery = useQuery({
		...orpc.assetFamilies.list.queryOptions({ input: { projectId } }),
		enabled: isOpen,
	});
	const [assetRecordId, setAssetRecordId] = useState("");
	const [decisions, setDecisions] = useState<Record<string, string>>({});
	const [isFinalizing, setIsFinalizing] = useState(false);
	const [finalizeError, setFinalizeError] = useState<string | null>(null);
	const finalizationUrl = sourceMetadataMappingFinalizationUrl(
		projectId,
		entryId,
		proposal.id
	);
	const finalizationQuery = useQuery({
		queryKey: ["source-metadata-mapping-finalization", proposal.id],
		enabled: isOpen,
		queryFn: async () => {
			const response = await fetch(finalizationUrl, { credentials: "include" });
			if (response.status === 404) {
				return null;
			}
			if (!response.ok) {
				throw new Error("Kesin ilişki okunamadı.");
			}
			return sourceMetadataMappingFinalizationSchema.parse(
				await response.json()
			);
		},
	});
	const finalization = finalizationQuery.data;
	const fieldChanges = previousProposal
		? proposalFieldChanges(proposal, previousProposal)
		: [];
	const sidecarsChanged = previousProposal
		? stableValue(
				proposal.sidecars
					.map(({ fileName, sha256 }) => ({ fileName, sha256 }))
					.sort((a, b) => a.fileName.localeCompare(b.fileName))
			) !==
			stableValue(
				previousProposal.sidecars
					.map(({ fileName, sha256 }) => ({ fileName, sha256 }))
					.sort((a, b) => a.fileName.localeCompare(b.fileName))
			)
		: false;
	async function finalize() {
		if (!assetRecordId || isFinalizing) {
			return;
		}
		setIsFinalizing(true);
		setFinalizeError(null);
		try {
			const response = await fetch(finalizationUrl, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					assetRecordId,
					decisions: proposal.conflicts.map((conflict) => {
						const selected = conflict.candidates.find(
							(candidate) =>
								JSON.stringify([
									candidate.sourceEntryId,
									candidate.sourcePath,
								]) === decisions[`${conflict.field}\u0000${conflict.key}`]
						);
						return {
							field: conflict.field,
							key: conflict.key,
							sourceEntryId: selected?.sourceEntryId ?? null,
							sourcePath: selected?.sourcePath ?? null,
						};
					}),
				}),
			});
			if (!response.ok) {
				if (response.status === 422) {
					setFinalizeError(
						"Zorunlu kare çakışmalarını çözün ve kaynak dosyayı kontrol edin."
					);
				} else if (response.status === 409) {
					setFinalizeError("Bu öneri başka bir kararla kesinleştirilmiş.");
				} else {
					setFinalizeError(
						"Eşleme kesinleştirilemedi. Kayıtlı sonucu kontrol edin."
					);
				}
				return;
			}
			sourceMetadataMappingFinalizationSchema.parse(await response.json());
			await queryClient.invalidateQueries({
				queryKey: ["source-metadata-mapping-finalization", proposal.id],
			});
		} catch {
			setFinalizeError(
				"Kesinleştirme sonucu doğrulanamadı. Kayıtlı sonucu kontrol edin."
			);
			await queryClient.invalidateQueries({
				queryKey: ["source-metadata-mapping-finalization", proposal.id],
			});
		} finally {
			setIsFinalizing(false);
		}
	}
	return (
		<details
			className="rounded-md border p-3 text-sm"
			onToggle={(event) => setIsOpen(event.currentTarget.open)}
		>
			<summary className="min-h-11 cursor-pointer py-2 font-medium">
				Kaynak Metadata Eşleme Önerisi ·{" "}
				{new Date(proposal.createdAt).toLocaleString("tr-TR")}
			</summary>
			<div className="space-y-4 pt-2">
				{previousProposal ? (
					<section
						aria-label="Önceki öneriye göre fark"
						className="rounded-md border p-3"
					>
						<h3 className="font-medium">Önceki öneriye göre fark</h3>
						{sidecarsChanged ? <p>JSON sidecar kaynakları değişti.</p> : null}
						{fieldChanges.length > 0 ? (
							<ul>
								{fieldChanges.map((change) => (
									<li key={change}>{change}</li>
								))}
							</ul>
						) : (
							<p>Tanınan alanlarda fark yok.</p>
						)}
					</section>
				) : null}
				<dl className="grid gap-x-3 gap-y-2 sm:grid-cols-[auto_1fr]">
					<dt className="text-muted-foreground">
						Kaynak Metadata Eşleme sözleşmesi
					</dt>
					<dd className="font-mono text-xs">{proposal.contractVersion}</dd>
					<dt className="text-muted-foreground">Kaynak SHA-256</dt>
					<dd className="break-all font-mono text-xs">
						{proposal.source.sha256}
					</dd>
					<dt className="text-muted-foreground">JSON sidecar kaynakları</dt>
					<dd>
						<ul className="space-y-2">
							{proposal.sidecars.map((sidecar) => (
								<li key={sidecar.entryId}>
									<p>
										{sidecar.fileName} · {sidecar.format} {sidecar.version} ·{" "}
										{sidecar.jsonLayout}
									</p>
									<p className="break-all font-mono text-xs">
										SHA-256: {sidecar.sha256}
									</p>
								</li>
							))}
						</ul>
					</dd>
				</dl>
				<section aria-label="Önerilen ilişkiler ve Oyun İçi Bilgiler">
					<h3 className="font-medium">
						Önerilen ilişkiler ve Oyun İçi Bilgiler
					</h3>
					<ul className="mt-2 space-y-2">
						<li>Varlık Ailesi bağlantısı: Bilinmiyor · kaynak kanıtı yok.</li>
						<li>
							Gerekli Öğeler Listesi bağlantısı: Bilinmiyor · kaynak kanıtı yok.
						</li>
					</ul>
					<p className="mt-2 text-muted-foreground">
						Oyun İçi Bilgiler: Bilinmiyor · proje bağlamı gerekli.
					</p>
				</section>
				{proposal.conflicts.length > 0 && !finalization ? (
					<p className="font-medium" role="status">
						{proposal.conflicts.length} alan çakışması var; öneri henüz
						kesinleşmedi.
					</p>
				) : null}
				{proposal.contractVersion ===
				sourceMetadataMappingContractVersion ? null : (
					<section className="space-y-2 rounded-md border p-3">
						<p>
							Bu öneri eski bir Kaynak Metadata Eşleme sözleşmesini kullanıyor.
							Kaynak dosyaları korunarak güncel sözleşmeyle yeni öneri
							oluşturun.
						</p>
						<Button disabled={isCreating} onClick={onRecreate} type="button">
							Güncel sözleşmeyle yeni öneri oluştur
						</Button>
					</section>
				)}
				{isOpen && finalizationQuery.isPending ? (
					<p role="status">Kesin ilişki okunuyor…</p>
				) : null}
				{finalizationQuery.isError ? (
					<div role="alert">
						Kesin ilişki okunamadı.{" "}
						<Button
							onClick={() => void finalizationQuery.refetch()}
							type="button"
							variant="outline"
						>
							Yeniden dene
						</Button>
					</div>
				) : null}
				{finalization ? (
					<section
						aria-label="Kesin ilişki"
						className="space-y-2 rounded-md border p-3"
					>
						<p className="font-medium">Kesin ilişki · Aday Sürüm oluşturuldu</p>
						<p>
							Hedef kayıt:{" "}
							{recordsQuery.data?.assetRecords.find(
								(record) => record.id === finalization.assetRecordId
							)?.name ?? finalization.assetRecordId}
						</p>
						<ul>
							{finalization.decisions.map((decision) => (
								<li key={`${decision.field}-${decision.key}`}>
									{fieldLabel(decision.field)} · {decision.key}:{" "}
									{decision.sourceEntryId
										? (proposal.fields.find(
												(field) =>
													field.field === decision.field &&
													field.key === decision.key &&
													field.sourceEntryId === decision.sourceEntryId &&
													field.sourcePath === decision.sourcePath
											)?.sourceFileName ?? decision.sourceEntryId)
										: "Bilinmiyor"}
								</li>
							))}
						</ul>
						<Link
							params={{ projectId, assetRecordId: finalization.assetRecordId }}
							to="/projects/$projectId/assets/$assetRecordId"
						>
							Aday Sürümü aç
						</Link>
					</section>
				) : null}
				{proposal.contractVersion !== sourceMetadataMappingContractVersion ||
				finalization ||
				finalizationQuery.isError ||
				(isOpen && finalizationQuery.isPending) ? null : (
					<ProposalFinalizationForm
						assetRecordId={assetRecordId}
						decisions={decisions}
						finalizeError={finalizeError}
						isFinalizing={isFinalizing}
						onFinalize={() => void finalize()}
						projectId={projectId}
						proposal={proposal}
						records={recordsQuery.data?.assetRecords}
						recordsError={recordsQuery.isError}
						setAssetRecordId={setAssetRecordId}
						setDecisions={setDecisions}
					/>
				)}
				<ul aria-label="Önerilen kaynak alanları" className="space-y-3">
					{proposal.fields.map((field) => {
						const conflict = conflictKeys.has(
							`${field.field}\u0000${field.key}`
						);
						return (
							<li
								className="space-y-1 rounded-md bg-muted/40 p-3"
								key={`${field.sourceEntryId}-${field.sourcePath}-${field.field}`}
							>
								<p className="font-medium">
									{fieldLabel(field.field)} · {field.key}
									{conflict ? (
										<span className="ml-2 text-destructive">Çakışma</span>
									) : null}
								</p>
								<p className="text-muted-foreground text-xs">
									{field.sourceFileName} · {field.sourcePath}
								</p>
								<pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs">
									{formatFieldValue(field.value)}
								</pre>
							</li>
						);
					})}
				</ul>
				{proposal.diagnostics.length > 0 ? (
					<ul
						aria-label="Metadata tanılamaları"
						className="list-disc space-y-1 pl-5"
					>
						{proposal.diagnostics.map((diagnostic) => (
							<li key={`${diagnostic.sourceEntryId}-${diagnostic.sourcePath}`}>
								{diagnostic.sourcePath}: {diagnostic.message}
							</li>
						))}
					</ul>
				) : null}
			</div>
		</details>
	);
}

export function SourceMetadataMappingPanel({
	entries,
	entry,
	projectId,
}: {
	entries: ImportInboxEntry[];
	entry: ImportInboxEntry;
	projectId: string;
}) {
	const queryClient = useQueryClient();
	const [selectedSidecarEntryIds, setSelectedSidecarEntryIds] = useState<
		string[]
	>([]);
	const [isCreating, setIsCreating] = useState(false);
	const [createError, setCreateError] = useState<{
		message: string;
		supportReference?: string;
	} | null>(null);
	const queryKey = [
		"source-metadata-mapping-proposals",
		projectId,
		entry.id,
	] as const;
	const proposalsQuery = useQuery({
		queryKey,
		queryFn: () => readProposals(projectId, entry.id),
	});
	const sidecarEntries = entries.filter(
		(candidate) => candidate.id !== entry.id
	);

	function toggleSidecar(entryId: string) {
		setSelectedSidecarEntryIds((selected) => {
			if (selected.includes(entryId)) {
				return selected.filter((selectedId) => selectedId !== entryId);
			}
			if (selected.length >= sourceMetadataMappingSidecarLimits.count) {
				return selected;
			}
			return [...selected, entryId];
		});
		setCreateError(null);
	}

	async function createProposal(sidecarEntryIds = selectedSidecarEntryIds) {
		if (isCreating || sidecarEntryIds.length === 0) {
			return;
		}
		setIsCreating(true);
		setCreateError(null);
		try {
			const response = await fetch(
				sourceMetadataMappingUrl(projectId, entry.id),
				{
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ sidecarEntryIds }),
				}
			);
			if (!response.ok) {
				const body: unknown = await response.json().catch(() => null);
				const supportReference = readSupportReference(body);
				setCreateError({
					message: createErrorMessage(response.status, body),
					...(supportReference ? { supportReference } : {}),
				});
				return;
			}
			sourceMetadataMappingProposalSchema.parse(await response.json());
			await queryClient.invalidateQueries({ queryKey });
		} catch {
			setCreateError({
				message:
					"Öneri oluşturma sonucu doğrulanamadı. Kayıtlı önerileri kontrol edin.",
			});
			await queryClient.invalidateQueries({ queryKey });
		} finally {
			setIsCreating(false);
		}
	}

	return (
		<section
			aria-label={`${entry.fileName} için Kaynak Metadata Eşleme Önerisi`}
			className="space-y-3 border-t pt-3"
		>
			<div>
				<h4 className="font-medium text-sm">Kaynak Metadata Eşleme Önerisi</h4>
				<p className="mt-1 text-muted-foreground text-sm">
					{entry.fileName} için bir veya daha fazla sidecar seçin. Öneri kaynak
					değerlerini gösterir; ilişkiyi kesinleştirmez.
				</p>
			</div>
			<fieldset className="space-y-2" disabled={isCreating}>
				<legend className="font-medium text-sm">JSON sidecar girdileri</legend>
				<p className="text-muted-foreground text-sm">
					En fazla {sourceMetadataMappingSidecarLimits.count} sidecar seçin. Her
					dosya 5 MiB, toplam boyut 8 MiB ile sınırlıdır.
				</p>
				{sidecarEntries.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						Önce JSON sidecar dosyasını Gelen Kutusuna ekleyin.
					</p>
				) : (
					<ul className="space-y-2">
						{sidecarEntries.map((sidecar) => (
							<li key={sidecar.id}>
								<label className="flex min-h-11 items-center gap-2 text-sm">
									<input
										checked={selectedSidecarEntryIds.includes(sidecar.id)}
										disabled={
											!selectedSidecarEntryIds.includes(sidecar.id) &&
											selectedSidecarEntryIds.length >=
												sourceMetadataMappingSidecarLimits.count
										}
										onChange={() => toggleSidecar(sidecar.id)}
										type="checkbox"
									/>
									<span className="break-all">
										{sidecar.fileName} · {sidecar.sourceContentType}
									</span>
								</label>
							</li>
						))}
					</ul>
				)}
			</fieldset>
			<Button
				aria-label={`Kaynak Metadata Eşleme Önerisi oluştur: ${entry.fileName}`}
				className="min-h-11"
				disabled={isCreating || selectedSidecarEntryIds.length === 0}
				onClick={() => void createProposal()}
				type="button"
			>
				{isCreating
					? "Öneri oluşturuluyor…"
					: "Kaynak Metadata Eşleme Önerisi oluştur"}
			</Button>
			{createError ? (
				<div role="alert">
					<p>{createError.message}</p>
					{createError.supportReference ? (
						<p>Destek Referansı: {createError.supportReference}</p>
					) : null}
				</div>
			) : null}
			{proposalsQuery.isPending ? (
				<p aria-live="polite" role="status">
					Öneriler okunuyor…
				</p>
			) : null}
			{proposalsQuery.isError ? (
				<div className="space-y-2" role="alert">
					<p>Kaynak Metadata Eşleme Önerileri okunamadı.</p>
					{proposalsQuery.error instanceof SourceMetadataMappingRequestError &&
					proposalsQuery.error.supportReference ? (
						<p>Destek Referansı: {proposalsQuery.error.supportReference}</p>
					) : null}
					<Button
						className="min-h-11"
						onClick={() => void proposalsQuery.refetch()}
						type="button"
						variant="outline"
					>
						Yeniden dene
					</Button>
				</div>
			) : null}
			{proposalsQuery.data?.map((proposal, index) => (
				<ProposalDetails
					entryId={entry.id}
					isCreating={isCreating}
					key={proposal.id}
					onRecreate={() =>
						void createProposal(
							proposal.sidecars.map((sidecar) => sidecar.entryId)
						)
					}
					previousProposal={proposalsQuery.data[index + 1]}
					projectId={projectId}
					proposal={proposal}
				/>
			))}
		</section>
	);
}
