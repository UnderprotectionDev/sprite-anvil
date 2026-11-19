import type { AssetRecordSearchInput } from "@sprite-anvil/api/asset-records";
import { assetRecordCategoryValues } from "@sprite-anvil/api/asset-records";
import type { ProjectContextScopeCatalog } from "@sprite-anvil/api/context-scopes";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { WindowVirtualList } from "@sprite-anvil/ui/components/window-virtual-list";
import { useForm, useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { StatusMessage } from "@/components/status-message";
import type { AssetRecordSearchDraft } from "@/features/asset-discovery/schemas";
import { assetRecordSearchDraftSchema } from "@/features/asset-discovery/schemas";
import {
	assetCategoryLabels,
	assetRecordAvailabilityLabels,
} from "@/utils/category-labels";
import { QueryRetryButton } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { getIdentitySummary } from "@/utils/identity-criteria";
import { orpc } from "@/utils/orpc";

function getVersionLabel(version: {
	fileName: string | null;
	versionNumber: number;
}) {
	return version.fileName
		? `${version.fileName} · Version ${version.versionNumber}`
		: `Version ${version.versionNumber}`;
}

function getVersionHistoryLabel(version: {
	fileName: string | null;
	versionNumber: number;
}) {
	return `${version.fileName ? `${version.fileName} ` : ""}open version ${version.versionNumber} history`;
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
		return "No category assigned";
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
	const [page, setPage] = useState({ projectId, offset: 0 });
	const offset = page.projectId === projectId ? page.offset : 0;
	const form = useForm({
		defaultValues: emptyDraft,
		onSubmit: ({ value }) => {
			setSubmitted(buildSearchInput(projectId, value));
			setPage({ projectId, offset: 0 });
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
		...orpc.assetRecords.search.queryOptions({
			input: {
				...(submitted.projectId === projectId ? submitted : { projectId }),
				pagination: { limit: 50, offset },
			},
		}),
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
		([key, value]) =>
			key !== "projectId" && key !== "pagination" && value !== undefined
	);
	let resultsView: ReactNode = null;
	if (searchQuery.isSuccess && searchQuery.data.records.length === 0) {
		resultsView = (
			<div>
				<p
					className="text-muted-foreground rounded-lg border border-dashed p-4"
					role="status"
				>
					{hasActiveFilters
						? "No Asset Records match the search criteria."
						: "This project has no Asset Records yet."}
				</p>
				{offset > 0 ? (
					<Button
						onClick={() =>
							setPage({ projectId, offset: Math.max(0, offset - 50) })
						}
						type="button"
						variant="outline"
					>
						Previous
					</Button>
				) : null}
			</div>
		);
	} else if (searchQuery.isSuccess) {
		resultsView = (
			<div aria-live="polite" className="space-y-3">
				<p className="text-muted-foreground text-sm">
					{searchQuery.data.totalCount} Asset Records found.
				</p>
				<WindowVirtualList
					getItemKey={({ record }) => record.id}
					items={searchQuery.data.records}
					renderItem={({ record, matchingVersions }) => {
						const worldName = scopes.visualWorlds.find(
							(world) => world.id === record.visualWorldId
						)?.name;
						const themeName = scopes.themes.find(
							(theme) => theme.id === record.themeId
						)?.name;
						return (
							<div className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
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
											aria-label="Matching source image versions"
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
															Open version history
														</Button>
													</div>
												</li>
											))}
										</ul>
									) : null}
								</div>
								<Button
									aria-label={`${record.name} open record`}
									onClick={() => onOpenRecord(record.id)}
									variant="outline"
								>
									Open record
								</Button>
							</div>
						);
					}}
				/>
				<div className="flex gap-2">
					<Button
						disabled={offset === 0 || searchQuery.isFetching}
						onClick={() =>
							setPage({ projectId, offset: Math.max(0, offset - 50) })
						}
						type="button"
						variant="outline"
					>
						Previous
					</Button>
					<Button
						disabled={
							typeof searchQuery.data.nextOffset !== "number" ||
							searchQuery.isFetching
						}
						onClick={() =>
							setPage({
								projectId,
								offset: searchQuery.data.nextOffset ?? offset,
							})
						}
						type="button"
						variant="outline"
					>
						Next
					</Button>
				</div>
			</div>
		);
	}

	return (
		<section
			aria-labelledby="asset-record-search-heading"
			className="space-y-4 rounded-lg border p-5"
		>
			<div>
				<h2 className="text-xl font-semibold" id="asset-record-search-heading">
					Search Asset Records
				</h2>
				<p className="text-muted-foreground mt-1 text-sm">
					Dimension search checks immutable versions of the same record and
					shows matching versions.
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
							<span>Search by name</span>
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
							<span>Asset category</span>
							<NativeSelect
								className="w-full"
								id="asset-record-search-category"
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							>
								<NativeSelectOption value="">All categories</NativeSelectOption>
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
					<summary className="cursor-pointer text-sm font-medium">
						More filters
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
									<span>Visual World</span>
									<NativeSelect
										className="w-full"
										id="asset-record-search-world"
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									>
										<NativeSelectOption value="">
											All Visual Worlds
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
									<span>Theme</span>
									<NativeSelect
										className="w-full"
										id="asset-record-search-theme"
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									>
										<NativeSelectOption value="">All Themes</NativeSelectOption>
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
										<span>Source image width (px)</span>
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
										<span>Source image height (px)</span>
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
									<span>Tag</span>
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
									<span>Record status</span>
									<NativeSelect
										className="w-full"
										id="asset-record-search-availability"
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									>
										<NativeSelectOption value="">
											All statuses
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
						<StatusMessage className="mb-2" tone="error">
							{validationMessage}
						</StatusMessage>
					) : null}
					<Button disabled={searchQuery.isFetching} type="submit">
						{searchQuery.isFetching ? "Searching…" : "Search Asset Records"}
					</Button>
				</div>
			</form>
			{scopeQuery.isPending ? (
				<p aria-live="polite">Loading Theme and Visual World records…</p>
			) : null}
			{scopeQuery.isError ? (
				<div className="space-y-2">
					<StatusMessage tone="error">
						{getErrorMessage(
							scopeQuery.error,
							"Could not load Theme and Visual World records.",
							"query"
						)}
					</StatusMessage>
					<QueryRetryButton
						disabled={scopeQuery.isFetching}
						onRetry={() => void scopeQuery.refetch()}
					/>
				</div>
			) : null}
			{searchQuery.isPending ? (
				<p aria-live="polite">Searching Asset Records…</p>
			) : null}
			{searchQuery.isError ? (
				<div className="space-y-2">
					<StatusMessage tone="error">
						{getErrorMessage(
							searchQuery.error,
							"Could not search Asset Records.",
							"query"
						)}
					</StatusMessage>
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
