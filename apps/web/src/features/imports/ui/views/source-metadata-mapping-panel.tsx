import type { ImportInboxEntry } from "@sprite-anvil/api/import-inbox";
import {
	type SourceMetadataMappingProposal,
	sourceMetadataMappingProposalSchema,
	sourceMetadataMappingProposalsSchema,
} from "@sprite-anvil/api/source-metadata-mapping";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
	readSupportReference,
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

function ProposalDetails({
	proposal,
}: {
	proposal: SourceMetadataMappingProposal;
}) {
	const conflictKeys = proposalConflictKeys(proposal);
	return (
		<details className="rounded-md border p-3 text-sm">
			<summary className="min-h-11 cursor-pointer py-2 font-medium">
				Kaynak Metadata Eşleme Önerisi ·{" "}
				{new Date(proposal.createdAt).toLocaleString("tr-TR")}
			</summary>
			<div className="space-y-4 pt-2">
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
				{proposal.conflicts.length > 0 ? (
					<p className="font-medium" role="status">
						{proposal.conflicts.length} alan çakışması var; öneri henüz
						kesinleşmedi.
					</p>
				) : null}
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
		setSelectedSidecarEntryIds((selected) =>
			selected.includes(entryId)
				? selected.filter((selectedId) => selectedId !== entryId)
				: [...selected, entryId]
		);
		setCreateError(null);
	}

	async function createProposal() {
		if (isCreating || selectedSidecarEntryIds.length === 0) {
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
					body: JSON.stringify({ sidecarEntryIds: selectedSidecarEntryIds }),
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
			{proposalsQuery.data?.map((proposal) => (
				<ProposalDetails key={proposal.id} proposal={proposal} />
			))}
		</section>
	);
}
