import {
	type AssetRecordSearchInput,
	assetRecordCategoryValues,
} from "@sprite-anvil/api/asset-records";
import type { ProjectContextScopeCatalog } from "@sprite-anvil/api/context-scopes";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, type SyntheticEvent, useState } from "react";
import {
	assetCategoryLabels,
	assetRecordAvailabilityLabels,
} from "@/features/asset-records/ui/category-labels";
import { getIdentitySummary } from "@/features/asset-records/ui/identity-criteria";
import { QueryRetryButton } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { orpc } from "@/utils/orpc";

function getVersionLabel(version: {
	fileName: string | null;
	versionNumber: number;
}) {
	return version.fileName
		? `${version.fileName} · Sürüm ${version.versionNumber}`
		: `Sürüm ${version.versionNumber}`;
}

function getVersionHistoryLabel(version: {
	fileName: string | null;
	versionNumber: number;
}) {
	return `${version.fileName ? `${version.fileName} ` : ""}sürüm ${version.versionNumber} geçmişini aç`;
}

interface SearchDraft {
	assetCategory: string;
	availability: string;
	name: string;
	sourceImageHeight: string;
	sourceImageWidth: string;
	tag: string;
	themeId: string;
	visualWorldId: string;
}

const emptyDraft: SearchDraft = {
	name: "",
	assetCategory: "",
	visualWorldId: "",
	themeId: "",
	sourceImageWidth: "",
	sourceImageHeight: "",
	tag: "",
	availability: "",
};

function recordCategoryLabel(category: string | null | undefined) {
	if (!category) {
		return "Kategori atanmamış";
	}
	return (
		assetCategoryLabels[category as keyof typeof assetCategoryLabels] ??
		category
	);
}

function recordAvailabilityLabel(availability: string) {
	return (
		assetRecordAvailabilityLabels[
			availability as keyof typeof assetRecordAvailabilityLabels
		] ?? availability
	);
}

function buildSearchInput(projectId: string, draft: SearchDraft) {
	const input: AssetRecordSearchInput = { projectId };
	const name = draft.name.trim();
	const tag = draft.tag.trim();
	if (name) {
		input.name = name;
	}
	if (draft.assetCategory) {
		input.assetCategory =
			draft.assetCategory as AssetRecordSearchInput["assetCategory"];
	}
	if (draft.visualWorldId) {
		input.visualWorldId = draft.visualWorldId;
	}
	if (draft.themeId) {
		input.themeId = draft.themeId;
	}
	if (tag) {
		input.tag = tag;
	}
	if (draft.availability) {
		input.availability =
			draft.availability as AssetRecordSearchInput["availability"];
	}
	if (draft.sourceImageWidth.trim() && draft.sourceImageHeight.trim()) {
		input.sourceImageWidth = Number(draft.sourceImageWidth);
		input.sourceImageHeight = Number(draft.sourceImageHeight);
	}
	return input;
}

