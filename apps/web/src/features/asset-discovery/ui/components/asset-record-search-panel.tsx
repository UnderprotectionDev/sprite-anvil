import {
	type AssetRecordSearchInput,
	assetRecordCategoryValues,
} from "@sprite-anvil/api/asset-records";
import type { ProjectContextScopeCatalog } from "@sprite-anvil/api/context-scopes";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import {
	assetCategoryLabels,
	assetRecordAvailabilityLabels,
} from "@/features/asset-records/lib/category-labels";
import { getIdentitySummary } from "@/features/asset-records/lib/identity-criteria";
import { QueryRetryButton } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { orpc } from "@/utils/orpc";
import {
	type AssetRecordSearchDraft,
	assetRecordSearchDraftSchema,
} from "../../schemas";

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

const emptyDraft: AssetRecordSearchDraft = {
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

function buildSearchInput(projectId: string, draft: AssetRecordSearchDraft) {
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

function validateSearchDraft({ value }: { value: AssetRecordSearchDraft }) {
	return assetRecordSearchDraftSchema.safeParse(value).error?.issues[0]
		?.message;
}

export function AssetRecordSearchPanel({
	onOpenRecord,
	projectId,
}: {
	onOpenRecord: (assetRecordId: string, versionId?: string) => void;
	projectId: string;
}) {
	const [submitted, setSubmitted] = useState<AssetRecordSearchInput>({
		projectId,
	});
	const form = useForm({
		defaultValues: emptyDraft,
		onSubmit: ({ value }) => {
			setSubmitted(buildSearchInput(projectId, value));
		},
		validators: { onSubmit: validateSearchDraft },
	});
	const selectedVisualWorldId = useStore(
		form.store,
		(state) => state.values.visualWorldId
	);
	const validationMessage = useStore(
		form.store,
		(state) => state.errorMap.onSubmit
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
	const availableThemes = selectedVisualWorldId
		? scopes.themes.filter(
				(theme) => theme.visualWorldId === selectedVisualWorldId
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
			<form
				className="grid gap-3 sm:grid-cols-2"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					void form.handleSubmit();
				}}
			>
				<form.Field name="name">
					{(field) => (
						<Label
							className="block space-y-1 text-sm leading-normal"
							htmlFor="asset-record-search-name"
						>
							<span>Ada göre ara</span>
							<Input
								id="asset-record-search-name"
								maxLength={120}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
				<form.Field name="assetCategory">
					{(field) => (
						<Label
							className="block space-y-1 text-sm leading-normal"
							htmlFor="asset-record-search-category"
						>
							<span>Varlık kategorisi</span>
							<NativeSelect
								className="w-full"
								id="asset-record-search-category"
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							>
								<NativeSelectOption value="">
									Tüm kategoriler
								</NativeSelectOption>
								{assetRecordCategoryValues.map((category) => (
									<NativeSelectOption key={category} value={category}>
										{assetCategoryLabels[category]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Label>
					)}
				</form.Field>
				<details className="rounded-md border p-3 sm:col-span-2">
					<summary className="cursor-pointer font-medium text-sm">
						Diğer filtreler
					</summary>
					<div className="mt-3 grid gap-3 sm:grid-cols-2">
						<form.Field
							listeners={{
								onChange: () => form.setFieldValue("themeId", ""),
							}}
							name="visualWorldId"
						>
							{(field) => (
								<Label
									className="block space-y-1 text-sm leading-normal"
									htmlFor="asset-record-search-world"
								>
									<span>Görsel Dünya</span>
									<NativeSelect
										className="w-full"
										id="asset-record-search-world"
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									>
										<NativeSelectOption value="">
											Tüm Görsel Dünyalar
										</NativeSelectOption>
										{scopes.visualWorlds.map((world) => (
											<NativeSelectOption key={world.id} value={world.id}>
												{world.name}
											</NativeSelectOption>
										))}
									</NativeSelect>
								</Label>
							)}
						</form.Field>
						<form.Field name="themeId">
							{(field) => (
								<Label
									className="block space-y-1 text-sm leading-normal"
									htmlFor="asset-record-search-theme"
								>
									<span>Tema</span>
									<NativeSelect
										className="w-full"
										id="asset-record-search-theme"
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									>
										<NativeSelectOption value="">
											Tüm Temalar
										</NativeSelectOption>
										{availableThemes.map((theme) => (
											<NativeSelectOption key={theme.id} value={theme.id}>
												{theme.name}
											</NativeSelectOption>
										))}
									</NativeSelect>
								</Label>
							)}
						</form.Field>
						<div className="grid grid-cols-2 gap-3">
							<form.Field name="sourceImageWidth">
								{(field) => (
									<Label
										className="block space-y-1 text-sm leading-normal"
										htmlFor="asset-record-search-width"
									>
										<span>Kaynak Görsel genişliği (px)</span>
										<Input
											id="asset-record-search-width"
											max="100000"
											min="1"
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											step="1"
											type="number"
											value={field.state.value}
										/>
									</Label>
								)}
							</form.Field>
							<form.Field name="sourceImageHeight">
								{(field) => (
									<Label
										className="block space-y-1 text-sm leading-normal"
										htmlFor="asset-record-search-height"
									>
										<span>Kaynak Görsel yüksekliği (px)</span>
										<Input
											id="asset-record-search-height"
											max="100000"
											min="1"
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											step="1"
											type="number"
											value={field.state.value}
										/>
									</Label>
								)}
							</form.Field>
						</div>
						<form.Field name="tag">
							{(field) => (
								<Label
									className="block space-y-1 text-sm leading-normal"
									htmlFor="asset-record-search-tag"
								>
									<span>Etiket</span>
									<Input
										id="asset-record-search-tag"
										maxLength={40}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									/>
								</Label>
							)}
						</form.Field>
						<form.Field name="availability">
							{(field) => (
								<Label
									className="block space-y-1 text-sm leading-normal"
									htmlFor="asset-record-search-availability"
								>
									<span>Kayıt durumu</span>
									<NativeSelect
										className="w-full"
										id="asset-record-search-availability"
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									>
										<NativeSelectOption value="">
											Tüm durumlar
										</NativeSelectOption>
										{Object.entries(assetRecordAvailabilityLabels).map(
											([value, label]) => (
												<NativeSelectOption key={value} value={value}>
													{label}
												</NativeSelectOption>
											)
										)}
									</NativeSelect>
								</Label>
							)}
						</form.Field>
					</div>
				</details>
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