export function AssetRecordSearchPanel({
	onOpenRecord,
	projectId,
}: {
	onOpenRecord: (assetRecordId: string, versionId?: string) => void;
	projectId: string;
}) {
	const [draft, setDraft] = useState<SearchDraft>(emptyDraft);
	const [submitted, setSubmitted] = useState<AssetRecordSearchInput>({
		projectId,
	});
	const [validationMessage, setValidationMessage] = useState<string | null>(
		null
	);
	const scopeQuery = useQuery({
		...orpc.contextScopes.list.queryOptions({ input: { projectId } }),
		meta: { errorPresentation: "inline" },
	});
	const searchQuery = useQuery({
		...orpc.assetRecords.search.queryOptions({ input: submitted }),
		meta: { errorPresentation: "inline" },
	});
	const scopes: ProjectContextScopeCatalog = scopeQuery.data ?? {
		themes: [],
		visualWorlds: [],
	};
	const availableThemes = draft.visualWorldId
		? scopes.themes.filter(
				(theme) => theme.visualWorldId === draft.visualWorldId
			)
		: scopes.themes;
	const hasActiveFilters = Object.entries(submitted).some(
		([key, value]) => key !== "projectId" && value !== undefined
	);
	let resultsView: ReactNode = null;
	if (searchQuery.isSuccess && searchQuery.data.records.length === 0) {
		resultsView = (
			<p
				className="rounded-lg border border-dashed p-4 text-muted-foreground"
				role="status"
			>
				{hasActiveFilters
					? "Arama ölçütleriyle eşleşen varlık kaydı yok."
					: "Bu projede henüz varlık kaydı yok."}
			</p>
		);
	} else if (searchQuery.isSuccess) {
		resultsView = (
			<div aria-live="polite" className="space-y-3">
				<p className="text-muted-foreground text-sm">
					{searchQuery.data.totalCount} varlık kaydı bulundu.
				</p>
				<ul className="space-y-3">
					{searchQuery.data.records.map(({ record, matchingVersions }) => {
						const worldName = scopes.visualWorlds.find(
							(world) => world.id === record.visualWorldId
						)?.name;
						const themeName = scopes.themes.find(
							(theme) => theme.id === record.themeId
						)?.name;
						return (
							<li
								className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
								key={record.id}
							>
								<div className="space-y-1">
									<h3 className="font-medium">{record.name}</h3>
									<p className="text-muted-foreground text-sm">
										{recordCategoryLabel(record.assetCategory)} ·{" "}
										{recordAvailabilityLabel(record.availability)}
									</p>
									<p className="text-muted-foreground text-sm">
										{getIdentitySummary(record.identityCriteria)}
									</p>
									{worldName || themeName || record.tags?.length ? (
										<p className="text-muted-foreground text-sm">
											{[worldName, themeName, ...(record.tags ?? [])]
												.filter(Boolean)
												.join(" · ")}
										</p>
									) : null}
									{matchingVersions.length > 0 ? (
										<ul
											aria-label="Eşleşen kaynak görsel sürümleri"
											className="space-y-1 text-sm"
										>
											{matchingVersions.map((version) => (
												<li key={version.id}>
													<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
														<span>
															{getVersionLabel(version)} ·{" "}
															{version.sourceImageWidth} ×{" "}
															{version.sourceImageHeight} px
														</span>
														<Button
															aria-label={getVersionHistoryLabel(version)}
															onClick={() =>
																onOpenRecord(record.id, version.id)
															}
															variant="link"
														>
															Sürüm geçmişini aç
														</Button>
													</div>
												</li>
											))}
										</ul>
									) : null}
								</div>
								<Button
									aria-label={`${record.name} kaydını aç`}
									onClick={() => onOpenRecord(record.id)}
									variant="outline"
								>
									Kaydı aç
								</Button>
							</li>
						);
					})}
				</ul>
			</div>
		);
	}

	function updateDraft<K extends keyof SearchDraft>(
		key: K,
		value: SearchDraft[K]
	) {
		setDraft((current) => ({
			...current,
			[key]: value,
			...(key === "visualWorldId" ? { themeId: "" } : {}),
		}));
		setValidationMessage(null);
	}

	function submitSearch(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		const width = draft.sourceImageWidth.trim();
		const height = draft.sourceImageHeight.trim();
		if (Boolean(width) !== Boolean(height)) {
			setValidationMessage(
				"Ölçü aramak için genişlik ve yüksekliği birlikte girin."
			);
			return;
		}
		if (width || height) {
			const parsedWidth = Number(width);
			const parsedHeight = Number(height);
			if (
				!(
					Number.isSafeInteger(parsedWidth) &&
					Number.isSafeInteger(parsedHeight)
				) ||
				parsedWidth < 1 ||
				parsedHeight < 1 ||
				parsedWidth > 100_000 ||
				parsedHeight > 100_000
			) {
				setValidationMessage(
					"Genişlik ve yükseklik 1–100.000 px arasında tam sayı olmalı."
				);
				return;
			}
		}
		setValidationMessage(null);
		setSubmitted(buildSearchInput(projectId, draft));
	}

	return (
		<section
			aria-labelledby="asset-record-search-heading"
			className="space-y-4 rounded-lg border p-5"
		>
			<div>
				<h2 className="font-semibold text-xl" id="asset-record-search-heading">
					Varlık kayıtlarını ara
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Ölçü araması aynı kaydın değişmez sürümleri arasında yapılır ve
					eşleşen sürümü gösterir.
				</p>
			</div>
			<form className="grid gap-3 sm:grid-cols-2" onSubmit={submitSearch}>
				<label className="space-y-1 text-sm" htmlFor="asset-record-search-name">
					<span>Ada göre ara</span>
					<Input
						id="asset-record-search-name"
						maxLength={120}
						onChange={(event) => updateDraft("name", event.target.value)}
						value={draft.name}
					/>
				</label>
				<label
					className="space-y-1 text-sm"
					htmlFor="asset-record-search-category"
				>
					<span>Varlık kategorisi</span>
					<select
						className="h-8 w-full rounded-md border bg-background px-2 text-sm"
						id="asset-record-search-category"
						onChange={(event) =>
							updateDraft("assetCategory", event.target.value)
						}
						value={draft.assetCategory}
					>
						<option value="">Tüm kategoriler</option>
						{assetRecordCategoryValues.map((category) => (
							<option key={category} value={category}>
								{assetCategoryLabels[category]}
							</option>
						))}
					</select>
				</label>
				<label
					className="space-y-1 text-sm"
					htmlFor="asset-record-search-world"
				>
					<span>Görsel Dünya</span>
					<select
						className="h-8 w-full rounded-md border bg-background px-2 text-sm"
						id="asset-record-search-world"
						onChange={(event) =>
							updateDraft("visualWorldId", event.target.value)
						}
						value={draft.visualWorldId}
					>
						<option value="">Tüm Görsel Dünyalar</option>
						{scopes.visualWorlds.map((world) => (
							<option key={world.id} value={world.id}>
								{world.name}
							</option>
						))}
					</select>
				</label>
				<label
					className="space-y-1 text-sm"
					htmlFor="asset-record-search-theme"
				>
					<span>Tema</span>
					<select
						className="h-8 w-full rounded-md border bg-background px-2 text-sm"
						id="asset-record-search-theme"
						onChange={(event) => updateDraft("themeId", event.target.value)}
						value={draft.themeId}
					>
						<option value="">Tüm Temalar</option>
						{availableThemes.map((theme) => (
							<option key={theme.id} value={theme.id}>
								{theme.name}
							</option>
						))}
					</select>
				</label>
				<div className="grid grid-cols-2 gap-3">
					<label
						className="space-y-1 text-sm"
						htmlFor="asset-record-search-width"
					>
						<span>Kaynak Görsel genişliği (px)</span>
						<Input
							id="asset-record-search-width"
							max="100000"
							min="1"
							onChange={(event) =>
								updateDraft("sourceImageWidth", event.target.value)
							}
							step="1"
							type="number"
							value={draft.sourceImageWidth}
						/>
					</label>
					<label
						className="space-y-1 text-sm"
						htmlFor="asset-record-search-height"
					>
						<span>Kaynak Görsel yüksekliği (px)</span>
						<Input
							id="asset-record-search-height"
							max="100000"
							min="1"
							onChange={(event) =>
								updateDraft("sourceImageHeight", event.target.value)
							}
							step="1"
							type="number"
							value={draft.sourceImageHeight}
						/>
					</label>
				</div>
				<label className="space-y-1 text-sm" htmlFor="asset-record-search-tag">
					<span>Etiket</span>
					<Input
						id="asset-record-search-tag"
						maxLength={40}
						onChange={(event) => updateDraft("tag", event.target.value)}
						value={draft.tag}
					/>
				</label>
				<label
					className="space-y-1 text-sm"
					htmlFor="asset-record-search-availability"
				>
					<span>Kayıt durumu</span>
					<select
						className="h-8 w-full rounded-md border bg-background px-2 text-sm"
						id="asset-record-search-availability"
						onChange={(event) =>
							updateDraft("availability", event.target.value)
						}
						value={draft.availability}
					>
						<option value="">Tüm durumlar</option>
						{Object.entries(assetRecordAvailabilityLabels).map(
							([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							)
						)}
					</select>
				</label>
				<div className="sm:col-span-2">
					{validationMessage ? (
						<p className="mb-2 text-destructive text-sm" role="alert">
							{validationMessage}
						</p>
					) : null}
					<Button disabled={searchQuery.isFetching} type="submit">
						{searchQuery.isFetching ? "Aranıyor…" : "Varlık kayıtlarını ara"}
					</Button>
				</div>
			</form>
			{scopeQuery.isPending ? (
				<p aria-live="polite">Tema ve Görsel Dünya kayıtları yükleniyor…</p>
			) : null}
			{scopeQuery.isError ? (
				<div className="space-y-2">
					<p role="alert">
						{getErrorMessage(
							scopeQuery.error,
							"Tema ve Görsel Dünya kayıtları yüklenemedi.",
							"query"
						)}
					</p>
					<QueryRetryButton
						disabled={scopeQuery.isFetching}
						onRetry={() => void scopeQuery.refetch()}
					/>
				</div>
			) : null}
			{searchQuery.isPending ? (
				<p aria-live="polite">Varlık kayıtları aranıyor…</p>
			) : null}
			{searchQuery.isError ? (
				<div className="space-y-2">
					<p role="alert">
						{getErrorMessage(
							searchQuery.error,
							"Varlık kayıtları aranamadı.",
							"query"
						)}
					</p>
					<QueryRetryButton
						disabled={searchQuery.isFetching}
						onRetry={() => void searchQuery.refetch()}
					/>
				</div>
			) : null}
			{resultsView}
		</section>
	);
}
